'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Download, RefreshCw, Search, WalletCards } from 'lucide-react';

type OrderRecord = {
  id: string;
  storeId?: string;
  storeName?: string;
  merchantName?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customer?: { name?: string; email?: string; phone?: string };
  finalTotal?: number;
  final_total?: number;
  amountPaid?: number;
  amount?: number;
  amountMinor?: number;
  currency?: string;
  paymentStatus?: string;
  splitStatus?: string;
  subaccountStatus?: string;
  paystackReference?: string;
  reference?: string;
  manualSettlementId?: string;
  settlementRequired?: boolean;
  settlementStatus?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createTime?: string | null;
  updateTime?: string | null;
};

type SettlementRecord = {
  id: string;
  settlementId?: string;
  orderId: string;
  storeId?: string;
  storeName?: string;
  storeDisplayName?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerPaid?: number;
  totalPaid?: number;
  sedifexFee?: number;
  storePayable?: number;
  storeSplitPercent?: number;
  currency?: string;
  paystackReference?: string;
  subaccountCode?: string;
  subaccountStatus?: string;
  splitStatus?: string;
  payoutStatus?: string;
  payoutMethod?: string | null;
  payoutReference?: string | null;
  payoutNote?: string | null;
  reason?: string;
  paidAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  createTime?: string | null;
  updateTime?: string | null;
};

type View = 'pending' | 'paid' | 'all' | 'needs-ledger';

function clean(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return fallback;
}

function lower(value: unknown) {
  return clean(value).toLowerCase().replace(/\s+/g, '_');
}

function amountNumber(order: OrderRecord) {
  const values = [order.finalTotal, order.final_total, order.amountPaid, order.amount, typeof order.amountMinor === 'number' ? order.amountMinor / 100 : undefined];
  const amount = values.find((value) => typeof value === 'number' && Number.isFinite(value));
  return typeof amount === 'number' ? amount : 0;
}

function money(value: unknown, currency = 'GHS') {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `${currency || 'GHS'} ${amount.toFixed(2)}`;
}

function timestampToMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === 'object') {
    const candidate = value as { seconds?: unknown; _seconds?: unknown };
    const seconds = typeof candidate.seconds === 'number' ? candidate.seconds : typeof candidate._seconds === 'number' ? candidate._seconds : null;
    return seconds !== null ? seconds * 1000 : null;
  }
  return null;
}

function formatDate(value: unknown) {
  const millis = timestampToMillis(value);
  if (millis === null) return '—';
  return new Date(millis).toLocaleString();
}

function storeLabel(record: OrderRecord | SettlementRecord) {
  return clean(record.storeName || ('merchantName' in record ? record.merchantName : '') || ('storeDisplayName' in record ? record.storeDisplayName : '') || record.storeId, 'Unknown store');
}

function buyerName(order: OrderRecord) {
  return clean(order.customer?.name || order.customerName, 'Unknown buyer');
}

function buyerPhone(order: OrderRecord) {
  return clean(order.customer?.phone || order.customerPhone, 'No phone');
}

function buyerEmail(order: OrderRecord) {
  return clean(order.customer?.email || order.customerEmail, 'No email');
}

function isPaidOrder(order: OrderRecord) {
  const status = [order.paymentStatus, order.splitStatus, order.settlementStatus].map(lower).join(' ');
  return /paid|success|successful|confirmed/.test(status);
}

function needsManualLedger(order: OrderRecord, settlementsByOrderId: Map<string, SettlementRecord>) {
  if (!order.id || settlementsByOrderId.has(order.id) || order.manualSettlementId) return false;
  if (!isPaidOrder(order)) return false;
  const combined = [order.splitStatus, order.subaccountStatus, order.settlementStatus].map(lower).join(' ');
  return Boolean(order.settlementRequired) || /manual|required|failed|unverified|pending|not_verified/.test(combined);
}

function csvCell(value: string | number) {
  const safe = String(value ?? '').replaceAll('"', '""');
  return `"${safe}"`;
}

