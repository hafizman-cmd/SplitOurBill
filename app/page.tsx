'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowRight, ChevronDown, Save, X } from 'lucide-react';
import type { HistoryEntry, Item, PaymentMarks, ReceiptCharges, ScanResponse, SplitResult } from './types';
import {
  HISTORY_STORAGE_KEY,
  ACTIVE_BILL_STORAGE_KEY,
  QR_STORAGE_KEY,
  QR_PAYLOAD_STORAGE_KEY,
  STORAGE_KEY,
  compressImage,
  loadHistoryFromStorage,
  uid,
} from './lib/utils';
import { computeSplit } from './lib/split';
import { paymentMark } from './lib/paymentMarks';
import type { SharedBill } from './lib/sharedBill';
import { CURRENCIES, isExchangeRateSource, parseMyrRate, parseReferenceRate, type CurrencyCode, type ExchangeRateSource } from './lib/currency';
import Header from './components/Header';
import ConfirmModal from './components/ConfirmModal';
import { parseBillDraft, snapshotFromDraft, type BillDraft } from './lib/billStorage';
import BillFlowGuide from './components/BillFlowGuide';
import ScanReviewModal, { type ReviewedScan } from './components/ScanReviewModal';
import ReceiptScanner from './components/ReceiptScanner';
import PeopleManager from './components/PeopleManager';
import ItemList from './components/ItemList';
import ChargesSection from './components/ChargesSection';
import ReceiptChargesModal from './components/ReceiptChargesModal';
import SummarySection from './components/SummarySection';
import SettingsModal from './components/SettingsModal';
import ShareModal from './components/ShareModal';
import PaymentQrModal from './components/PaymentQrModal';
import HistoryModal from './components/HistoryModal';
import CropModal from './components/CropModal';
import CameraModal from './components/CameraModal';
import Footer from './components/Footer';
import Toast from './components/Toast';
import { getSessionId, logEvent } from '@/lib/telemetry';
import { getDeviceId } from '@/lib/device';
import DailyScanLimitModal from './components/DailyScanLimitModal';

type Removal =
  | { type: 'item'; index: number; item: Item }
  | { type: 'person'; index: number; name: string; itemIds: Set<string>; paid: PaymentMarks[string] };

