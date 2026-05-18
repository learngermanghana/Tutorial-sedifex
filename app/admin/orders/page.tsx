'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ShoppingCart } from 'lucide-react';

type OrderRecord = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  source?: string;
  sourceChannel?: string;
  storeId?: string;
  amount?: number;
  amountMinor?: number;
  amountPaid?: number;
  finalTotal?: number;
  paymentStatus?: string;
  orderStatus?: string;
  sourceLabel?: string;
  customerEmail?: string;
  paymentUpdatedAt?: string;
  updated_at?: string;
  customer?: { name?: string; email?: string; phone?: string };
  items?: Array<{
    name?: string;
    productName?: string;
    qty?: number;
    quantity?: number;
    item_type?: string;
    type?: string;
    price?: number;
    unitPrice?: number;
  }>;
  itemCount?: number | string;
  lastPaymentMetadata?: { itemCount?: string | number };
};

const POLL_MS = 20000;

function money(order: OrderRecord) {
  if (typeof order.finalTotal === 'number') return `GHS ${order.finalTotal.toFixed(2)}`;
  if (typeof order.amountPaid === 'number') return `GHS ${order.amountPaid.toFixed(2)}`;
  if (typeof order.amount === 'number') return `GHS ${order.amount.toFixed(2)}`;
  if (typeof order.amountMinor === 'number') return `GHS ${(order.amountMinor / 100).toFixed(2)}`;
  return '—';
}

function itemCount(order: OrderRecord) {
  if (typeof order.itemCount === 'number') return order.itemCount;
  if (typeof order.itemCount === 'string' && order.itemCount.trim()) return Number(order.itemCount) || order.itemCount;
  if (order.lastPaymentMetadata?.itemCount) return order.lastPaymentMetadata.itemCount;
  return order.items?.length || 0;
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
    const candidate = value as { toMillis?: unknown; seconds?: unknown; _seconds?: unknown };
    if (typeof candidate.toMillis === 'function') {
      const ms = candidate.toMillis();
      return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
    }
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

function csvCell(value: string | number) {
  const clean = String(value ?? '').replaceAll('"', '""');
  return `"${clean}"`;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const knownIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    const fetchOrders = async (initial = false) => {
      try {
        const res = await fetch('/api/admin/firestore/integration-orders?limit=75', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to load orders');
        const data: OrderRecord[] = (json.data || []).sort((a: OrderRecord, b: OrderRecord) => {
          const aTime = timestampToMillis(a.updatedAt ?? a.createdAt) ?? 0;
          const bTime = timestampToMillis(b.updatedAt ?? b.createdAt) ?? 0;
          return bTime - aTime;
        });

        if (!initial) {
          const newOrders = data.filter((o) => o.id && !knownIds.current.has(o.id));
          if (newOrders.length > 0) {
            alert(`🔔 ${newOrders.length} new order${newOrders.length > 1 ? 's' : ''} received.`);
          }
        }

        knownIds.current = new Set(data.map((o) => o.id).filter(Boolean));
        if (mounted) {
          setOrders(data);
          setError(null);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : 'Failed to load orders');
          setLoading(false);
        }
      }
    };

    fetchOrders(true);
    const timer = setInterval(() => fetchOrders(false), POLL_MS);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const rows = useMemo(() => orders.slice(0, 50), [orders]);
  const downloadCsv = () => {
    const headers = ['Buyer', 'Phone', 'Customer Email', 'Store', 'Source Label', 'Source', 'Final Total', 'Payment Updated At', 'Item Count', 'Item Type', 'Item Name', 'Item Price', 'Status'];
    const lines = rows.map((order) => {
      const firstItem = (order.items || [])[0];
      return [
        order.customer?.name || 'Unknown buyer',
        order.customer?.phone || '',
        order.customerEmail || order.customer?.email || '',
        order.storeId || '',
        order.sourceLabel || '',
        order.sourceChannel || order.source || '',
        money(order),
        formatDate(order.paymentUpdatedAt || order.updatedAt || order.updated_at),
        itemCount(order),
        firstItem?.item_type || firstItem?.type || '',
        firstItem?.name || firstItem?.productName || '',
        firstItem?.price ?? firstItem?.unitPrice ?? '',
        order.paymentStatus || order.orderStatus || '',
      ]
        .map(csvCell)
        .join(',');
    });

    const csv = [headers.map(csvCell).join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orders-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="space-y-6 p-6 lg:p-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600"><Bell className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-semibold text-slate-950">Orders</h1>
            <p className="text-sm text-slate-600">Auto-refreshes every {POLL_MS / 1000}s and alerts when a new order arrives.</p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex justify-end">
          <button type="button" onClick={downloadCsv} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Download report (CSV)
          </button>
        </div>
        {loading ? <p className="text-sm text-slate-500">Loading orders…</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {!loading && !error ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Buyer</th><th className="px-3 py-2">Store</th><th className="px-3 py-2">Amount received</th><th className="px-3 py-2">Source label</th><th className="px-3 py-2">Payment updated</th><th className="px-3 py-2">Item count</th><th className="px-3 py-2">Items</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((order) => (
                  <tr key={order.id}>
                    <td className="px-3 py-3 min-w-72"><p className="font-medium text-slate-900">{order.customer?.name || 'Unknown buyer'}</p><p className="text-xs text-slate-500">{order.customer?.phone || 'No phone'}</p><p className="text-xs text-slate-500">{order.customerEmail || order.customer?.email || 'No email'}</p></td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-700">{order.storeId || '—'}</td>
                    <td className="px-3 py-3 font-semibold text-slate-900">{money(order)}</td>
                    <td className="px-3 py-3 text-xs text-slate-700">{order.sourceLabel || '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-700 whitespace-nowrap">{formatDate(order.paymentUpdatedAt || order.updatedAt || order.updated_at)}</td>
                    <td className="px-3 py-3 text-xs text-slate-700">{itemCount(order)}</td>
                    <td className="px-3 py-3 text-slate-700 min-w-96"><div className="flex items-start gap-2"><ShoppingCart className="mt-0.5 h-4 w-4 text-slate-400" /><div>{(order.items || []).slice(0, 2).map((i, idx) => (<p key={`${order.id}-item-${idx}`} className="text-xs">{i.item_type || i.type || 'item'} • {i.name || i.productName || 'Item'} • GHS {Number(i.price ?? i.unitPrice ?? 0).toFixed(2)} × {i.qty || i.quantity || 1}</p>))}{(order.items || []).length > 2 ? <p className="text-xs text-slate-500">+{(order.items || []).length - 2} more</p> : null}</div></div></td>
                    <td className="px-3 py-3 text-xs text-slate-700">{order.sourceChannel || order.source || '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-700">{order.paymentStatus || order.orderStatus || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
