import Link from 'next/link';

const pages = [
  { href: '/admin/integrations/clients', title: 'API Clients', desc: 'Create/rotate/revoke API credentials and assign scopes.' },
  { href: '/admin/integrations/webhooks', title: 'Webhook Endpoints', desc: 'Configure endpoints, secrets, events, and endpoint state.' },
  { href: '/admin/integrations/deliveries', title: 'Delivery Logs', desc: 'Inspect delivery status, retries, and replay failed events.' },
  { href: '/admin/integrations/clients', title: 'Origins & CORS', desc: 'Manage per-client allowed origin domains.' },
  { href: '/admin/integrations/clients', title: 'SDK / Embed Snippet', desc: 'Generate a script snippet with storeId and permissions.' },
];

export default function IntegrationsPage() {
  return <div className="space-y-4"><h2 className="text-2xl font-bold">Integrations</h2><div className="grid md:grid-cols-2 gap-4">{pages.map(p => <Link className="rounded-xl border bg-white p-4" href={p.href} key={p.title}><h3 className="font-semibold">{p.title}</h3><p className="text-sm text-gray-600">{p.desc}</p></Link>)}</div></div>;
}
