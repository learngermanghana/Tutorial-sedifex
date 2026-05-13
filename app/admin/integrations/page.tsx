import Link from 'next/link';
import { SectionCard, StatusBadge } from '../../../components/admin/ui';
import { apiClients, deliveries, webhookEndpoints } from '../../../lib/admin-mock-data';

export default function IntegrationsPage() {
  return <div className="grid gap-6 lg:grid-cols-3"><SectionCard title="API clients"><p className="text-3xl font-semibold">{apiClients.length}</p><p className="text-sm text-slate-600">Active production clients</p><Link className="mt-3 inline-block text-sm text-indigo-600" href="/admin/integrations/clients">Manage clients</Link></SectionCard><SectionCard title="Webhook endpoints"><p className="text-3xl font-semibold">{webhookEndpoints.length}</p><StatusBadge tone="yellow">1 degraded endpoint</StatusBadge><Link className="mt-3 inline-block text-sm text-indigo-600" href="/admin/webhooks">Open endpoints</Link></SectionCard><SectionCard title="Delivery stream"><p className="text-3xl font-semibold">{deliveries.length}</p><StatusBadge tone="red">1 failed</StatusBadge><Link className="mt-3 inline-block text-sm text-indigo-600" href="/admin/deliveries">Inspect logs</Link></SectionCard></div>;
}
