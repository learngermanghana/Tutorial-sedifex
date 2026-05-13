'use client';
import { useMemo, useState } from 'react';
import { SectionCard, StatusBadge } from '../../../components/admin/ui';
import { stores } from '../../../lib/admin-mock-data';

const tone: Record<string, 'green'|'yellow'|'red'> = { active: 'green', provisioning: 'yellow', at_risk: 'red', suspended: 'red' };

export default function StoresPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(stores[0]?.id ?? null);
  const filtered = useMemo(() => stores.filter((s) => (status === 'all' || s.status === status) && `${s.name} ${s.id} ${s.owner}`.toLowerCase().includes(query.toLowerCase())), [query, status]);
  const selected = filtered.find((s) => s.id === selectedId) ?? null;

  return <div className="grid gap-6 xl:grid-cols-4"><SectionCard title="Store Directory" action={<button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white">Add Store</button>}><div className="mb-4 flex gap-3"><input value={query} onChange={(e)=>setQuery(e.target.value)} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Search by store name or owner"/><select value={status} onChange={(e)=>setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="all">All statuses</option><option value="active">Active</option><option value="provisioning">Provisioning</option><option value="at_risk">At risk</option></select></div><div className="overflow-hidden rounded-xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left">Store</th><th className="px-4 py-3 text-left">Plan</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Orders(30d)</th></tr></thead><tbody>{filtered.length===0?<tr><td className="px-4 py-8 text-slate-500" colSpan={4}>No stores found for this filter.</td></tr>:filtered.map((s)=><tr key={s.id} onClick={()=>setSelectedId(s.id)} className={`cursor-pointer border-t border-slate-100 ${selectedId===s.id?'bg-indigo-50':'hover:bg-slate-50'}`}><td className="px-4 py-3"><p className="font-medium">{s.name}</p><p className="text-xs text-slate-500">{s.city}, {s.country}</p></td><td className="px-4 py-3">{s.plan}</td><td className="px-4 py-3"><StatusBadge tone={tone[s.status]}>{s.status.replace('_',' ')}</StatusBadge></td><td className="px-4 py-3">{s.orders30d.toLocaleString()}</td></tr>)}</tbody></table></div></SectionCard><SectionCard title="Store Details"><div className="text-sm">{selected ? <div className="space-y-2"><p className="font-semibold text-slate-900">{selected.name}</p><p>ID: {selected.id}</p><p>Owner: {selected.owner}</p><p>MRR: ${selected.mrr.toLocaleString()}</p></div> : <p className="text-slate-500">Select a store to view details.</p>}</div></SectionCard></div>;
}
