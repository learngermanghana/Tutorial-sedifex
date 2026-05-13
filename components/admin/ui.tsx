import type { ReactNode } from 'react';

export function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">{title}</h3>{action}</div>{children}</section>;
}

export function StatusBadge({ tone, children }: { tone: 'green' | 'yellow' | 'red' | 'blue' | 'slate'; children: ReactNode }) {
  const styles = { green: 'bg-emerald-50 text-emerald-700 ring-emerald-200', yellow: 'bg-amber-50 text-amber-700 ring-amber-200', red: 'bg-rose-50 text-rose-700 ring-rose-200', blue: 'bg-indigo-50 text-indigo-700 ring-indigo-200', slate: 'bg-slate-100 text-slate-700 ring-slate-200' };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${styles[tone]}`}>{children}</span>;
}

export function StatCard({ label, value, delta }: { label: string; value: string; delta: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p><p className="mt-1 text-xs text-emerald-600">{delta}</p></div>;
}
