'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Download,
  Loader2,
  Plus,
  QrCode,
  Receipt,
  Settings,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';

type Item = {
  id: string;
  name: string;
  price: number;
  assigned: string[];
};

type ScanResponse = {
  items: { name: string; price: number }[];
  serviceChargePercent: number;
  taxPercent: number;
};

type PersonBreakdown = {
  items: { name: string; share: number; coSharers: string[] }[];
  raw: number;
  final: number;
};

const STORAGE_KEY = 'kira-kira.bank-details';
const QR_STORAGE_KEY = 'kira-kira.payment-qr-code';

const formatRM = (n: number) => `RM ${n.toFixed(2)}`;

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const compressImage = (file: File): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 800;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not process the image.'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => reject(new Error('Could not load the image.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });

export default function Home() {
  const [bankDetails, setBankDetails] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState('');
  const [settingsQrDraft, setSettingsQrDraft] = useState('');
  const [qrProcessing, setQrProcessing] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [paymentQrCode, setPaymentQrCode] = useState('');

  const [people, setPeople] = useState<string[]>([]);
  const [personInput, setPersonInput] = useState('');

  const [items, setItems] = useState<Item[]>([]);
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');

  const [serviceChargeInput, setServiceChargeInput] = useState('0');
  const [taxInput, setTaxInput] = useState('0');

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

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

  const openSettings = () => {
    setSettingsDraft(bankDetails);
    setSettingsQrDraft(paymentQrCode);
    setSettingsOpen(true);
  };

  const saveSettings = () => {
    const trimmed = settingsDraft.trim();
    setBankDetails(trimmed);
    setPaymentQrCode(settingsQrDraft);
    try {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
      window.localStorage.setItem(QR_STORAGE_KEY, settingsQrDraft);
    } catch {
      /* localStorage unavailable */
    }
    setSettingsOpen(false);
    showToast('Payment settings saved');
  };

  const handleQrSelected = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file for the QR code.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('QR image is too large. Please use a smaller image.');
      return;
    }

    setQrProcessing(true);
    try {
      const dataUrl = await compressImage(file);
      setSettingsQrDraft(dataUrl);
      showToast('QR code ready — tap Save to keep it');
    } catch {
      showToast('Could not process the QR image.');
    } finally {
      setQrProcessing(false);
      if (qrInputRef.current) qrInputRef.current.value = '';
    }
  };

  const handleFileSelected = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.');
      return;
    }
    if (file.size > 4.5 * 1024 * 1024) {
      showToast('Image is too large. Please use a smaller photo.');
      return;
    }

    setScanning(true);
    setScanError(null);

    try {
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () =>
          reject(new Error('Could not read the selected file.'));
        reader.readAsDataURL(file);
      });

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
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const addPerson = () => {
    const name = personInput.trim();
    if (!name) return;
    if (people.some((p) => p.toLowerCase() === name.toLowerCase())) {
      showToast('That name is already added.');
      return;
    }
    setPeople((prev) => [...prev, name]);
    setPersonInput('');
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

  const addManualItem = () => {
    const name = manualName.trim();
    const price = Number(manualPrice);
    if (!name) {
      showToast('Please enter an item name.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      showToast('Please enter a valid price.');
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        id: uid(),
        name,
        price: Math.round(price * 100) / 100,
        assigned: [],
      },
    ]);
    setManualName('');
    setManualPrice('');
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

  const calc = useMemo(() => {
    const serviceCharge = Math.max(0, Number(serviceChargeInput) || 0);
    const tax = Math.max(0, Number(taxInput) || 0);

    const subtotal = items.reduce((sum, it) => sum + it.price, 0);
    const serviceAmt = (subtotal * serviceCharge) / 100;
    const taxAmt = (subtotal * tax) / 100;
    const grandTotal = subtotal + serviceAmt + taxAmt;
    const multiplier = subtotal > 0 ? grandTotal / subtotal : 0;

    const perPerson: Record<string, PersonBreakdown> = {};
    for (const p of people) {
      perPerson[p] = { items: [], raw: 0, final: 0 };
    }
    for (const it of items) {
      const n = it.assigned.length;
      if (n === 0) continue;
      const share = it.price / n;
      for (const p of it.assigned) {
        if (!(p in perPerson)) continue;
        perPerson[p].items.push({
          name: it.name,
          share,
          coSharers: it.assigned.filter((x) => x !== p),
        });
        perPerson[p].raw += share;
      }
    }
    for (const p of people) {
      perPerson[p].final = perPerson[p].raw * multiplier;
    }

    return {
      subtotal,
      serviceCharge,
      serviceAmt,
      tax,
      taxAmt,
      grandTotal,
      multiplier,
      perPerson,
    };
  }, [items, people, serviceChargeInput, taxInput]);

  const buildShareText = () => {
    const lines: string[] = [];
    lines.push('Kira-Kira - Bill Split Summary');
    lines.push('');
    lines.push(`Subtotal: ${formatRM(calc.subtotal)}`);
    lines.push(
      `Service Charge (${calc.serviceCharge}%): ${formatRM(calc.serviceAmt)}`,
    );
    lines.push(`Tax (${calc.tax}%): ${formatRM(calc.taxAmt)}`);
    lines.push(`Grand Total: ${formatRM(calc.grandTotal)}`);
    lines.push('');

    lines.push('--- Breakdown ---');
    for (const p of people) {
      const entry = calc.perPerson[p];
      lines.push(`${p} pays ${formatRM(entry.final)}`);
      for (const it of entry.items) {
        const shared =
          it.coSharers.length > 0
            ? ` (shared with ${it.coSharers.join(', ')})`
            : '';
        lines.push(`  - ${it.name}: ${formatRM(it.share)}${shared}`);
      }
      if (entry.items.length === 0) lines.push('  (no items assigned)');
    }

    if (bankDetails) {
      lines.push('');
      lines.push('--- Payment (DuitNow / Bank) ---');
      lines.push(bankDetails);
    }

    lines.push('');
    lines.push('Split fairly with Kira-Kira.');
    return lines.join('\n');
  };

  const handleShare = async () => {
    if (items.length === 0 || people.length === 0) {
      showToast('Add items and people first.');
      return;
    }
    const text = buildShareText();
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

  const unassignedCount = items.filter((it) => it.assigned.length === 0).length;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 antialiased">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-100 shadow-xl sm:shadow-none">
        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 text-white shadow-md">
          <div className="flex items-center gap-2">
            <Sparkles size={22} className="text-yellow-300" />
            <div>
              <h1 className="text-lg font-bold leading-tight">Kira-Kira</h1>
              <p className="text-[11px] font-medium text-indigo-200">
                Split bills fairly
              </p>
            </div>
          </div>
          <button
            onClick={openSettings}
            aria-label="Open settings"
            className="rounded-full p-2 transition-colors hover:bg-white/15 active:bg-white/25"
          >
            <Settings size={20} />
          </button>
        </header>

        <main className="flex-1 space-y-5 px-4 pb-36 pt-5">
          {/* AI Receipt Scanner */}
          <section className="overflow-hidden rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
            <div className="mb-3 flex items-center gap-2">
              <Camera size={16} className="text-indigo-600" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                AI Receipt Scanner
              </h2>
            </div>
            <label className="block cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={scanning}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileSelected(file);
                }}
              />
              <div
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
                  scanning
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-indigo-300 bg-indigo-50/60 hover:bg-indigo-100/70'
                }`}
              >
                {scanning ? (
                  <>
                    <Loader2
                      size={28}
                      className="mb-2 animate-spin text-indigo-600"
                    />
                    <p className="text-sm font-semibold text-indigo-700">
                      Scanning receipt...
                    </p>
                    <p className="mt-1 text-xs text-indigo-400">
                      AI is reading your items
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md shadow-indigo-200">
                      <Receipt size={22} />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      Tap to upload a receipt photo
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Items, service charge &amp; tax are detected
                      automatically
                    </p>
                  </>
                )}
              </div>
            </label>
            {scanError && (
              <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                {scanError}
              </p>
            )}
          </section>

          {/* People Management */}
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
            <div className="mb-3 flex items-center gap-2">
              <Users size={16} className="text-indigo-600" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                People
              </h2>
            </div>
            <div className="flex gap-2">
              <input
                value={personInput}
                onChange={(e) => setPersonInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addPerson();
                }}
                placeholder="Friend's name"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
              <button
                onClick={addPerson}
                aria-label="Add person"
                className="flex items-center justify-center rounded-xl bg-indigo-600 px-4 text-white shadow-sm transition active:scale-95 hover:bg-indigo-700"
              >
                <Plus size={18} />
              </button>
            </div>
            {people.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {people.map((p) => (
                  <span
                    key={p}
                    className="flex items-center gap-1.5 rounded-full bg-indigo-100 py-1.5 pl-3 pr-1.5 text-xs font-semibold text-indigo-700"
                  >
                    {p}
                    <button
                      onClick={() => removePerson(p)}
                      aria-label={`Remove ${p}`}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-200/70 text-indigo-600 transition hover:bg-indigo-300 active:scale-90"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">
                Add everyone sharing the bill so items can be assigned.
              </p>
            )}
          </section>

          {/* Item Assignment */}
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt size={16} className="text-indigo-600" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                  Items
                </h2>
              </div>
              {unassignedCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-600">
                  {unassignedCount} unassigned
                </span>
              )}
            </div>

            {items.length > 0 ? (
              <ul className="space-y-3">
                {items.map((it) => (
                  <li
                    key={it.id}
                    className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 break-words text-sm font-semibold text-slate-800">
                        {it.name}
                      </p>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-bold text-slate-700">
                          {formatRM(it.price)}
                        </span>
                        <button
                          onClick={() => removeItem(it.id)}
                          aria-label={`Remove ${it.name}`}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {people.length > 0 ? (
                        people.map((p) => {
                          const assigned = it.assigned.includes(p);
                          return (
                            <button
                              key={p}
                              onClick={() => toggleAssignment(it.id, p)}
                              className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                                assigned
                                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                                  : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
                              }`}
                            >
                              {assigned && <Check size={12} />}
                              {p}
                            </button>
                          );
                        })
                      ) : (
                        <p className="text-xs text-slate-400">
                          Add people above, then tap names to split this item.
                        </p>
                      )}
                    </div>
                    {it.assigned.length > 0 && (
                      <p className="mt-2.5 text-[11px] font-medium text-indigo-600">
                        {formatRM(it.price / it.assigned.length)} each - shared
                        by {it.assigned.length}
                        {it.assigned.length > 1 ? ' people' : ' person'}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-400">
                No items yet. Scan a receipt or add items manually below.
              </p>
            )}

            {/* Manual item add */}
            <div className="mt-4 flex gap-2">
              <input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Item name"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
              <input
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addManualItem();
                }}
                inputMode="decimal"
                placeholder="0.00"
                className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
              <button
                onClick={addManualItem}
                aria-label="Add item"
                className="flex items-center justify-center rounded-xl bg-indigo-600 px-4 text-white shadow-sm transition active:scale-95 hover:bg-indigo-700"
              >
                <Plus size={18} />
              </button>
            </div>
          </section>

          {/* Tax Settings */}
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
              Charges
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                  Service Charge %
                </label>
                <input
                  value={serviceChargeInput}
                  onChange={(e) => setServiceChargeInput(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                  Tax %
                </label>
                <input
                  value={taxInput}
                  onChange={(e) => setTaxInput(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>
          </section>

          {/* Summary */}
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
              Summary
            </h2>

            <div className="space-y-1.5 rounded-2xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200/70">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>{formatRM(calc.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>
                  Service Charge ({calc.serviceCharge}%)
                </span>
                <span>{formatRM(calc.serviceAmt)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tax ({calc.tax}%)</span>
                <span>{formatRM(calc.taxAmt)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-800">
                <span>Grand Total</span>
                <span>{formatRM(calc.grandTotal)}</span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {people.length > 0 ? (
                people.map((p) => {
                  const entry = calc.perPerson[p];
                  const initial = p.charAt(0).toUpperCase();
                  return (
                    <div
                      key={p}
                      className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {p}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {entry.items.length > 0
                              ? `${entry.items.length} item(s) - ${formatRM(entry.raw)} before extras`
                              : 'No items assigned'}
                          </p>
                        </div>
                      </div>
                      <p className="shrink-0 text-lg font-bold text-indigo-600">
                        {formatRM(entry.final)}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-400">
                  Add people to see each person&apos;s final payable amount
                  (their item shares are proportionally scaled up by service
                  charge and tax).
                </p>
              )}
            </div>

            {paymentQrCode && (
              <button
                onClick={() => setQrModalOpen(true)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 py-3 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100 active:scale-[0.98]"
              >
                <QrCode size={16} />
                Show Payment QR Code
              </button>
            )}
          </section>
        </main>

        {/* Sticky Share Button */}
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto max-w-md bg-gradient-to-t from-slate-100 via-slate-100/95 to-transparent px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-6">
            <button
              onClick={() => void handleShare()}
              className="pointer-events-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-300 transition active:scale-[0.98] hover:from-indigo-700 hover:to-violet-700"
            >
              <Share2 size={18} />
              Share Summary
            </button>
          </div>
        </div>

        {/* Settings Modal */}
        {settingsOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 backdrop-blur-sm sm:items-center"
            onClick={() => setSettingsOpen(false)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800">
                  Payment Details
                </h3>
                <button
                  onClick={() => setSettingsOpen(false)}
                  aria-label="Close settings"
                  className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="mb-2 text-xs text-slate-500">
                Saved on this device and included when you share the summary.
              </p>
              <textarea
                value={settingsDraft}
                onChange={(e) => setSettingsDraft(e.target.value)}
                rows={4}
                placeholder={'e.g.\nDuitNow: Maybank\n162112345678\nAlice Tan'}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />

              <div className="mt-5">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  DuitNow / Bank QR Code
                </h4>
                <input
                  ref={qrInputRef}
                  id="qr-code-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={qrProcessing}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleQrSelected(file);
                  }}
                />
                {settingsQrDraft ? (
                  <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
                    <img
                      src={settingsQrDraft}
                      alt="Payment QR code"
                      className="h-16 w-16 shrink-0 rounded-lg object-contain ring-1 ring-slate-200"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-700">
                        QR code ready
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Shown at the table when paying.
                      </p>
                    </div>
                    <button
                      onClick={() => setSettingsQrDraft('')}
                      aria-label="Remove QR code"
                      className="flex shrink-0 items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-100 active:scale-95"
                    >
                      <Trash2 size={12} />
                      Remove
                    </button>
                  </div>
                ) : (
                  <label htmlFor="qr-code-input" className="block cursor-pointer">
                    <div
                      className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3.5 text-xs font-semibold transition ${
                        qrProcessing
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                          : 'border-indigo-300 bg-indigo-50/60 text-indigo-600 hover:bg-indigo-100/70'
                      }`}
                    >
                      {qrProcessing ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Processing image...
                        </>
                      ) : (
                        <>
                          <Upload size={14} />
                          Upload QR Code Image
                        </>
                      )}
                    </div>
                  </label>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSettings}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment QR Modal */}
        {qrModalOpen && paymentQrCode && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
            onClick={() => setQrModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Payment QR code"
          >
            <div
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800">
                  Scan to Pay
                </h3>
                <button
                  onClick={() => setQrModalOpen(false)}
                  aria-label="Close QR code view"
                  className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex justify-center">
                <img
                  src={paymentQrCode}
                  alt="DuitNow / bank payment QR code"
                  className="w-full max-w-[280px] rounded-2xl ring-1 ring-slate-200"
                />
              </div>
              {bankDetails && (
                <p className="mt-3 whitespace-pre-wrap text-center text-xs font-medium text-slate-500">
                  {bankDetails}
                </p>
              )}
              <div className="mt-5 flex gap-2">
                <a
                  href={paymentQrCode}
                  download="kira-kira-payment-qr.jpg"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
                >
                  <Download size={16} />
                  Download
                </a>
                <button
                  onClick={() => setQrModalOpen(false)}
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2.5 text-xs font-semibold text-white shadow-xl backdrop-blur-sm"
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