export default function Home() {
  const [bankDetails, setBankDetails] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paymentQrCode, setPaymentQrCode] = useState('');
  const [qrPayload, setQrPayload] = useState('');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [saveState, setSaveState] = useState<'loading' | 'saved' | 'error'>('loading');
  const [pendingAction, setPendingAction] = useState<{ type: 'load'; entry: HistoryEntry } | { type: 'new' | 'clear' } | null>(null);

  const [people, setPeople] = useState<string[]>([]);
  const [paidStatus, setPaidStatus] = useState<PaymentMarks>({});
  const [restaurantName, setRestaurantName] = useState('');
  const [billDate, setBillDate] = useState('');
  const [share, setShare] = useState<{ bill: SharedBill; calc: SplitResult } | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [removal, setRemoval] = useState<Removal | null>(null);
  const undoButtonRef = useRef<HTMLButtonElement>(null);

  const [serviceChargeInput, setServiceChargeInput] = useState('0');
  const [receiptCharges, setReceiptCharges] = useState<ReceiptCharges>();
  const [receiptChargesOpen, setReceiptChargesOpen] = useState(false);
  const [taxInput, setTaxInput] = useState('0');
  const [roundingAdjustmentInput, setRoundingAdjustmentInput] = useState('0');

  const [currency, setCurrency] = useState<CurrencyCode>('MYR');
  const [rateInput, setRateInput] = useState('');
  const [rateSource, setRateSource] = useState<ExchangeRateSource>();
  const [fetchingRate, setFetchingRate] = useState(false);
  const rateRequest = useRef<AbortController | null>(null);
  const myrRate = currency === 'MYR' ? 1 : parseMyrRate(rateInput);

  const [pendingScan, setPendingScan] = useState<{ scan: ReviewedScan; image: string } | null>(null);
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);
  const itemsSectionRef = useRef<HTMLDivElement>(null);
  const scannerSectionRef = useRef<HTMLDivElement>(null);
  const peopleSectionRef = useRef<HTMLDivElement>(null);
  const reviewSectionRef = useRef<HTMLDivElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [dailyLimitOpen, setDailyLimitOpen] = useState(false);
  const [scansRemaining, setScansRemaining] = useState<number | null>(null);
  const [developerMode, setDeveloperMode] = useState(false);
  const scanStatusVersion = useRef(0);
  const manualNameInputRef = useRef<HTMLInputElement>(null);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordedOpen = useRef(false);

  useEffect(() => {
    if (removal && document.activeElement === document.body) {
      undoButtonRef.current?.focus({ preventScroll: true });
    }
  }, [removal]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/auth', { cache: 'no-store', signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        if (!controller.signal.aborted) setDeveloperMode(data.authenticated === true);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (scanning) return;
    let active = true;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    const refreshScanStatus = async () => {
      const version = ++scanStatusVersion.current;
      try {
        const response = await fetch('/api/scan', {
          cache: 'no-store',
          headers: { 'x-scan-browser': getDeviceId() },
        });
        if (!response.ok) return;
        const data: Pick<ScanResponse, 'remaining' | 'resetsAt'> = await response.json();
        if (!active || version !== scanStatusVersion.current) return;
        if (typeof data.remaining === 'number') {
          setScansRemaining(Math.max(0, data.remaining));
          if (data.remaining > 0) setDailyLimitOpen(false);
        }
        if (typeof data.resetsAt === 'number' && Number.isFinite(data.resetsAt)) {
          clearTimeout(resetTimer);
          resetTimer = setTimeout(() => {
            setScansRemaining(null);
            setDailyLimitOpen(false);
            void refreshScanStatus();
          }, Math.min(86_400_000, Math.max(1000, data.resetsAt - Date.now() + 250)));
        }
      } catch {}
    };
    void refreshScanStatus();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshScanStatus();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      clearTimeout(resetTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [developerMode, scanning]);

  useEffect(() => {
    if (recordedOpen.current) return;
    recordedOpen.current = true;
    logEvent('app_open');
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setBankDetails(saved);
      const savedQr = window.localStorage.getItem(QR_STORAGE_KEY);
      if (savedQr) setPaymentQrCode(savedQr);
      const savedQrPayload = window.localStorage.getItem(QR_PAYLOAD_STORAGE_KEY);
      if (savedQrPayload) setQrPayload(savedQrPayload);
      setHistory(loadHistoryFromStorage());
      const rawDraft = window.localStorage.getItem(ACTIVE_BILL_STORAGE_KEY);
      if (rawDraft) {
        const restored = parseBillDraft(rawDraft);
        if (restored) {
          setItems(restored.items);
          setPeople(restored.people);
          setPaidStatus(restored.paidStatus);
          setRestaurantName(restored.restaurantName);
          setBillDate(restored.billDate);
          setServiceChargeInput(restored.serviceChargeInput);
          setTaxInput(restored.taxInput);
          setReceiptCharges(restored.receiptCharges);
          setRoundingAdjustmentInput(restored.roundingAdjustmentInput);
          setCurrency(restored.currency);
          setRateInput(restored.rateInput);
          setRateSource(restored.rateSource);
          setActiveHistoryId(restored.historyId);
          showToast('Your last bill was restored from this device.');
        } else {
          showToast('Could not restore the last draft. Check History for saved bills.');
        }
      }
    } catch {
      setSaveState('error');
    }
    setStorageReady(true);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [showToast]);

  const draft = useMemo<BillDraft>(() => ({
    version: 1,
    receiptCharges,
    historyId: activeHistoryId,
    restaurantName,
    billDate,
    items,
    people,
    paidStatus,
    serviceChargeInput,
    taxInput,
    roundingAdjustmentInput,
    currency,
    rateInput,
    rateSource,
  }), [receiptCharges, activeHistoryId, restaurantName, billDate, items, people, paidStatus, serviceChargeInput, taxInput, roundingAdjustmentInput, currency, rateInput, rateSource]);
  const hasCurrentBill = items.length > 0 || people.length > 0 || restaurantName.trim() !== '' ||
    receiptCharges?.discount !== undefined || receiptCharges?.serviceAmount !== undefined || receiptCharges?.taxAmount !== undefined ||
    serviceChargeInput !== '0' || taxInput !== '0' || roundingAdjustmentInput !== '0' || currency !== 'MYR';

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(ACTIVE_BILL_STORAGE_KEY, JSON.stringify(draft));
      if (draft.historyId && history.some((entry) => entry.id === draft.historyId)) {
        const snapshot = snapshotFromDraft(draft);
        const result = computeSplit(snapshot.items, snapshot.people, snapshot.serviceCharge, snapshot.tax, snapshot.roundingAdjustment, snapshot.receiptCharges, snapshot.currency);
        if (result.issue !== 'invalidAmounts') {
          const next = history.map((entry) => entry.id === draft.historyId ? {
            ...entry,
            restaurantName: draft.restaurantName.trim() || 'Untitled bill',
            grandTotal: result.grandTotal,
            itemsCount: snapshot.items.length,
            receiptData: snapshot,
          } : entry);
          window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
          if (JSON.stringify(next) !== JSON.stringify(history)) setHistory(next);
        }
      }
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, [draft, storageReady, history]);

  useEffect(() => {
    if (saveState !== 'error' || !hasCurrentBill) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [saveState, hasCurrentBill]);

  const handleFileSelected = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showToast('Image is too large. Please use a smaller photo.');
      return;
    }
    try {
      const preview = await compressImage(file, 1600);
      setCropImage(preview);
    } catch {
      setScanError('Could not read the image file. Please try again.');
    }
  };

  const scanReceipt = async (imageDataUrl: string) => {
    scanStatusVersion.current += 1;
    setCropImage(null);
    setScanning(true);
    setScanError(null);

    let serverResponded = false;
    let serverSucceeded = false;
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-scan-browser': getDeviceId(),
          'x-telemetry-session': getSessionId() ?? '',
        },
        body: JSON.stringify({ imageBase64: imageDataUrl }),
      });
      serverResponded = true;
      serverSucceeded = res.ok;

      const data: ScanResponse | null = await res
        .json()
        .catch(() => null as ScanResponse | null);

      if (typeof data?.remaining === 'number') {
        setScansRemaining(Math.max(0, data.remaining));
      }
      if (!res.ok) {
        if (
          res.status === 429 &&
          (data as { error?: string } | null)?.error === 'DAILY_LIMIT_REACHED'
        ) {
          setScansRemaining(0);
          setDeveloperMode(false);
          if (developerMode) {
            setScanError('Developer session expired. Re-enable it under Settings → Developer options to scan.');
            return;
          }
          setDailyLimitOpen(true);
          return;
        }
        throw new Error(
          (data as { error?: string } | null)?.error ??
            `Scan failed (${res.status}).`,
        );
      }
      if (!data || !Array.isArray(data.items)) {
        throw new Error('Received an invalid response from the scanner.');
      }
      setDeveloperMode(data.developer === true);

      const newItems = data.items
        .filter((it) => it && typeof it.name === 'string' && it.name.trim())
        .map((it) => ({
          id: uid(),
          name: it.name.trim(),
          price: Math.max(0, Number(it.price) || 0),
          assigned: [] as string[],
        }));

      if (newItems.length === 0) {
        throw new Error('No readable items were found on the receipt.');
      }

      const scannedServiceCharge =
        typeof data.serviceChargePercent === 'number'
          ? data.serviceChargePercent
          : 0;
      const scannedTax =
        typeof data.taxPercent === 'number'
          ? data.taxPercent
          : 0;
      const scannedRoundingAdjustment =
        typeof data.roundingAdjustment === 'number'
          ? data.roundingAdjustment
          : 0;
      setPendingScan({
        image: imageDataUrl,
        scan: {
          items: newItems,
          restaurantName: data.restaurantName?.trim() || '',
          serviceCharge: scannedServiceCharge,
          tax: scannedTax,
          roundingAdjustment: scannedRoundingAdjustment,
          receiptCharges: data.receiptCharges,
          printedTotal: data.printedTotal,
          reviewNotes: data.reviewNotes,
        },
      });
    } catch (err) {
      if (!serverResponded) logEvent('scan_client_error', { code: 'connection_failed' });
      else if (serverSucceeded) logEvent('scan_client_error', { code: 'client_processing_error' });
      setScanError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while scanning.',
      );
    } finally {
      setScanning(false);
    }
  };

  const confirmScan = (scan: ReviewedScan, startNew: boolean) => {
    const nextDraft: BillDraft = {
      ...draft,
      historyId: startNew ? null : draft.historyId,
      restaurantName: startNew ? scan.restaurantName : draft.restaurantName || scan.restaurantName,
      billDate: startNew || !draft.billDate ? new Date().toISOString() : draft.billDate,
      items: scan.items,
      people: startNew ? [] : draft.people,
      paidStatus: startNew ? {} : draft.paidStatus,
      serviceChargeInput: String(scan.serviceCharge),
      taxInput: String(scan.tax),
      roundingAdjustmentInput: String(scan.roundingAdjustment),
      receiptCharges: scan.receiptCharges,
    };
    const saved = saveHistory(nextDraft, startNew ? draft : undefined);
    if (!saved && startNew) return false;
    setItems(nextDraft.items);
    setPeople(nextDraft.people);
    setPaidStatus(nextDraft.paidStatus);
    setServiceChargeInput(nextDraft.serviceChargeInput);
    setTaxInput(nextDraft.taxInput);
    setRoundingAdjustmentInput(nextDraft.roundingAdjustmentInput);
    setReceiptCharges(nextDraft.receiptCharges);
    setRestaurantName(nextDraft.restaurantName);
    setBillDate(nextDraft.billDate);
    setPendingScan(null);
    setRemoval(null);
    setShowUnassignedOnly(false);
    if (saved) showToast(startNew ? 'New bill started. Your previous bill is in History.' : 'Receipt added to the bill.');
    requestAnimationFrame(() => selectStep(nextDraft.people.length === 0 ? 1 : 2, true));
    return true;
  };

  const historyEntry = (source: BillDraft): HistoryEntry | null => {
    const receiptData = snapshotFromDraft(source);
    const { items, people, serviceCharge, tax, roundingAdjustment, receiptCharges, currency } = receiptData;
    const { grandTotal, issue } = computeSplit(items, people, serviceCharge, tax, roundingAdjustment, receiptCharges, currency);
    if (issue === 'invalidAmounts') return null;
    return {
      id: source.historyId ?? uid(),
      date: source.billDate || new Date().toISOString(),
      restaurantName: source.restaurantName.trim() || 'Untitled bill',
      grandTotal,
      itemsCount: items.length,
      receiptData,
    };
  };

  const saveHistory = (nextDraft: BillDraft, previousDraft?: BillDraft) => {
    const entry = historyEntry(nextDraft);
    const previous = previousDraft ? historyEntry(previousDraft) : null;
    if (!entry || (previousDraft && !previous)) {
      showToast('Correct the amounts in the Summary before saving to History.');
      return false;
    }
    const next = [entry, ...(previous ? [previous] : []),
      ...history.filter((h) => h.id !== entry.id && h.id !== previous?.id)].slice(0, 20);
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
      setHistory(next);
      setActiveHistoryId(entry.id);
      if (!nextDraft.billDate) setBillDate(entry.date);
      return true;
    } catch {
      setSaveState('error');
      showToast('Could not save this bill. Free up browser storage and try again.');
      return false;
    }
  };

  const saveCurrentBill = () => saveHistory(draft);

  const requestHistoryEntry = (entry: HistoryEntry) => {
    if (entry.id === activeHistoryId) {
      setHistoryOpen(false);
      showToast('This bill is already open. Your latest changes are shown.');
    } else if (hasCurrentBill) {
      setPendingAction({ type: 'load', entry });
    } else {
      loadHistoryEntry(entry);
    }
  };

  const loadHistoryEntry = (entry: HistoryEntry) => {
    const snap = entry.receiptData;
    cancelRateRequest();
    setHistory((current) => [entry, ...current.filter((saved) => saved.id !== entry.id)].slice(0, 20));
    setActiveHistoryId(entry.id);
    setShowUnassignedOnly(false);
    setScanError(null);
    setRemoval(null);
    setItems(snap.items);
    setPeople(snap.people);
    setPaidStatus(
      Object.fromEntries(snap.people.filter((person) => Object.hasOwn(snap.paidStatus ?? {}, person))
        .map((person) => [person, snap.paidStatus[person]])),
    );
    setRestaurantName(entry.restaurantName === 'Receipt' ? '' : entry.restaurantName);
    setBillDate(entry.date);
    setServiceChargeInput(String(snap.serviceCharge));
    setTaxInput(String(snap.tax));
    setReceiptCharges(snap.receiptCharges);
    setRoundingAdjustmentInput(String(snap.roundingAdjustment ?? 0));
    setCurrency(snap.currency ?? 'MYR');
    setRateInput(
      snap.currency && snap.currency !== 'MYR'
        ? String(snap.myrRate ?? CURRENCIES[snap.currency].defaultRate)
        : '',
    );
    const savedRateSource = isExchangeRateSource(snap.rateSource) ? snap.rateSource : undefined;
    setRateSource(snap.currency && snap.currency !== 'MYR' && snap.myrRate === undefined
      ? { kind: 'estimate' }
      : savedRateSource);
    setHistoryOpen(false);
    showToast(`Loaded ${entry.restaurantName} from history`);
  };

  const startNewBill = () => {
    cancelRateRequest();
    setActiveHistoryId(null);
    setRemoval(null);
    setItems([]);
    setPeople([]);
    setPaidStatus({});
    setRestaurantName('');
    setBillDate('');
    setServiceChargeInput('0');
    setTaxInput('0');
    setReceiptCharges(undefined);
    setRoundingAdjustmentInput('0');
    setCurrency('MYR');
    setRateInput('');
    setRateSource(undefined);
    setShowUnassignedOnly(false);
    setScanError(null);
    showToast('New bill started. Your previous bill is in History.');
  };

  const confirmPendingAction = () => {
    if (!pendingAction) return;
    if (pendingAction.type === 'clear') {
      try {
        window.localStorage.removeItem(HISTORY_STORAGE_KEY);
        setHistory([]);
        setActiveHistoryId(null);
        showToast('History cleared. Your current bill is kept.');
      } catch {
        showToast('Could not clear History. Please try again.');
      }
    } else {
      if (hasCurrentBill && !saveCurrentBill()) return;
      if (pendingAction.type === 'load') loadHistoryEntry(pendingAction.entry);
      else startNewBill();
    }
    setPendingAction(null);
  };

  const addPerson = (name: string) => {
    if (people.some((p) => p.toLowerCase() === name.toLowerCase())) {
      showToast('That name is already added.');
      return false;
    }
    if (removal?.type === 'person' && removal.name.toLowerCase() === name.toLowerCase()) setRemoval(null);
    setPeople((prev) => [...prev, name]);
    return true;
  };

  const removePerson = (name: string) => {
    const index = people.indexOf(name);
    if (index === -1) return;
    setRemoval({
      type: 'person', index, name, paid: Object.hasOwn(paidStatus, name) ? paidStatus[name] : undefined,
      itemIds: new Set(items.filter((item) => item.assigned.includes(name)).map((item) => item.id)),
    });
    setPeople((prev) => prev.filter((p) => p !== name));
    setPaidStatus((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        assigned: it.assigned.filter((a) => a !== name),
      })),
    );
  };

  const setPersonPaid = (person: string, paid: boolean) => {
    if (paid && (calc.issue || unassignedCount > 0 || items.length === 0 || !Object.hasOwn(calc.perPerson, person))) return;
    if (paid) {
      setPaidStatus((prev) => ({ ...prev, [person]: paymentMark(calc.perPerson[person].final, currency, myrRate) }));
      return;
    }
    setPaidStatus((prev) => {
      const next = { ...prev };
      delete next[person];
      return next;
    });
  };

  const resetPaidStatus = () => {
    setPaidStatus({});
  };

  const addManualItem = (name: string, price: number) => {
    setItems((prev) => [
      ...prev,
      {
        id: uid(),
        name,
        price: Math.round(price * 100) / 100,
        assigned: [],
      },
    ]);
  };

  const removeItem = (id: string) => {
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return;
    setRemoval({ type: 'item', index, item: items[index] });
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const closeRemoval = () => {
    const section = removal?.type === 'person' ? peopleSectionRef.current : itemsSectionRef.current;
    section?.focus({ preventScroll: true });
    setRemoval(null);
  };

  const undoRemoval = () => {
    if (!removal) return;
    if (removal.type === 'person') {
      const { index, name, paid, itemIds } = removal;
      setPeople((current) => [...current.slice(0, index), name, ...current.slice(index)]);
      if (paid) setPaidStatus((current) => ({ ...current, [name]: paid }));
      setItems((current) => current.map((item) => itemIds.has(item.id)
        ? { ...item, assigned: [...item.assigned, name] }
        : item));
      showToast(`Restored ${name} and their assignments.`);
    } else {
      const { index, item } = removal;
      const restored = { ...item, assigned: item.assigned.filter((person) => people.includes(person)) };
      setItems((current) => [...current.slice(0, index), restored, ...current.slice(index)]);
      showToast(`Restored ${item.name}.`);
    }
    closeRemoval();
  };

  const updateItem = (id: string, name: string, price: number) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, name, price } : item));
  };

  const updateAssignment = (id: string, assignees: string[]) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, assigned: assignees } : item));
  };

  const assignSelected = (ids: string[], assignees: string[]) => {
    const selected = new Set(ids);
    setItems((current) => current.map((item) => selected.has(item.id)
      ? { ...item, assigned: [...new Set([...item.assigned, ...assignees])] }
      : item));
    showToast(`Updated assignments for ${ids.length} ${ids.length === 1 ? 'item' : 'items'}.`);
  };

  const peopleSet = new Set(people);
  const unassignedCount = items.filter((item) => !item.assigned.some((person) => peopleSet.has(person))).length;

  const currentStep = items.length === 0 ? 0 : people.length === 0 ? 1 : unassignedCount > 0 ? 2 : 3;

  const enterItemsManually = () => {
    flushSync(() => {
      setDailyLimitOpen(false);
      setShowUnassignedOnly(false);
    });

    const input = manualNameInputRef.current;
    if (!input) return;
    input.scrollIntoView({ behavior: 'instant', block: 'start' });
    input.focus({ preventScroll: true });
  };

  const selectStep = (step: number, showOnlyUnassigned = unassignedCount > 0) => {
    if (step === 2) setShowUnassignedOnly(showOnlyUnassigned);
    const section = [scannerSectionRef, peopleSectionRef, itemsSectionRef, reviewSectionRef][step]?.current;
    if (!section) return;
    section.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    const target = step === 1 ? section.querySelector('input') : step === 0 ? section.querySelector<HTMLButtonElement>('button[aria-label="Take a receipt photo"]') : section;
    (target?.matches(':enabled') ? target : section).focus({ preventScroll: true });
  };

  const cancelRateRequest = () => {
    rateRequest.current?.abort();
    rateRequest.current = null;
    setFetchingRate(false);
  };

  const handleCurrencyChange = (code: CurrencyCode) => {
    cancelRateRequest();
    setCurrency(code);
    setRateInput(code === 'MYR' ? '' : String(CURRENCIES[code].defaultRate));
    setRateSource(code === 'MYR' ? undefined : { kind: 'estimate' });
  };

  const handleRateChange = (value: string) => {
    cancelRateRequest();
    setRateInput(value);
    setRateSource({ kind: 'manual' });
  };

  const fetchExchangeRate = async () => {
    if (currency === 'MYR' || rateRequest.current) return;
    const request = new AbortController();
    rateRequest.current = request;
    const timeout = setTimeout(() => request.abort(), 8000);
    setFetchingRate(true);
    try {
      const res = await fetch(
        `https://api.frankfurter.dev/v2/rate/${currency.toLowerCase()}/myr`,
        { signal: request.signal },
      );
      if (!res.ok) throw new Error('bad status');
      const referenceRate = parseReferenceRate(await res.json(), currency);
      if (!referenceRate) throw new Error('bad rate');
      if (rateRequest.current !== request) return;
      setRateInput(String(referenceRate.rate));
      setRateSource({ kind: 'frankfurter', date: referenceRate.date });
    } catch {
      if (rateRequest.current === request) {
        showToast('Could not refresh the exchange rate. Try again or enter a rate manually.');
      }
    } finally {
      clearTimeout(timeout);
      if (rateRequest.current === request) {
        rateRequest.current = null;
        setFetchingRate(false);
      }
    }
  };

  const handleCameraCapture = (dataUrl: string) => {
    setCameraOpen(false);
    void scanReceipt(dataUrl);
  };

  const handleCameraNativeFile = (file: File) => {
    setCameraOpen(false);
    void handleFileSelected(file);
  };

  const calc = useMemo<SplitResult>(
    () =>
      computeSplit(
        items,
        people,
        Number(serviceChargeInput),
        Number(taxInput),
        Number(roundingAdjustmentInput),
        receiptCharges,
        currency,
      ),
    [items, people, serviceChargeInput, taxInput, roundingAdjustmentInput, receiptCharges, currency],
  );
  const receiptChargesNeedReview = Boolean(receiptCharges &&
    (receiptCharges.discount !== undefined || receiptCharges.serviceAmount !== undefined || receiptCharges.taxAmount !== undefined) &&
    receiptCharges.reviewedSubtotal !== calc.subtotal);

  const openShareModal = () => {
    if (calc.issue) return;
    logEvent('share_summary_tapped');
    if (items.length === 0 || people.length === 0) {
      showToast('Add items and people first.');
      return;
    }
    if (unassignedCount > 0) {
      setShowUnassignedOnly(true);
      showToast(`Assign the remaining ${unassignedCount} item(s) before sharing.`);
      requestAnimationFrame(() => selectStep(2));
      return;
    }
    if (receiptChargesNeedReview) {
      setReceiptChargesOpen(true);
      return;
    }
    const bill: SharedBill = {
      restaurantName: restaurantName.trim() || 'Kira-Kira Bill',
      date: billDate || new Date().toISOString(),
      currency,
      myrRate: currency === 'MYR' ? 1 : myrRate,
      people,
      perPerson: Object.fromEntries(
        people.map((p) => {
          const entry = calc.perPerson[p];
          return [
            p,
            {
              items: entry.items.map((it) => ({ name: it.name, share: it.share })),
              final: entry.final,
            },
          ];
        }),
      ),
      subtotal: calc.subtotal,
      discount: calc.discount,
      serviceCharge: calc.serviceCharge,
      serviceAmt: calc.serviceAmt,
      tax: calc.tax,
      taxAmt: calc.taxAmt,
      roundingAdjustment: calc.roundingAdjustment,
      grandTotal: calc.grandTotal,
      bankDetails: bankDetails.trim(),
      qrPayload,
    };
    setShare({ bill, calc });
  };

  const saveSettings = (
    bankDetails: string,
    qrCode: string,
    qrPayload: string,
  ) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, bankDetails);
      window.localStorage.setItem(QR_STORAGE_KEY, qrCode);
      window.localStorage.setItem(QR_PAYLOAD_STORAGE_KEY, qrPayload);
    } catch {
      showToast('Payment settings could not be saved. Free up browser storage and try again.');
      return;
    }
    setBankDetails(bankDetails);
    setPaymentQrCode(qrCode);
    setQrPayload(qrPayload);
    setSettingsOpen(false);
    showToast('Payment settings saved');
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-100 antialiased">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-transparent">
        <Header
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenHistory={() => setHistoryOpen(true)}
          scansRemaining={developerMode ? null : scansRemaining}
        />

        <main aria-busy={!storageReady} className="space-y-5 px-4 pt-3">
          {(hasCurrentBill || saveState === 'error') && <details className="group rounded-2xl border border-white/10">
            <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-4 py-2 text-sm [&::-webkit-details-marker]:hidden">
              <span className="font-semibold">Bill Actions</span>
              <span role="status" className={`min-w-0 flex-1 text-right text-xs ${saveState === 'error' ? 'font-semibold text-amber-200' : 'text-slate-300'}`}>
                {saveState === 'loading' ? 'Opening saved bill…' : saveState === 'error' ? 'Bill not saved. Keep this tab open.' : 'Saved on this device'}
              </span>
              <ChevronDown aria-hidden="true" size={16} className="shrink-0 text-slate-300 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-3 border-t border-white/10 px-4 pb-4 pt-3">
              <p className="text-sm leading-relaxed text-slate-300">
                {saveState === 'error' ? 'Browser storage is unavailable or full. Free up space or allow site storage, then retry saving.' : 'Changes save automatically. Reopen this app in the same browser to continue. Clearing site data removes saved bills.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!storageReady || !hasCurrentBill} onClick={() => { if (saveCurrentBill()) showToast('Saved to History. Further changes will update this bill.'); }} className="flex min-h-11 items-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500/15 px-3 text-sm font-semibold text-blue-100 disabled:opacity-50"><Save size={18} />{saveState === 'error' ? 'Retry Saving' : activeHistoryId ? 'Save Bill' : 'Save to History'}</button>
                <button type="button" disabled={!storageReady || !hasCurrentBill || scanning} onClick={() => setPendingAction({ type: 'new' })} className="min-h-11 rounded-xl border border-white/20 px-3 text-sm font-semibold text-slate-200 disabled:opacity-50">New Bill</button>
              </div>
              {activeHistoryId && <p className="text-sm text-slate-300">This bill is also in History. Its saved copy updates as you edit.</p>}
            </div>
          </details>}
          {hasCurrentBill && <BillFlowGuide currentStep={currentStep} hasItems={items.length > 0} hasPeople={people.length > 0} unassignedCount={unassignedCount} onSelectStep={selectStep} />}

          <div ref={scannerSectionRef} tabIndex={-1} aria-label="Scan or Add Items" className="bill-scroll-target rounded-2xl">
            <ReceiptScanner
              scanning={scanning}
              scanError={scanError}
              onSelect={handleFileSelected}
              onOpenCamera={() => setCameraOpen(true)}
              onEnterManually={enterItemsManually}
            />
          </div>

          <div ref={peopleSectionRef} tabIndex={-1} aria-label="Add People" className="bill-scroll-target rounded-2xl">
            <PeopleManager
              people={people}
              onAdd={addPerson}
              onRemove={removePerson}
            />
          </div>

          <div ref={itemsSectionRef} tabIndex={-1} aria-label="Bill items and assignments" className="bill-scroll-target rounded-2xl">
            <ItemList
              items={items}
              people={people}
              onAddManualItem={addManualItem}
              onRemoveItem={removeItem}
              onUpdateItem={updateItem}
              onUpdateAssignment={updateAssignment}
              onAssignSelected={assignSelected}
              showUnassignedOnly={showUnassignedOnly}
              onFilterChange={setShowUnassignedOnly}
              currency={currency}
              myrRate={myrRate}
              manualNameInputRef={manualNameInputRef}
            />
          </div>

          <div id="bill-charges" tabIndex={-1} aria-label="Charges and currency" className="bill-scroll-target rounded-2xl">
            <ChargesSection
              serviceChargeInput={serviceChargeInput}
              taxInput={taxInput}
              roundingAdjustmentInput={roundingAdjustmentInput}
              receiptCharges={receiptCharges}
              receiptChargesNeedReview={receiptChargesNeedReview}
              onReviewReceiptCharges={() => setReceiptChargesOpen(true)}
              onServiceChargeChange={(value) => {
                setServiceChargeInput(value);
                setReceiptCharges((current) => current && { ...current, serviceAmount: undefined });
              }}
              onTaxChange={(value) => {
                setTaxInput(value);
                setReceiptCharges((current) => current && { ...current, taxAmount: undefined });
              }}
              onRoundingAdjustmentChange={setRoundingAdjustmentInput}
              currency={currency}
              onCurrencyChange={handleCurrencyChange}
              rateInput={rateInput}
              rateSource={rateSource}
              onRateChange={handleRateChange}
              onFetchRate={() => void fetchExchangeRate()}
              fetchingRate={fetchingRate}
            />
          </div>

          <div ref={reviewSectionRef} tabIndex={-1} aria-label="Review split" className="bill-scroll-target rounded-2xl">
            <SummarySection
              unassignedCount={unassignedCount}
              people={people}
              calc={calc}
              paidStatus={paidStatus}
              onSetPaid={setPersonPaid}
              onResetPaid={resetPaidStatus}
              paymentQrCode={paymentQrCode}
              onShowQr={() => setQrModalOpen(true)}
              onShare={items.length > 0 ? openShareModal : undefined}
              receiptChargesNeedReview={receiptChargesNeedReview}
              currency={currency}
              myrRate={myrRate}
            />
          </div>
        </main>

        {removal && (
          <div className="fixed inset-x-4 bottom-[calc(max(1.5rem,env(safe-area-inset-bottom))+3.25rem)] z-[51] mx-auto flex max-w-sm items-center gap-2 rounded-2xl border border-white/15 bg-slate-900 p-2 pl-4 text-sm text-white shadow-xl">
            <p role="status" className="line-clamp-2 min-w-0 flex-1 break-words">{removal.type === 'person' ? `${removal.name} and their assignments removed.` : `${removal.item.name} removed.`}</p>
            <button ref={undoButtonRef} type="button" onClick={undoRemoval} className="min-h-11 rounded-xl bg-blue-600/25 px-3 font-semibold text-blue-100 hover:bg-blue-600/40">Undo</button>
            <button type="button" onClick={closeRemoval} aria-label="Dismiss removal notice" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10"><X size={17} /></button>
          </div>
        )}

        {currentStep > 0 && <button
          type="button"
          onClick={() => selectStep(currentStep)}
          className="glass-action fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex min-h-11 -translate-x-1/2 items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 text-sm font-semibold text-white transition active:scale-95"
        >
          <ArrowRight aria-hidden="true" size={16} />
          {['', 'Add people', `Assign ${unassignedCount} remaining item${unassignedCount === 1 ? '' : 's'}`, 'Review split'][currentStep]}
        </button>}

        <Footer />

        {pendingScan && <ScanReviewModal
          scan={pendingScan.scan}
          image={pendingScan.image}
          currency={currency}
          existingItems={items}
          existingTotals={calc}
          existingChargesNeedReview={receiptChargesNeedReview}
          onConfirm={confirmScan}
          onClose={() => setPendingScan(null)}
        />}

        {receiptChargesOpen && <ReceiptChargesModal
          charges={receiptCharges ?? {}}
          subtotal={calc.subtotal}
          currency={currency}
          onSave={(charges) => {
            setReceiptCharges(charges);
            setReceiptChargesOpen(false);
          }}
          onClose={() => setReceiptChargesOpen(false)}
        />}

        <SettingsModal
          open={settingsOpen}
          initialBankDetails={bankDetails}
          initialQrCode={paymentQrCode}
          initialQrPayload={qrPayload}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
          onNotify={showToast}
          developerMode={developerMode}
          scanning={scanning}
          onDeveloperModeChange={setDeveloperMode}
        />

        <PaymentQrModal
          open={qrModalOpen}
          qrCode={paymentQrCode}
          bankDetails={bankDetails}
          onClose={() => setQrModalOpen(false)}
        />

        {share && <ShareModal bill={share.bill} calc={share.calc} onClose={() => setShare(null)} />}

        <HistoryModal
          open={historyOpen}
          entries={history}
          onClose={() => setHistoryOpen(false)}
          onSelectEntry={requestHistoryEntry}
          onClear={() => setPendingAction({ type: 'clear' })}
          loadingDisabled={scanning}
        />

        <CropModal
          open={!!cropImage}
          imageSrc={cropImage ?? ''}
          onCrop={(dataUrl) => void scanReceipt(dataUrl)}
          onSkip={() => {
            if (cropImage) void scanReceipt(cropImage);
          }}
          onClose={() => setCropImage(null)}
        />

        <CameraModal
          open={cameraOpen}
          onCapture={handleCameraCapture}
          onNativeCapture={handleCameraNativeFile}
          onClose={() => setCameraOpen(false)}
        />

        <DailyScanLimitModal
          open={dailyLimitOpen}
          onClose={() => setDailyLimitOpen(false)}
          onEnterManually={enterItemsManually}
        />

        {pendingAction && <ConfirmModal
          title={pendingAction.type === 'clear' ? 'Clear saved history?' : pendingAction.type === 'load' ? `Load ${pendingAction.entry.restaurantName}?` : 'Start a new bill?'}
          description={pendingAction.type === 'clear' ? 'All bills in History will be removed from this browser. Your current bill will stay open and saved as a draft. This cannot be undone.' : pendingAction.type === 'load' ? 'Loading this saved bill replaces the bill on screen. Your current bill will be saved to History first, so you can return to it.' : 'Your current bill will be saved to History before a new, empty bill opens.'}
          confirmLabel={pendingAction.type === 'clear' ? 'Clear History' : pendingAction.type === 'load' ? 'Save & Load Bill' : 'Save & Start New'}
          error={pendingAction.type !== 'clear' && saveState === 'error' ? 'Could not save your current bill. Free up browser storage and try again. Your current bill is still open.' : undefined}
          onConfirm={confirmPendingAction}
          onClose={() => setPendingAction(null)}
        />}
        {toast && <Toast message={toast} />}
      </div>
    </div>
  );
}
