import { deliveries } from '../../../lib/admin-mock-data';
import { SectionCard, StatusBadge } from '../../../components/admin/ui';

export default function DeliveriesPage() {
  return <SectionCard title="Webhook Deliveries"> <div className="overflow-hidden rounded-xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left">Delivery</th><th className="px-4 py-3 text-left">Store</th><th className="px-4 py-3 text-left">Event</th><th className="px-4 py-3 text-left">Status</th></tr></thead><tbody>{deliveries.map((d)=><tr key={d.id} className="border-t"><td className="px-4 py-3">{d.id}</td><td className="px-4 py-3">{d.store}</td><td className="px-4 py-3">{d.event}</td><td className="px-4 py-3"><StatusBadge tone={d.status==='delivered'?'green':d.status==='retrying'?'yellow':'red'}>{d.status}</StatusBadge></td></tr>)}</tbody></table></div></SectionCard>;
}
