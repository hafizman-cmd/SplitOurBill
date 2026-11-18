'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Save, Share2 } from 'lucide-react';
import type { HistoryEntry, Item, ScanResponse, SplitResult } from './types';
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
import { buildShareText, computeSplit } from './lib/split';
import type { SharedBill } from './lib/sharedBill';
import { CURRENCIES, type CurrencyCode } from './lib/currency';
import Header from './components/Header';
import ConfirmModal from './components/ConfirmModal';
import { parseBillDraft, snapshotFromDraft, type BillDraft } from './lib/billStorage';
import BillFlowGuide from './components/BillFlowGuide';
import ScanReviewModal, { type ReviewedScan } from './components/ScanReviewModal';
import ReceiptScanner from './components/ReceiptScanner';
import PeopleManager from './components/PeopleManager';
import ItemList from './components/ItemList';
import ChargesSection from './components/ChargesSection';
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
import DailyScanLimitModal from './components/DailyScanLimitModal';
import InstallChoiceModal from './components/InstallChoiceModal';

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
  const [paidStatus, setPaidStatus] = useState<Record<string, boolean>>({});
  const [restaurantName, setRestaurantName] = useState('');
  const [billDate, setBillDate] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharePayload, setSharePayload] = useState<{ url: string; text: string; whatsappText: string } | null>(null);
  const [creatingShare, setCreatingShare] = useState(false);

  const [items, setItems] = useState<Item[]>([]);

  const [serviceChargeInput, setServiceChargeInput] = useState('0');
  const [taxInput, setTaxInput] = useState('0');
  const [roundingAdjustmentInput, setRoundingAdjustmentInput] = useState('0');

  const [currency, setCurrency] = useState<CurrencyCode>('MYR');
  const [rateInput, setRateInput] = useState('');
  const [fetchingRate, setFetchingRate] = useState(false);
  const myrRate = currency === 'MYR' ? 1 : Math.max(0, Number(rateInput) || 0);

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
    if (scanning) return;
    let active = true;
    const refreshScanStatus = async () => {
      const version = ++scanStatusVersion.current;
      try {
        const response = await fetch('/api/scan', { cache: 'no-store' });
        if (!response.ok) return;
        const data: { remaining?: unknown } = await response.json();
        if (active && version === scanStatusVersion.current && typeof data.remaining === 'number') {
          setScansRemaining(Math.max(0, data.remaining));
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
          setRoundingAdjustmentInput(restored.roundingAdjustmentInput);
          setCurrency(restored.currency);
          setRateInput(restored.rateInput);
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
  }), [activeHistoryId, restaurantName, billDate, items, people, paidStatus, serviceChargeInput, taxInput, roundingAdjustmentInput, currency, rateInput]);
  const hasCurrentBill = items.length > 0 || people.length > 0 || restaurantName.trim() !== '' ||
    serviceChargeInput !== '0' || taxInput !== '0' || roundingAdjustmentInput !== '0' || currency !== 'MYR';

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(ACTIVE_BILL_STORAGE_KEY, JSON.stringify(draft));
      if (draft.historyId && history.some((entry) => entry.id === draft.historyId)) {
        const snapshot = snapshotFromDraft(draft);
        const next = history.map((entry) => entry.id === draft.historyId ? {
          ...entry,
          restaurantName: draft.restaurantName.trim() || 'Untitled bill',
          grandTotal: computeSplit(snapshot.items, snapshot.people, snapshot.serviceCharge, snapshot.tax, snapshot.roundingAdjustment).grandTotal,
          itemsCount: snapshot.items.length,
          receiptData: snapshot,
        } : entry);
        window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
        if (JSON.stringify(next) !== JSON.stringify(history)) setHistory(next);
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
    if (scansRemaining === 0 && !developerMode) {
      setCropImage(null);
      setDailyLimitOpen(true);
      return;
    }

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
          'x-telemetry-session': getSessionId() ?? '',
        },
        body: JSON.stringify({ imageBase64: imageDataUrl }),
      });
      serverResponded = true;
      serverSucceeded = res.ok;

      const data: ScanResponse | null = await res
        .json()
        .catch(() => null as ScanResponse | null);

      if (!res.ok) {
        if (
          res.status === 429 &&
          (data as { error?: string } | null)?.error === 'DAILY_LIMIT_REACHED'
        ) {
          setScansRemaining(0);
          setDeveloperMode(false);
          if (developerMode) {
            setScanError('Developer session expired. Enter the admin password again to scan.');
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
      if (typeof data.remaining === 'number') {
        setScansRemaining(Math.max(0, data.remaining));
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
          : Math.max(0, Number(serviceChargeInput) || 0);
      const scannedTax =
        typeof data.taxPercent === 'number'
          ? data.taxPercent
          : Math.max(0, Number(taxInput) || 0);
      const scannedRoundingAdjustment =
        typeof data.roundingAdjustment === 'number'
          ? data.roundingAdjustment
          : Number(roundingAdjustmentInput) || 0;
      setPendingScan({
        image: imageDataUrl,
        scan: {
          items: newItems,
          restaurantName: data.restaurantName?.trim() || '',
          serviceCharge: scannedServiceCharge,
          tax: scannedTax,
          roundingAdjustment: scannedRoundingAdjustment,
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

  const confirmScan = (scan: ReviewedScan) => {
    const nextItems = [...items, ...scan.items];
    setItems(nextItems);
    setServiceChargeInput(String(scan.serviceCharge));
    setTaxInput(String(scan.tax));
    setRoundingAdjustmentInput(String(scan.roundingAdjustment));
    setRestaurantName(scan.restaurantName);
    setBillDate(new Date().toISOString());
    saveHistory(scan.restaurantName || 'Receipt', nextItems, scan.serviceCharge, scan.tax, scan.roundingAdjustment);
    setPendingScan(null);
    setShowUnassignedOnly(false);
    showToast(`Added ${scan.items.length} reviewed item(s). Assign who shared each one.`);
    requestAnimationFrame(() => selectStep(people.length === 0 ? 1 : 2));
  };

  const saveHistory = (
    restaurantName: string,
    snapshotItems: Item[],
    serviceCharge: number,
    tax: number,
    roundingAdjustment: number,
  ) => {
    const receiptData = {
      items: snapshotItems,
      people,
      paidStatus,
      serviceCharge,
      tax,
      roundingAdjustment,
      currency,
      myrRate: currency === 'MYR' ? 1 : myrRate,
    };
    const { grandTotal } = computeSplit(
      snapshotItems,
      people,
      serviceCharge,
      tax,
      roundingAdjustment,
    );
    const nowIso = new Date().toISOString();
    const entry: HistoryEntry = {
      id: activeHistoryId ?? uid(),
      date: billDate || nowIso,
      restaurantName,
      grandTotal,
      itemsCount: snapshotItems.length,
      receiptData,
    };
    const next = [entry, ...history.filter((h) => h.id !== entry.id)].slice(0, 20);
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
      setHistory(next);
      setActiveHistoryId(entry.id);
      if (!billDate) setBillDate(nowIso);
      return true;
    } catch {
      setSaveState('error');
      showToast('Could not save this bill. Free up browser storage and try again.');
      return false;
    }
  };

  const saveCurrentBill = () => saveHistory(
    restaurantName.trim() || 'Untitled bill', items,
    Math.max(0, Number(serviceChargeInput) || 0),
    Math.max(0, Number(taxInput) || 0), Number(roundingAdjustmentInput) || 0,
  );

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
    setHistory((current) => [entry, ...current.filter((saved) => saved.id !== entry.id)].slice(0, 20));
    setActiveHistoryId(entry.id);
    setShowUnassignedOnly(false);
    setScanError(null);
    setItems(snap.items);
    setPeople(snap.people);
    setPaidStatus(
      Object.fromEntries(snap.people.map((person) => [person, snap.paidStatus?.[person] ?? false])),
    );
    setRestaurantName(entry.restaurantName === 'Receipt' ? '' : entry.restaurantName);
    setBillDate(entry.date);
    setServiceChargeInput(String(snap.serviceCharge));
    setTaxInput(String(snap.tax));
    setRoundingAdjustmentInput(String(snap.roundingAdjustment ?? 0));
    setCurrency(snap.currency ?? 'MYR');
    setRateInput(
      snap.currency && snap.currency !== 'MYR'
        ? String(snap.myrRate ?? CURRENCIES[snap.currency].defaultRate)
        : '',
    );
    setHistoryOpen(false);
    showToast(`Loaded ${entry.restaurantName} from history`);
  };

  const startNewBill = () => {
    setActiveHistoryId(null);
    setItems([]);
    setPeople([]);
    setPaidStatus({});
    setRestaurantName('');
    setBillDate('');
    setServiceChargeInput('0');
    setTaxInput('0');
    setRoundingAdjustmentInput('0');
    setCurrency('MYR');
    setRateInput('');
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
    setPeople((prev) => [...prev, name]);
    setPaidStatus((prev) => ({ ...prev, [name]: false }));
    return true;
  };

  const removePerson = (name: string) => {
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

  const togglePaidStatus = (person: string) => {
    setPaidStatus((prev) => ({ ...prev, [person]: !prev[person] }));
  };

  const resetPaidStatus = () => {
    setPaidStatus(Object.fromEntries(people.map((person) => [person, false])));
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
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const updateItem = (id: string, name: string, price: number) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, name, price } : item));
  };

  const assignEveryone = (id: string) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, assigned: [...people] } : item));
  };

  const unassignedCount = items.filter((item) => item.assigned.length === 0).length;

  const currentStep = items.length === 0 ? 0 : people.length === 0 ? 1 : unassignedCount > 0 ? 2 : 3;

  const selectStep = (step: number) => {
    if (step === 2) setShowUnassignedOnly(unassignedCount > 0);
    const section = [scannerSectionRef, peopleSectionRef, itemsSectionRef, reviewSectionRef][step]?.current;
    if (!section) return;
    section.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    const target = step === 1 ? section.querySelector('input') : step === 0 ? section.querySelector<HTMLButtonElement>('button[aria-label="Take a receipt photo"]') : section;
    target?.focus({ preventScroll: true });
  };

  const toggleAssignment = (itemId: string, person: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              assigned: it.assigned.includes(person)
                ? it.assigned.filter((p) => p !== person)
                : [...it.assigned, person],
            }
          : it,
      ),
    );
  };

  const handleCurrencyChange = (code: CurrencyCode) => {
    setCurrency(code);
    setRateInput(code === 'MYR' ? '' : String(CURRENCIES[code].defaultRate));
  };

  const fetchExchangeRate = async () => {
    if (currency === 'MYR' || fetchingRate) return;
    setFetchingRate(true);
    try {
      const res = await fetch(
        `https://api.frankfurter.app/latest?from=${currency}&to=MYR`,
      );
      if (!res.ok) throw new Error('bad status');
      const data: unknown = await res.json();
      const rate = Number(
        (data as { rates?: { MYR?: number } } | null)?.rates?.MYR,
      );
      if (!Number.isFinite(rate) || rate <= 0) throw new Error('bad rate');
      setRateInput(String(Math.round(rate * 100000) / 100000));
      showToast('Exchange rate updated');
    } catch {
      showToast('Could not fetch the exchange rate. Please enter it manually.');
    } finally {
      setFetchingRate(false);
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
        Math.max(0, Number(serviceChargeInput) || 0),
        Math.max(0, Number(taxInput) || 0),
        Number(roundingAdjustmentInput) || 0,
      ),
    [items, people, serviceChargeInput, taxInput, roundingAdjustmentInput],
  );

  const openShareModal = async () => {
    if (creatingShare) return;
    logEvent('share_summary_tapped');
    if (items.length === 0 || people.length === 0) {
      showToast('Add items and people first.');
      return;
    }
    if (unassignedCount > 0) {
      setShowUnassignedOnly(true);
      showToast(`Assign the remaining ${unassignedCount} item(s) before sharing.`);
      requestAnimationFrame(() => {
        itemsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        itemsSectionRef.current?.focus({ preventScroll: true });
      });
      return;
    }
    const sharedBill: SharedBill = {
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
      serviceCharge: calc.serviceCharge,
      serviceAmt: calc.serviceAmt,
      tax: calc.tax,
      taxAmt: calc.taxAmt,
      roundingAdjustment: calc.roundingAdjustment,
      grandTotal: calc.grandTotal,
      bankDetails: bankDetails.trim(),
      qrPayload,
    };
    setCreatingShare(true);
    try {
      const response = await fetch('/api/shared-bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sharedBill),
      });
      if (!response.ok) {
        showToast(response.status === 429
          ? 'Too many share links created. Try again in a minute.'
          : response.status === 413
            ? 'This bill is too large to share as a link.'
            : 'Couldn’t create the share link. Try again.');
        return;
      }
      const { id } = await response.json();
      const url = `${window.location.origin}/view/${id}`;
      setSharePayload({
        url,
        text: buildShareText(calc, people, bankDetails, currency, myrRate, url),
        whatsappText: buildShareText(calc, people, bankDetails, currency, myrRate, url, 'whatsapp'),
      });
      setShareModalOpen(true);
    } catch {
      showToast('Couldn’t create the share link. Try again.');
    } finally {
      setCreatingShare(false);
    }
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

        <main aria-busy={!storageReady} className="space-y-5 px-4 pb-28 pt-3">
          <section aria-label="Bill saving" className="glass-card space-y-3 p-4">
            <p role="status" aria-live="polite" className={`text-base font-semibold ${saveState === 'error' ? 'text-amber-200' : 'text-slate-100'}`}>
              {saveState === 'loading' ? 'Opening your saved bill...' : saveState === 'error' ? 'Bill not saved. Keep this tab open.' : hasCurrentBill ? 'Current bill saved on this device' : 'Ready for a new bill'}
            </p>
            <p className="text-sm leading-relaxed text-slate-300">
              {saveState === 'error' ? 'Browser storage is unavailable or full. Free up space or allow site storage, then retry saving.' : 'Changes save automatically. Reopen this app in the same browser to continue. Clearing site data removes saved bills.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!storageReady || !hasCurrentBill} onClick={() => { if (saveCurrentBill()) showToast('Saved to History. Further changes will update this bill.'); }} className="flex min-h-11 items-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500/15 px-3 text-sm font-semibold text-blue-100 disabled:opacity-50"><Save size={18} />{saveState === 'error' ? 'Retry saving' : activeHistoryId ? 'Save bill' : 'Save to History'}</button>
              <button type="button" disabled={!storageReady || !hasCurrentBill || scanning} onClick={() => setPendingAction({ type: 'new' })} className="min-h-11 rounded-xl border border-white/20 px-3 text-sm font-semibold text-slate-200 disabled:opacity-50">New bill</button>
            </div>
            {activeHistoryId && <p className="text-sm text-slate-300">This bill is also in History. Its saved copy updates as you edit.</p>}
          </section>
          <BillFlowGuide currentStep={currentStep} hasItems={items.length > 0} hasPeople={people.length > 0} unassignedCount={unassignedCount} onSelectStep={selectStep} />

          <div ref={scannerSectionRef} tabIndex={-1} aria-label="Scan or add items" className="scroll-mt-28 rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
            <ReceiptScanner
              scanning={scanning}
              scanError={scanError}
              developerMode={developerMode}
              onDeveloperModeChange={setDeveloperMode}
              onSelect={handleFileSelected}
              onOpenCamera={() => setCameraOpen(true)}
            />

            <button type="button" onClick={() => { setShowUnassignedOnly(false); requestAnimationFrame(() => manualNameInputRef.current?.focus()); }} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-semibold text-slate-200 hover:bg-white/5">Enter items manually <ArrowRight size={16} /></button>
          </div>

          <div ref={peopleSectionRef} tabIndex={-1} aria-label="Add people" className="scroll-mt-28 rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
            <PeopleManager
              people={people}
              onAdd={addPerson}
              onRemove={removePerson}
            />
          </div>

          <div ref={itemsSectionRef} tabIndex={-1} aria-label="Bill items and assignments" className="scroll-mt-24 rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
            <ItemList
              items={items}
              people={people}
              onAddManualItem={addManualItem}
              onRemoveItem={removeItem}
              onUpdateItem={updateItem}
              onAssignEveryone={assignEveryone}
              showUnassignedOnly={showUnassignedOnly}
              onFilterChange={setShowUnassignedOnly}
              onToggleAssignment={toggleAssignment}
              currency={currency}
              myrRate={myrRate}
              manualNameInputRef={manualNameInputRef}
            />
          </div>

          <div ref={reviewSectionRef} tabIndex={-1} aria-label="Review charges and split" className="scroll-mt-28 space-y-5 rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
            <ChargesSection
              serviceChargeInput={serviceChargeInput}
              taxInput={taxInput}
              roundingAdjustmentInput={roundingAdjustmentInput}
              onServiceChargeChange={setServiceChargeInput}
              onTaxChange={setTaxInput}
              onRoundingAdjustmentChange={setRoundingAdjustmentInput}
              currency={currency}
              onCurrencyChange={handleCurrencyChange}
              rateInput={rateInput}
              onRateChange={setRateInput}
              onFetchRate={() => void fetchExchangeRate()}
              fetchingRate={fetchingRate}
            />

            <SummarySection
              unassignedCount={unassignedCount}
              people={people}
              calc={calc}
              paidStatus={paidStatus}
              onTogglePaid={togglePaidStatus}
              onResetPaid={resetPaidStatus}
              paymentQrCode={paymentQrCode}
              onShowQr={() => setQrModalOpen(true)}
              currency={currency}
              myrRate={myrRate}
            />
          </div>
        </main>

        <button
          type="button"
          onClick={() => currentStep === 3 ? void openShareModal() : selectStep(currentStep)}
          disabled={currentStep === 3 && creatingShare}
          aria-busy={currentStep === 3 && creatingShare}
          className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex h-11 -translate-x-1/2 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-blue-400/30 bg-gradient-to-r from-blue-700 to-blue-600 px-7 text-sm font-semibold text-white shadow-xl shadow-blue-500/35 backdrop-blur-md transition-all active:scale-95"
        >
          {currentStep === 3 ? <Share2 size={16} /> : <ArrowRight size={16} />}
          {['Scan or add items', 'Add people', `Assign ${unassignedCount} item${unassignedCount === 1 ? '' : 's'}`, creatingShare ? 'Creating link…' : 'Share Summary'][currentStep]}
        </button>

        <Footer />

        {pendingScan && <ScanReviewModal
          scan={pendingScan.scan}
          image={pendingScan.image}
          currency={currency}
          existingItems={items}
          onConfirm={confirmScan}
          onClose={() => setPendingScan(null)}
        />}

        <SettingsModal
          open={settingsOpen}
          initialBankDetails={bankDetails}
          initialQrCode={paymentQrCode}
          initialQrPayload={qrPayload}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
          onNotify={showToast}
        />

        <PaymentQrModal
          open={qrModalOpen}
          qrCode={paymentQrCode}
          bankDetails={bankDetails}
          onClose={() => setQrModalOpen(false)}
        />

        <ShareModal
          open={shareModalOpen}
          url={sharePayload?.url ?? ''}
          text={sharePayload?.text ?? ''}
          whatsappText={sharePayload?.whatsappText ?? ''}
          onClose={() => setShareModalOpen(false)}
          onNotify={showToast}
        />

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
          onEnterManually={() => {
            setDailyLimitOpen(false);
            requestAnimationFrame(() => manualNameInputRef.current?.focus());
          }}
        />

        {pendingAction && <ConfirmModal
          title={pendingAction.type === 'clear' ? 'Clear saved history?' : pendingAction.type === 'load' ? `Load ${pendingAction.entry.restaurantName}?` : 'Start a new bill?'}
          description={pendingAction.type === 'clear' ? 'All bills in History will be removed from this browser. Your current bill will stay open and saved as a draft. This cannot be undone.' : pendingAction.type === 'load' ? 'Loading this saved bill replaces the bill on screen. Your current bill will be saved to History first, so you can return to it.' : 'Your current bill will be saved to History before a new, empty bill opens.'}
          confirmLabel={pendingAction.type === 'clear' ? 'Clear History' : pendingAction.type === 'load' ? 'Save & load bill' : 'Save & start new'}
          error={pendingAction.type !== 'clear' && saveState === 'error' ? 'Could not save your current bill. Free up browser storage and try again. Your current bill is still open.' : undefined}
          onConfirm={confirmPendingAction}
          onClose={() => setPendingAction(null)}
        />}
        {toast && <Toast message={toast} />}
        <InstallChoiceModal />
      </div>
    </div>
  );
}
