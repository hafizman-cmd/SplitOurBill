'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import type { Item, ScanResponse, SplitResult } from './types';
import { QR_STORAGE_KEY, STORAGE_KEY, compressImage, uid } from './lib/utils';
import { buildShareText, computeSplit } from './lib/split';
import Header from './components/Header';
import ReceiptScanner from './components/ReceiptScanner';
import PeopleManager from './components/PeopleManager';
import ItemList from './components/ItemList';
import ChargesSection from './components/ChargesSection';
import SummarySection from './components/SummarySection';
import SettingsModal from './components/SettingsModal';
import PaymentQrModal from './components/PaymentQrModal';
import Toast from './components/Toast';

export default function Home() {
  const [bankDetails, setBankDetails] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paymentQrCode, setPaymentQrCode] = useState('');
  const [qrModalOpen, setQrModalOpen] = useState(false);

  const [people, setPeople] = useState<string[]>([]);

  const [items, setItems] = useState<Item[]>([]);

  const [serviceChargeInput, setServiceChargeInput] = useState('0');
  const [taxInput, setTaxInput] = useState('0');

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

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

    setScanning(true);
    setScanError(null);

    try {
      const imageBase64 = await compressImage(file, 1600);

      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
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
      if (typeof data.serviceChargePercent === 'number') {
        setServiceChargeInput(String(data.serviceChargePercent));
      }
      if (typeof data.taxPercent === 'number') {
        setTaxInput(String(data.taxPercent));
      }
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

  const addPerson = (name: string) => {
    if (people.some((p) => p.toLowerCase() === name.toLowerCase())) {
      showToast('That name is already added.');
      return false;
    }
    setPeople((prev) => [...prev, name]);
    return true;
  };

  const removePerson = (name: string) => {
    setPeople((prev) => prev.filter((p) => p !== name));
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        assigned: it.assigned.filter((a) => a !== name),
      })),
    );
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

  const calc = useMemo<SplitResult>(
    () =>
      computeSplit(
        items,
        people,
        Math.max(0, Number(serviceChargeInput) || 0),
        Math.max(0, Number(taxInput) || 0),
      ),
    [items, people, serviceChargeInput, taxInput],
  );

  const handleShare = async () => {
    if (items.length === 0 || people.length === 0) {
      showToast('Add items and people first.');
      return;
    }
    const text = buildShareText(calc, people, bankDetails);
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Kira-Kira Bill Split', text });
        showToast('Share sheet opened');
      } else {
        await navigator.clipboard.writeText(text);
        showToast('Summary copied to clipboard');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(text);
        showToast('Summary copied to clipboard');
      } catch {
        showToast('Unable to share. Please try again.');
      }
    }
  };

  const saveSettings = (bankDetails: string, qrCode: string) => {
    setBankDetails(bankDetails);
    setPaymentQrCode(qrCode);
    try {
      window.localStorage.setItem(STORAGE_KEY, bankDetails);
      window.localStorage.setItem(QR_STORAGE_KEY, qrCode);
    } catch {
      /* localStorage unavailable */
    }
    setSettingsOpen(false);
    showToast('Payment settings saved');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 antialiased">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-100 shadow-xl sm:shadow-none">
        <Header onOpenSettings={() => setSettingsOpen(true)} />

        <main className="space-y-4 px-4 pb-20 pt-3">
          <ReceiptScanner
            scanning={scanning}
            scanError={scanError}
            onSelect={handleFileSelected}
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
          />

          <ChargesSection
            serviceChargeInput={serviceChargeInput}
            taxInput={taxInput}
            onServiceChargeChange={setServiceChargeInput}
            onTaxChange={setTaxInput}
          />

          <SummarySection
            people={people}
            calc={calc}
            paymentQrCode={paymentQrCode}
            onShowQr={() => setQrModalOpen(true)}
          />
        </main>

        <div className="sticky bottom-4 z-40 mx-4 my-2">
          <div className="rounded-3xl border border-slate-200/50 bg-white/80 p-2 shadow-xl backdrop-blur-md">
            <button
              onClick={() => void handleShare()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-300 transition hover:scale-[1.01] hover:from-indigo-700 hover:to-violet-700 active:scale-[0.98]"
            >
              <Share2 size={18} />
              Share Summary
            </button>
          </div>
        </div>

        <SettingsModal
          open={settingsOpen}
          initialBankDetails={bankDetails}
          initialQrCode={paymentQrCode}
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

        {toast && <Toast message={toast} />}
      </div>
    </div>
  );
}
