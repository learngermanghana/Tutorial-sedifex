'use client';
import { useState } from 'react';
import { auditLogs } from '../../../lib/admin-mock-data';
import { SectionCard } from '../../../components/admin/ui';

export default function AuditLogsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const row = auditLogs.find((l)=>l.id===selected);
  return <SectionCard title="Audit Logs"><div className="overflow-hidden rounded-xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left">Actor</th><th className="px-4 py-3 text-left">Action</th><th className="px-4 py-3 text-left">Resource</th><th className="px-4 py-3 text-left">Time</th></tr></thead><tbody>{auditLogs.map((l)=><tr key={l.id} onClick={()=>setSelected(l.id)} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"><td className="px-4 py-3">{l.actor}</td><td className="px-4 py-3">{l.action}</td><td className="px-4 py-3">{l.resource}</td><td className="px-4 py-3">{new Date(l.time).toLocaleString()}</td></tr>)}</tbody></table></div>{row && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"><p className="font-semibold">Event details</p><p className="mt-1">{row.details}</p></div>}</SectionCard>;
}
