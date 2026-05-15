import Link from 'next/link';
import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Database,
  KeyRound,
  PackageSearch,
  ReceiptText,
  Server,
  ShieldCheck,
  Store,
  Webhook,
  Zap,
} from 'lucide-react';
import { SectionCard, StatCard, StatusBadge } from '../../components/admin/ui';

const metrics = [
  { label: 'Store records', value: 'Ready', delta: 'Prepare storeSettings view' },
  { label: 'Product feeds', value: 'Sync', delta: 'Prepare product visibility checks' },
  { label: 'Bookings & orders', value: 'Live', delta: 'Prepare checkout activity view' },
  { label: 'Integrations', value: 'Secure', delta: 'Clients, webhooks, and access' },
];

const quickActions = [
  {
    title: 'Prepare data connection',
    description: 'Set up the dashboard to show store, product, booking, and settings data.',
    href: '/admin/settings',
    icon: Database,
  },
  {
    title: 'Review integrations',
    description: 'Manage API clients, credentials, webhook endpoints, and scopes.',
    href: '/admin/integrations',
    icon: KeyRound,
  },
  {
    title: 'Check webhook deliveries',
    description: 'Inspect delivery results, retries, and recent delivery status.',
    href: '/admin/deliveries',
    icon: Webhook,
  },
  {
    title: 'Open store operations',
    description: 'Move toward one place for stores, products, orders, and bookings.',
    href: '/admin/stores',
    icon: Store,
  },
];

const setupSteps = [
  {
    title: 'Add Firebase Admin environment variables',
    description: 'Add project ID, service account email, and service account private key in Vercel.',
    status: 'Required',
    tone: 'blue' as const,
  },
  {
    title: 'Create protected admin API routes',
    description: 'Add server routes for stores, products, bookings, and settings.',
    status: 'Next',
    tone: 'yellow' as const,
  },
  {
    title: 'Move production storage away from JSON file',
    description: 'Use the production database for integration clients and webhooks.',
    status: 'Planned',
    tone: 'slate' as const,
  },
];

const healthItems = [
  { label: 'Admin login', value: 'Ready', icon: ShieldCheck, tone: 'green' as const },
  { label: 'Database connection', value: 'Next', icon: Database, tone: 'yellow' as const },
  { label: 'Webhook pages', value: 'Available', icon: Zap, tone: 'blue' as const },
  { label: 'JSON file storage', value: 'Local only', icon: Server, tone: 'red' as const },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-100">
              <CheckCircle2 className="h-4 w-4" />
              Sedifex admin workspace
            </div>
            <h2 className="mt-5 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              Control stores, checkout, products, bookings, and integrations from one place.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              This dashboard is now cleaner and ready for the next production step: connecting the interface to your Sedifex database.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-semibold text-slate-200">Production focus</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <span>Fast admin UI</span>
                <StatusBadge tone="green">Improved</StatusBadge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Database data</span>
                <StatusBadge tone="yellow">Next</StatusBadge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Vercel env setup</span>
                <StatusBadge tone="blue">Required</StatusBadge>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <StatCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <SectionCard
            title="Next actions"
            action={
              <Link href="/admin/settings" className="text-xs font-semibold text-indigo-600 hover:text-indigo-500">
                Settings
              </Link>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.title}
                    href={action.href}
                    className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-indigo-200 hover:bg-indigo-50/60"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="rounded-2xl bg-white p-3 text-indigo-600 shadow-sm ring-1 ring-slate-200 transition group-hover:ring-indigo-200">
                        <Icon className="h-5 w-5" />
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-indigo-500" />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-slate-950">{action.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{action.description}</p>
                  </Link>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Production rollout plan">
            <div className="space-y-3">
              {setupSteps.map((step, index) => (
                <div key={step.title} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-950">{step.title}</h3>
                      <StatusBadge tone={step.tone}>{step.status}</StatusBadge>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="System readiness">
            <div className="space-y-4">
              {healthItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-3 text-sm font-medium text-slate-700">
                      <span className="rounded-xl bg-slate-100 p-2 text-slate-500">
                        <Icon className="h-4 w-4" />
                      </span>
                      {item.label}
                    </span>
                    <StatusBadge tone={item.tone}>{item.value}</StatusBadge>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="What this admin should monitor">
            <div className="space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 font-semibold text-slate-950">
                  <PackageSearch className="h-4 w-4 text-indigo-600" />
                  Product visibility
                </div>
                <p className="mt-2 leading-6">Find products missing images, prices, categories, or market visibility.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 font-semibold text-slate-950">
                  <ReceiptText className="h-4 w-4 text-indigo-600" />
                  Checkout health
                </div>
                <p className="mt-2 leading-6">Catch setup problems like missing store IDs, unavailable checkout, or failed booking sync.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 font-semibold text-slate-950">
                  <CircleAlert className="h-4 w-4 text-indigo-600" />
                  Integration issues
                </div>
                <p className="mt-2 leading-6">Show failed webhooks, revoked clients, and outdated access before stores complain.</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