function matchesSettlementSearch(settlement: SettlementRecord, query: string) {
  if (!query) return true;
  const haystack = [
    settlement.id,
    settlement.orderId,
    settlement.storeId,
    storeLabel(settlement),
    settlement.customerName,
    settlement.customerEmail,
    settlement.customerPhone,
    settlement.paystackReference,
    settlement.subaccountCode,
    settlement.payoutStatus,
    settlement.reason,
  ].map((value) => clean(value)).join(' ').toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function matchesOrderSearch(order: OrderRecord, query: string) {
  if (!query) return true;
  const haystack = [order.id, storeLabel(order), order.storeId, buyerName(order), buyerPhone(order), buyerEmail(order), order.paymentStatus, order.splitStatus, order.subaccountStatus].map((value) => clean(value)).join(' ').toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export default function SettlementsPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, settlementsRes] = await Promise.all([
        fetch('/api/admin/firestore/integration-orders?limit=250', { cache: 'no-store' }),
        fetch('/api/admin/firestore/manual-settlements?limit=500', { cache: 'no-store' }),
      ]);
      const [ordersJson, settlementsJson] = await Promise.all([ordersRes.json(), settlementsRes.json()]);
      if (!ordersRes.ok || !ordersJson?.ok) throw new Error(ordersJson?.error || 'Failed to load orders.');
      if (!settlementsRes.ok || !settlementsJson?.ok) throw new Error(settlementsJson?.error || 'Failed to load settlements.');
      setOrders((ordersJson.data || []) as OrderRecord[]);
      setSettlements((settlementsJson.data || []) as SettlementRecord[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load settlements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const settlementsByOrderId = useMemo(() => new Map(settlements.map((settlement) => [settlement.orderId, settlement])), [settlements]);
  const needsLedger = useMemo(() => orders.filter((order) => needsManualLedger(order, settlementsByOrderId)), [orders, settlementsByOrderId]);

  const filteredSettlements = useMemo(() => {
    return settlements
      .filter((settlement) => {
        const status = lower(settlement.payoutStatus || 'pending');
        if (view === 'pending') return status !== 'paid';
        if (view === 'paid') return status === 'paid';
        if (view === 'needs-ledger') return false;
        return true;
      })
      .filter((settlement) => matchesSettlementSearch(settlement, query.trim()))
      .sort((a, b) => (timestampToMillis(b.updatedAt || b.updateTime || b.createdAt || b.createTime) || 0) - (timestampToMillis(a.updatedAt || a.updateTime || a.createdAt || a.createTime) || 0));
  }, [settlements, query, view]);

  const filteredNeedsLedger = useMemo(() => {
    return needsLedger.filter((order) => matchesOrderSearch(order, query.trim())).sort((a, b) => (timestampToMillis(b.updatedAt || b.updateTime || b.createdAt || b.createTime) || 0) - (timestampToMillis(a.updatedAt || a.updateTime || a.createdAt || a.createTime) || 0));
  }, [needsLedger, query]);

  const stats = useMemo(() => {
    const pending = settlements.filter((settlement) => lower(settlement.payoutStatus) !== 'paid');
    const paid = settlements.filter((settlement) => lower(settlement.payoutStatus) === 'paid');
    return {
      all: settlements.length,
      pending: pending.length,
      paid: paid.length,
      needsLedger: needsLedger.length,
      pendingPayable: pending.reduce((sum, settlement) => sum + (settlement.storePayable || 0), 0),
      paidPayable: paid.reduce((sum, settlement) => sum + (settlement.storePayable || 0), 0),
    };
  }, [settlements, needsLedger]);

  const createSettlement = async (order: OrderRecord) => {
    setBusyId(`create-${order.id}`);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settlements/create-from-order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, reason: 'subaccount_unverified_or_split_failed' }),
      });
      const json = await res.json().catch(() => null) as { ok?: boolean; created?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Unable to create settlement.');
      setMessage(json.created ? `Created payout ledger for ${order.id}.` : `Settlement already exists for ${order.id}.`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to create settlement.');
    } finally {
      setBusyId(null);
    }
  };

  const markPaid = async (settlement: SettlementRecord) => {
    const payoutMethod = window.prompt('Payout method? Example: MTN MoMo, Bank transfer, Cash', settlement.payoutMethod || 'MTN MoMo');
    if (payoutMethod === null) return;
    const payoutReference = window.prompt('Transaction/reference number? Optional.', settlement.payoutReference || '');
    if (payoutReference === null) return;
    const payoutNote = window.prompt('Note? Optional.', settlement.payoutNote || '');
    if (payoutNote === null) return;

    setBusyId(`paid-${settlement.id}`);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settlements/mark-paid', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ settlementId: settlement.id, payoutMethod, payoutReference, payoutNote }),
      });
      const json = await res.json().catch(() => null) as { ok?: boolean; alreadyPaid?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Unable to mark paid.');
      setMessage(json.alreadyPaid ? `${settlement.id} was already marked as paid.` : `Marked ${settlement.id} as paid.`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to mark paid.');
    } finally {
      setBusyId(null);
    }
  };

  const downloadCsv = () => {
    const rows = (view === 'needs-ledger' ? filteredNeedsLedger.map((order) => ({
      type: 'needs_ledger', id: order.id, orderId: order.id, store: storeLabel(order), customer: buyerName(order), customerPhone: buyerPhone(order), customerEmail: buyerEmail(order), customerPaid: amountNumber(order), storePayable: '', sedifexFee: '', status: 'needs_ledger', reference: clean(order.paystackReference || order.reference), updated: formatDate(order.updatedAt || order.updateTime || order.createdAt || order.createTime),
    })) : filteredSettlements.map((settlement) => ({
      type: 'settlement', id: settlement.id, orderId: settlement.orderId, store: storeLabel(settlement), customer: clean(settlement.customerName, 'Unknown buyer'), customerPhone: clean(settlement.customerPhone), customerEmail: clean(settlement.customerEmail), customerPaid: settlement.customerPaid || settlement.totalPaid || 0, storePayable: settlement.storePayable || 0, sedifexFee: settlement.sedifexFee || 0, status: clean(settlement.payoutStatus, 'pending'), reference: clean(settlement.paystackReference), updated: formatDate(settlement.updatedAt || settlement.updateTime || settlement.createdAt || settlement.createTime),
    })));
    const headers = ['Type', 'ID', 'Order ID', 'Store', 'Customer', 'Phone', 'Email', 'Customer Paid', 'Store Payable', 'Sedifex Fee', 'Status', 'Reference', 'Updated'];
    const lines = rows.map((row) => [row.type, row.id, row.orderId, row.store, row.customer, row.customerPhone, row.customerEmail, row.customerPaid, row.storePayable, row.sedifexFee, row.status, row.reference, row.updated].map((value) => csvCell(value as string | number)).join(','));
    const blob = new Blob([[headers.map(csvCell).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sedifex-settlements-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              <WalletCards className="h-4 w-4" /> Manual payout ledger
            </div>
            <h2 className="mt-5 max-w-4xl text-3xl font-bold tracking-tight sm:text-4xl">Track money Sedifex must manually send to stores.</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
              Create one settlement per paid order when Paystack split is unavailable, then mark the store payout as paid after mobile money or bank transfer.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/15">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button type="button" onClick={downloadCsv} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950 hover:bg-slate-100">
              <Download className="h-4 w-4" /> Download CSV
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" onClick={() => setView('pending')} className={`rounded-2xl border p-4 text-left shadow-sm ${view === 'pending' ? 'border-amber-300 bg-amber-50 ring-4 ring-amber-100' : 'border-slate-200 bg-white'}`}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending payouts</p><p className="mt-2 text-2xl font-bold text-slate-950">{stats.pending}</p><p className="mt-1 text-xs text-amber-700">{money(stats.pendingPayable)}</p></button>
        <button type="button" onClick={() => setView('paid')} className={`rounded-2xl border p-4 text-left shadow-sm ${view === 'paid' ? 'border-emerald-300 bg-emerald-50 ring-4 ring-emerald-100' : 'border-slate-200 bg-white'}`}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paid payouts</p><p className="mt-2 text-2xl font-bold text-slate-950">{stats.paid}</p><p className="mt-1 text-xs text-emerald-700">{money(stats.paidPayable)}</p></button>
        <button type="button" onClick={() => setView('needs-ledger')} className={`rounded-2xl border p-4 text-left shadow-sm ${view === 'needs-ledger' ? 'border-indigo-300 bg-indigo-50 ring-4 ring-indigo-100' : 'border-slate-200 bg-white'}`}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Needs ledger</p><p className="mt-2 text-2xl font-bold text-slate-950">{stats.needsLedger}</p><p className="mt-1 text-xs text-indigo-700">Paid orders without settlement</p></button>
        <button type="button" onClick={() => setView('all')} className={`rounded-2xl border p-4 text-left shadow-sm ${view === 'all' ? 'border-slate-400 bg-slate-50 ring-4 ring-slate-100' : 'border-slate-200 bg-white'}`}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">All ledgers</p><p className="mt-2 text-2xl font-bold text-slate-950">{stats.all}</p><p className="mt-1 text-xs text-slate-500">manualSettlements</p></button>
      </section>

      {message ? <p className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm font-semibold text-indigo-800">{message}</p> : null}
      {error ? <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center rounded-2xl border border-slate-200 px-3 focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order ID, store, buyer, phone, Paystack reference, status" className="w-full border-0 bg-transparent px-3 py-3 text-sm outline-none" />
        </div>

        {loading ? <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Loading settlements…</p> : null}

        {!loading && view === 'needs-ledger' ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="hidden grid-cols-[1fr_0.9fr_0.75fr_0.8fr_0.9fr] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
              <span>Buyer</span><span>Store</span><span>Paid</span><span>Split issue</span><span>Action</span>
            </div>
            <div className="divide-y divide-slate-100">
              {filteredNeedsLedger.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No paid orders need a manual settlement ledger.</div> : null}
              {filteredNeedsLedger.slice(0, 100).map((order) => (
                <div key={order.id} className="grid gap-4 px-4 py-4 text-sm xl:grid-cols-[1fr_0.9fr_0.75fr_0.8fr_0.9fr] xl:items-center">
                  <div><p className="font-semibold text-slate-950">{buyerName(order)}</p><p className="text-xs text-slate-500">{buyerPhone(order)} · {buyerEmail(order)}</p><p className="mt-1 break-all text-xs text-slate-400">{order.id}</p></div>
                  <div><p className="font-semibold text-slate-950">{storeLabel(order)}</p><p className="break-all text-xs text-slate-500">{order.storeId || 'No store ID'}</p></div>
                  <div><p className="font-bold text-slate-950">{money(amountNumber(order), order.currency || 'GHS')}</p><p className="text-xs text-slate-500">{clean(order.paystackReference || order.reference, 'No reference')}</p></div>
                  <div><p className="text-xs font-bold uppercase text-amber-700">{clean(order.subaccountStatus || order.splitStatus || order.settlementStatus, 'manual required')}</p><p className="text-xs text-slate-500">{formatDate(order.updatedAt || order.updateTime || order.createdAt || order.createTime)}</p></div>
                  <div><button type="button" disabled={Boolean(busyId)} onClick={() => createSettlement(order)} className="rounded-full bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busyId === `create-${order.id}` ? 'Creating…' : 'Create ledger'}</button></div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!loading && view !== 'needs-ledger' ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="hidden grid-cols-[0.95fr_0.9fr_0.7fr_0.7fr_0.75fr_0.9fr] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
              <span>Settlement</span><span>Store</span><span>Customer paid</span><span>Store payable</span><span>Status</span><span>Action</span>
            </div>
            <div className="divide-y divide-slate-100">
              {filteredSettlements.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No settlements match this filter.</div> : null}
              {filteredSettlements.slice(0, 150).map((settlement) => {
                const status = lower(settlement.payoutStatus || 'pending');
                const isPaid = status === 'paid';
                const currency = settlement.currency || 'GHS';
                return (
                  <div key={settlement.id} className="grid gap-4 px-4 py-4 text-sm xl:grid-cols-[0.95fr_0.9fr_0.7fr_0.7fr_0.75fr_0.9fr] xl:items-center">
                    <div><p className="font-semibold text-slate-950">{settlement.id}</p><p className="break-all text-xs text-slate-500">Order: {settlement.orderId}</p><p className="mt-1 text-xs text-slate-400">{clean(settlement.paystackReference, 'No Paystack ref')}</p></div>
                    <div><p className="font-semibold text-slate-950">{storeLabel(settlement)}</p><p className="break-all text-xs text-slate-500">{settlement.storeId || 'No store ID'}</p><p className="text-xs text-slate-400">Split: {settlement.storeSplitPercent || 97}%</p></div>
                    <div><p className="font-bold text-slate-950">{money(settlement.customerPaid || settlement.totalPaid, currency)}</p><p className="text-xs text-slate-500">Fee: {money(settlement.sedifexFee, currency)}</p></div>
                    <div><p className="font-bold text-slate-950">{money(settlement.storePayable, currency)}</p><p className="text-xs text-slate-500">{clean(settlement.subaccountStatus, 'unverified')}</p></div>
                    <div><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${isPaid ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-amber-100 text-amber-800 ring-amber-200'}`}>{isPaid ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />} {isPaid ? 'Paid' : 'Pending'}</span><p className="mt-2 text-xs text-slate-500">{isPaid ? `Paid: ${formatDate(settlement.paidAt)}` : `Created: ${formatDate(settlement.createdAt || settlement.createTime)}`}</p></div>
                    <div>{isPaid ? <p className="text-xs text-slate-500">{clean(settlement.payoutMethod, 'Paid')} {settlement.payoutReference ? `· ${settlement.payoutReference}` : ''}</p> : <button type="button" disabled={Boolean(busyId)} onClick={() => markPaid(settlement)} className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{busyId === `paid-${settlement.id}` ? 'Saving…' : 'Mark as paid'}</button>}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
