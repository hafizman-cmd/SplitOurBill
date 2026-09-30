'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
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

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

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
    setCropImage(null);
    setScanning(true);
    setScanError(null);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: imageDataUrl }),
      });

      const data: ScanResponse | null = await res
        .json()
        .catch(() => null as ScanResponse | null);

      if (!res.ok) {
        throw new Error(
          (data as { error?: string } | null)?.error ??
            `Scan failed (${res.status}).`,
        );
      }
      if (!data || !Array.isArray(data.items)) {
        throw new Error('Received an invalid response from the scanner.');
      }

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

      setItems((prev) => [...prev, ...newItems]);
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
      if (typeof data.serviceChargePercent === 'number') {
        setServiceChargeInput(String(data.serviceChargePercent));
      }
      if (typeof data.taxPercent === 'number') {
        setTaxInput(String(data.taxPercent));
      }
      if (typeof data.roundingAdjustment === 'number') {
        setRoundingAdjustmentInput(String(data.roundingAdjustment));
      }
      setRestaurantName(data.restaurantName?.trim() || '');
      setBillDate(new Date().toISOString());
      saveHistory(
        data.restaurantName?.trim() || 'Receipt',
        [...items, ...newItems],
        scannedServiceCharge,
        scannedTax,
        scannedRoundingAdjustment,
      );
      showToast(`Added ${newItems.length} item(s) from receipt`);
    } catch (err) {
      setScanError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while scanning.',
      );
    } finally {
      setScanning(false);
    }
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
    if (items.length === 0 || people.length === 0) {
      showToast('Add items and people first.');
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
        />

        <main className="space-y-5 px-4 pb-28 pt-3">
          <ReceiptScanner
            scanning={scanning}
            scanError={scanError}
            onSelect={handleFileSelected}
            onOpenCamera={() => setCameraOpen(true)}
          />

          <PeopleManager
            people={people}
            onAdd={addPerson}
            onRemove={removePerson}
          />

          <ItemList
            items={items}
            people={people}
            onAddManualItem={addManualItem}
            onRemoveItem={removeItem}
            onToggleAssignment={toggleAssignment}
            currency={currency}
            myrRate={myrRate}
          />

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
        </main>

        <button
          onClick={openShareModal}
          className="fixed bottom-6 left-1/2 z-50 flex h-11 -translate-x-1/2 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-blue-400/30 bg-gradient-to-r from-blue-600 to-blue-500 px-7 text-sm font-semibold text-white shadow-xl shadow-blue-500/35 backdrop-blur-md transition-all active:scale-95"
        >
          <Share2 className="w-4 h-4" />
          Share Summary
        </button>

        <Footer />

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

        {toast && <Toast message={toast} />}
      </div>
    </div>
  );
}
