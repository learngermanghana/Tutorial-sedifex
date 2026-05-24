'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, PackageCheck, PackageOpen, RefreshCw, Truck } from 'lucide-react';
import { StatusBadge } from './ui';

type StatusAction = 'received' | 'preparing' | 'out_for_delivery' | 'delivered';

type FollowUpOrder = {
  id: string;
  storeId?: string;
  storeName: string;
  buyerName: string;
  amount: string;
  status: string;
  bucket: 'new' | 'accepted' | 'preparing' | 'out_for_delivery' | 'delivered' | 'problem' | 'delayed';
  age: string;
};

const ACTIONS: Array<{ action: StatusAction; label: string; icon: typeof PackageCheck; className: string }> = [
  { action: 'received', label: 'Received', icon: PackageCheck, className: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100' },
  { action: 'preparing', label: 'Preparing', icon: PackageOpen, className: 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100' },
  { action: 'out_for_delivery', label: 'Out for delivery', icon: Truck, className: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100' },
  { action: 'delivered', label: 'Delivered', icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
];

function bucketTone(bucket: FollowUpOrder['bucket']) {
  if (bucket === 'delivered') return 'green';
  if (bucket === 'problem' || bucket === 'delayed') return 'red';
  if (bucket === 'out_for_delivery') return 'blue';
  if (bucket === 'preparing' || bucket === 'accepted') return 'yellow';
  return 'slate';
}

function bucketLabel(bucket: FollowUpOrder['bucket']) {
  if (bucket === 'new') return 'New / paid';
  if (bucket === 'accepted') return 'Accepted';
  if (bucket === 'preparing') return 'Preparing';
  if (bucket === 'out_for_delivery') return 'Out for delivery';
  if (bucket === 'delivered') return 'Delivered';
  if (bucket === 'problem') return 'Problem';
  return 'Delayed';
}

export function DashboardOrderFollowUp({ orders }: { orders: FollowUpOrder[] }) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function updateStatus(order: FollowUpOrder, action: StatusAction) {
    const confirmed = window.confirm(`Mark order ${order.id} as ${action.replaceAll('_', ' ')}?`);
    if (!confirmed) return;

    setUpdating(`${order.id}-${action}`);
    setMessage('');
    try {
      const response = await fetch('/api/admin/firestore/integration-orders/status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, storeId: order.storeId || '', action }),
      });
      const raw = await response.text();
      const data = raw ? JSON.parse(raw) as { ok?: boolean; error?: string; label?: string } : null;
      if (!response.ok || !data?.ok) throw new Error(data?.error || raw || 'Unable to update order status.');
      setMessage(`Updated ${order.id} to ${data.label || action}. Refreshing dashboard…`);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update order status.');
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-xs font-semibold text-indigo-800">{message}</p> : null}
      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
          No active orders need follow-up right now. Use the full Orders page for history and delivered orders.
        </div>
      ) : null}
      {orders.map((order) => (
        <div key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={bucketTone(order.bucket)}>{bucketLabel(order.bucket)}</StatusBadge>
                <span className="text-xs font-semibold text-slate-500">{order.age}</span>
              </div>
              <p className="mt-3 truncate text-sm font-bold text-slate-950">{order.buyerName}</p>
              <p className="mt-1 truncate text-xs text-slate-500">{order.storeName} · {order.amount}</p>
              <p className="mt-1 break-all text-xs text-slate-400">{order.id}</p>
              <p className="mt-2 text-xs text-slate-600">{order.status}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 lg:justify-end">
              {ACTIONS.map((item) => {
                const Icon = item.icon;
                const key = `${order.id}-${item.action}`;
                return (
                  <button
                    key={item.action}
                    type="button"
                    disabled={Boolean(updating)}
                    onClick={() => updateStatus(order, item.action)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${item.className}`}
                  >
                    {updating === key ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
                    {updating === key ? 'Updating…' : item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ))}
      <Link href="/admin/orders" className="inline-flex rounded-2xl bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800">
        Open full Orders page
      </Link>
    </div>
  );
}
