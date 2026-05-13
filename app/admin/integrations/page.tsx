import { KeyRound, Send, Webhook } from 'lucide-react';
import { SectionCard, StatusBadge } from '../../../components/admin/ui';

export default function IntegrationsPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <SectionCard title="API Clients">
        <div className="space-y-3 text-sm"><p className="flex items-center gap-2 font-medium text-slate-900"><KeyRound className="h-4 w-4" /> Platform API Credentials</p><p className="text-slate-600">2 active production clients with scoped tokens.</p><StatusBadge tone="green">Active</StatusBadge></div>
      </SectionCard>
      <SectionCard title="Webhook Health">
        <div className="space-y-3 text-sm"><p className="flex items-center gap-2 font-medium text-slate-900"><Webhook className="h-4 w-4" /> Endpoint Reliability</p><p className="text-slate-600">41 endpoints monitored across all tenants.</p><StatusBadge tone="yellow">Retrying</StatusBadge></div>
      </SectionCard>
      <SectionCard title="Recent Deliveries">
        <div className="space-y-3 text-sm"><p className="flex items-center gap-2 font-medium text-slate-900"><Send className="h-4 w-4" /> Event Delivery Logs</p><p className="text-slate-600">Last 30 minutes: 1,129 deliveries processed.</p><StatusBadge tone="red">3 Failed</StatusBadge></div>
      </SectionCard>

      <div className="space-y-6 lg:col-span-3">
        <SectionCard title="Credentials & Secrets"><div className="grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-medium">Client Token Rotation</p><p className="mt-1 text-sm text-slate-600">Rotate API secrets every 90 days.</p></div><div className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-medium">Webhook Secret Policy</p><p className="mt-1 text-sm text-slate-600">Automatic reminder for stale endpoint secrets.</p></div></div></SectionCard>
        <SectionCard title="Recent Webhook Deliveries"><div className="h-36 animate-pulse rounded-xl bg-slate-100" /></SectionCard>
      </div>
    </div>
  );
}
