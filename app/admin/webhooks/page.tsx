import { webhookEndpoints } from '../../../lib/admin-mock-data';
import { SectionCard, StatusBadge } from '../../../components/admin/ui';

export default function WebhooksPage() {
  return <SectionCard title="Webhook Endpoints"> <div className="space-y-3">{webhookEndpoints.map((w)=><div key={w.id} className="rounded-xl border border-slate-200 p-3 text-sm"><div className="flex items-center justify-between"><p className="font-medium">{w.store}</p><StatusBadge tone={w.status==='healthy'?'green':'yellow'}>{w.status}</StatusBadge></div><p className="mt-1 text-slate-600">{w.url}</p><p className="text-xs text-slate-500">Events: {w.events.join(', ')} · Secret age: {w.secretAgeDays} days</p></div>)}</div></SectionCard>;
}
