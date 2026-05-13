import { Activity, ArrowUpRight, CircleAlert, Server, Zap } from 'lucide-react';
import { SectionCard, StatCard, StatusBadge } from '../../components/admin/ui';

const metrics = [
  { label: 'Monthly Revenue', value: '$284,920', delta: '+12.4% vs last month' },
  { label: 'Orders Today', value: '1,842', delta: '+6.8% from yesterday' },
  { label: 'Active Stores', value: '124', delta: '+9 new stores this week' },
  { label: 'Admin Activity', value: '98.7%', delta: 'Uptime over 30 days' },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((m) => <StatCard key={m.label} {...m} />)}</section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <SectionCard title="Revenue Analytics" action={<button className="text-xs font-medium text-indigo-600">View report</button>}>
            <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">Analytics chart area (daily GMV, AOV, conversion)</div>
          </SectionCard>
          <SectionCard title="Quick Actions">
            <div className="grid gap-3 sm:grid-cols-2">
              {['Create store', 'Invite platform admin', 'Rotate webhook secret', 'Review failed deliveries'].map((item) => (
                <button key={item} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">{item}<ArrowUpRight className="h-4 w-4 text-slate-400" /></button>
              ))}
            </div>
          </SectionCard>
        </div>
        <div className="space-y-6">
          <SectionCard title="Recent Activity">
            <div className="space-y-3 text-sm">
              <p className="rounded-xl bg-slate-50 p-3"><span className="font-medium">Store upgraded:</span> Luma Beauty moved to Growth plan.</p>
              <p className="rounded-xl bg-slate-50 p-3"><span className="font-medium">User invited:</span> ops-admin@sedi.io was added.</p>
              <p className="rounded-xl bg-slate-50 p-3"><span className="font-medium">Webhook replayed:</span> Delivery #DLV-4021 succeeded.</p>
            </div>
          </SectionCard>
          <SectionCard title="System Health">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="flex items-center gap-2"><Server className="h-4 w-4 text-slate-500" /> API Cluster</span><StatusBadge tone="green">Healthy</StatusBadge></div>
              <div className="flex items-center justify-between"><span className="flex items-center gap-2"><Zap className="h-4 w-4 text-slate-500" /> Webhook Queue</span><StatusBadge tone="yellow">Retrying</StatusBadge></div>
              <div className="flex items-center justify-between"><span className="flex items-center gap-2"><Activity className="h-4 w-4 text-slate-500" /> Event Processor</span><StatusBadge tone="green">Stable</StatusBadge></div>
              <div className="flex items-center justify-between"><span className="flex items-center gap-2"><CircleAlert className="h-4 w-4 text-slate-500" /> Failed Deliveries</span><StatusBadge tone="red">3 Open</StatusBadge></div>
            </div>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
