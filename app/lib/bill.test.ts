import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Item } from '../types';
import { isHistoryEntry, parseBillDraft, snapshotFromDraft, type BillDraft } from './billStorage';
import { paymentMark, paymentStatus } from './paymentMarks';
import { mergeReceiptTotals } from './receiptMerge';
import { buildShareText, computeSplit } from './split';

const dinner: Item = { id: '1', name: 'Dinner', price: 24, assigned: ['Aina', 'Ben'] };
const drinks: Item = { id: '2', name: 'Drinks', price: 10, assigned: ['Aina', 'Ben'] };
const people = ['Aina', 'Ben'];

test('only the changed share needs payment review', () => {
  const original = computeSplit([dinner], people, 0, 0);
  const marks = people.map((person) => paymentMark(original.perPerson[person].final, 'MYR', 1));
  const updated = computeSplit([dinner, { ...drinks, assigned: ['Aina'] }], people, 0, 0);
  const statuses = people.map((person, index) =>
    paymentStatus(marks[index], paymentMark(updated.perPerson[person].final, 'MYR', 1)));
  assert.deepEqual(statuses, ['review', 'paid']);
  assert.equal(marks[0].amount, 12);
});

test('payment review accounts for currency and the displayed MYR settlement amount', () => {
  const mark = paymentMark(10, 'SGD', 3.3);
  assert.equal(paymentStatus(mark, paymentMark(10, 'SGD', 3.3001)), 'paid');
  assert.equal(paymentStatus(mark, paymentMark(10, 'SGD', 3.4)), 'review');
  assert.equal(paymentStatus(mark, paymentMark(10, 'MYR', 1)), 'review');
  assert.equal(paymentStatus(mark, paymentMark(10, 'SGD', 0)), 'review');
});

test('current drafts and history accept legacy and amount-based payment marks', () => {
  const draft: BillDraft = {
    version: 1,
    historyId: 'bill',
    restaurantName: 'Cafe',
    billDate: '2026-01-01T00:00:00.000Z',
    items: [dinner],
    people,
    paidStatus: { Aina: true, Ben: false },
    serviceChargeInput: '0',
    taxInput: '0',
    roundingAdjustmentInput: '0',
    currency: 'MYR',
    rateInput: '',
  };
  const legacy = parseBillDraft(JSON.stringify(draft));
  assert.ok(legacy);
  assert.equal(paymentStatus(legacy.paidStatus.Aina, paymentMark(12, 'MYR', 1)), 'review');
  assert.equal(paymentStatus(legacy.paidStatus.Ben, paymentMark(12, 'MYR', 1)), 'unpaid');

  draft.paidStatus.Aina = paymentMark(12, 'MYR', 1);
  const restored = parseBillDraft(JSON.stringify(draft));
  assert.ok(restored);
  assert.equal(paymentStatus(restored.paidStatus.Aina, paymentMark(12, 'MYR', 1)), 'paid');
  assert.ok(isHistoryEntry({
    id: 'bill', date: draft.billDate, restaurantName: draft.restaurantName,
    grandTotal: 24, itemsCount: 1, receiptData: snapshotFromDraft(restored),
  }));
  assert.equal(parseBillDraft(JSON.stringify({ ...draft, paidStatus: { Aina: { amount: -12, currency: 'MYR' } } })), null);
});

test('combining receipts retains both sets of reviewed charges and matches the saved split', () => {
  const existing = computeSplit([dinner], people, 10, 0, 0.03, { discount: 4 });
  const scanned = computeSplit([drinks], people, 0, 0, -0.02, { serviceAmount: 1, taxAmount: 0.6, discount: 1 });
  const items = [dinner, drinks];
  const combined = mergeReceiptTotals(items, existing, scanned, 'MYR');
  assert.equal(combined.totals.grandTotal, 32.61);
  assert.deepEqual(combined.receiptCharges, { serviceAmount: 3, taxAmount: 0.6, discount: 5, reviewedSubtotal: 34 });

  const saved = computeSplit(items, people, 0, 0, combined.roundingAdjustment, combined.receiptCharges);
  assert.equal(saved.grandTotal, combined.totals.grandTotal);
  assert.equal(Math.round((saved.perPerson.Aina.final + saved.perPerson.Ben.final) * 100), 3261);

  const text = buildShareText(saved, people, '');
  assert.match(text, /Grand Total: RM 32\.61/);
  assert.match(text, /Tax: RM 0\.60/);
  assert.doesNotMatch(text, /View breakdown/);
});
