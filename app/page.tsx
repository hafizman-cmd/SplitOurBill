'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Share2 } from 'lucide-react';
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
import { encodeBillToUrl, type SharedBill } from './lib/urlState';
import { CURRENCIES, type CurrencyCode } from './lib/currency';
import Header from './components/Header';
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

  const [people, setPeople] = useState<string[]>([]);
  const [paidStatus, setPaidStatus] = useState<Record<string, boolean>>({});
  const [restaurantName, setRestaurantName] = useState('');
  const [billDate, setBillDate] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharePayload, setSharePayload] = useState<{ url: string; text: string } | null>(null);

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
  const manualNameInputRef = useRef<HTMLInputElement>(null);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setBankDetails(saved);
      const savedQr = window.localStorage.getItem(QR_STORAGE_KEY);
      if (savedQr) setPaymentQrCode(savedQr);
      const savedQrPayload = window.localStorage.getItem(QR_PAYLOAD_STORAGE_KEY);
      if (savedQrPayload) setQrPayload(savedQrPayload);
      setHistory(loadHistoryFromStorage());
      window.localStorage.removeItem(ACTIVE_BILL_STORAGE_KEY);
    } catch {
      /* localStorage unavailable */
    }
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

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
    const head = history[0];
    const isRecentSession =
      head !== undefined &&
      Date.now() - new Date(head.date).getTime() < 15 * 60_000;
    const entry: HistoryEntry = isRecentSession
      ? {
          ...head,
          date: nowIso,
          restaurantName,
          grandTotal,
          itemsCount: snapshotItems.length,
          receiptData,
        }
      : {
          id: uid(),
          date: nowIso,
          restaurantName,
          grandTotal,
          itemsCount: snapshotItems.length,
          receiptData,
        };
    const next = [entry, ...history.filter((h) => h.id !== entry.id)].slice(0, 20);
    setHistory(next);
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* localStorage unavailable */
    }
  };

  const loadHistoryEntry = (entry: HistoryEntry) => {
    const snap = entry.receiptData;
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

  const clearHistory = () => {
    setHistory([]);
    try {
      window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      /* localStorage unavailable */
    }
    showToast('History cleared');
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
    setPaidStatus((prev) => {
      const nextStatus = { ...prev, [person]: !prev[person] };
      setHistory((currentHistory) => {
        if (currentHistory.length === 0) return currentHistory;
        const [head, ...rest] = currentHistory;
        const nextHead: HistoryEntry = {
          ...head,
          receiptData: { ...head.receiptData, paidStatus: nextStatus },
        };
        const nextHistory = [nextHead, ...rest];
        try {
          window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
        } catch {
          /* localStorage unavailable */
        }
        return nextHistory;
      });
      return nextStatus;
    });
  };

  const resetPaidStatus = () => {
    const nextStatus = Object.fromEntries(people.map((person) => [person, false]));
    setPaidStatus(nextStatus);
    setHistory((currentHistory) => {
      if (currentHistory.length === 0) return currentHistory;
      const [head, ...rest] = currentHistory;
      const nextHistory = [
        { ...head, receiptData: { ...head.receiptData, paidStatus: nextStatus } },
        ...rest,
      ];
      try {
        window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
      } catch {
        /* localStorage unavailable */
      }
      return nextHistory;
    });
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

  const openShareModal = () => {
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
              raw: entry.raw,
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
    const origin =
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'https://splitourbill.vercel.app';
    const url = `${origin}/view?b=${encodeURIComponent(encodeBillToUrl(sharedBill))}`;
    const text = buildShareText(calc, people, bankDetails, currency, myrRate, url);
    setSharePayload({ url, text });
    setShareModalOpen(true);
  };

  const saveSettings = (
    bankDetails: string,
    qrCode: string,
    qrPayload: string,
  ) => {
    setBankDetails(bankDetails);
    setPaymentQrCode(qrCode);
    setQrPayload(qrPayload);
    try {
      window.localStorage.setItem(STORAGE_KEY, bankDetails);
      window.localStorage.setItem(QR_STORAGE_KEY, qrCode);
      window.localStorage.setItem(QR_PAYLOAD_STORAGE_KEY, qrPayload);
    } catch {
      /* localStorage unavailable */
    }
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

        <main className="space-y-5 px-4 pb-28 pt-3">
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
          onClick={() => currentStep === 3 ? openShareModal() : selectStep(currentStep)}
          className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex h-11 -translate-x-1/2 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-blue-400/30 bg-gradient-to-r from-blue-600 to-blue-500 px-7 text-sm font-semibold text-white shadow-xl shadow-blue-500/35 backdrop-blur-md transition-all active:scale-95"
        >
          {currentStep === 3 ? <Share2 size={16} /> : <ArrowRight size={16} />}
          {['Scan or add items', 'Add people', `Assign ${unassignedCount} item${unassignedCount === 1 ? '' : 's'}`, 'Share Summary'][currentStep]}
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
          onClose={() => setShareModalOpen(false)}
          onNotify={showToast}
        />

        <HistoryModal
          open={historyOpen}
          entries={history}
          onClose={() => setHistoryOpen(false)}
          onSelectEntry={loadHistoryEntry}
          onClear={clearHistory}
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

        {toast && <Toast message={toast} />}
        <InstallChoiceModal />
      </div>
    </div>
  );
}
