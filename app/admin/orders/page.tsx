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
  paymentStatus?: string;
  orderStatus?: string;
  customer?: { name?: string; email?: string; phone?: string };
  items?: Array<{ name?: string; productName?: string; qty?: number; quantity?: number }>;
};

const POLL_MS = 20000;

function money(order: OrderRecord) {
  if (typeof order.amount === 'number') return `GHS ${order.amount.toFixed(2)}`;
  if (typeof order.amountMinor === 'number') return `GHS ${(order.amountMinor / 100).toFixed(2)}`;
  return '—';
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
          const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
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
        {loading ? <p className="text-sm text-slate-500">Loading orders…</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {!loading && !error ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Buyer</th><th className="px-3 py-2">Store</th><th className="px-3 py-2">Amount received</th><th className="px-3 py-2">Items</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((order) => (
                  <tr key={order.id}>
                    <td className="px-3 py-3"><p className="font-medium text-slate-900">{order.customer?.name || 'Unknown buyer'}</p><p className="text-xs text-slate-500">{order.customer?.phone || order.customer?.email || 'No contact'}</p></td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-700">{order.storeId || '—'}</td>
                    <td className="px-3 py-3 font-semibold text-slate-900">{money(order)}</td>
                    <td className="px-3 py-3 text-slate-700"><div className="flex items-start gap-2"><ShoppingCart className="mt-0.5 h-4 w-4 text-slate-400" /><div>{(order.items || []).slice(0, 2).map((i, idx) => (<p key={`${order.id}-item-${idx}`} className="text-xs">{i.name || i.productName || 'Item'} × {i.qty || i.quantity || 1}</p>))}{(order.items || []).length > 2 ? <p className="text-xs text-slate-500">+{(order.items || []).length - 2} more</p> : null}</div></div></td>
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
