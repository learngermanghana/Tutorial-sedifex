import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  RefreshCw,
  RotateCcw,
  Webhook,
} from 'lucide-react';
import { SectionCard, StatCard, StatusBadge } from '../../../components/admin/ui';
import {
  listClients,
  listDeliveries,
  listWebhooks,
  replayDelivery,
  type DeliveryStatus,
  type IntegrationClient,
  type WebhookDelivery,
  type WebhookEndpoint,
} from '../../../lib/integrations-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function statusFilter(value: string | string[] | undefined): DeliveryStatus | null {
  const status = firstValue(value);
  return status === 'success' || status === 'failed' ? status : null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function statusTone(delivery: WebhookDelivery) {
  if (delivery.status === 'success') return 'green' as const;
  if (delivery.nextRetryAt) return 'yellow' as const;
  return 'red' as const;
}

function statusLabel(delivery: WebhookDelivery) {
  if (delivery.status === 'success') return 'Delivered';
  if (delivery.nextRetryAt) return 'Retrying';
  return 'Failed';
}

function responseSummary(delivery: WebhookDelivery) {
  if (delivery.status === 'success') return 'Receiver accepted the delivery.';
  if (delivery.responseBodySnippet) return delivery.responseBodySnippet;
  if (delivery.responseCode) return `Receiver returned HTTP ${delivery.responseCode}.`;
  return 'No receiver response was captured.';
}

function csvCell(value: string | number | null | undefined) {
  const clean = String(value ?? '').replaceAll('"', '""');
  return `"${clean}"`;
}

async function replayAction(formData: FormData) {
  'use server';

  const endpointId = String(formData.get('endpointId') || '').trim();
  const deliveryId = String(formData.get('deliveryId') || '').trim();

  if (endpointId && deliveryId) {
    await replayDelivery(endpointId, deliveryId);
  }

  revalidatePath('/admin/deliveries');
}

export default async function DeliveriesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const endpointId = firstValue(params.endpointId)?.trim() || '';
  const eventType = firstValue(params.eventType)?.trim() || '';
  const status = statusFilter(params.status);
  const from = firstValue(params.from)?.trim() || '';
  const to = firstValue(params.to)?.trim() || '';

  const [deliveriesRaw, endpointsRaw, clientsRaw] = await Promise.all([
    listDeliveries({
      endpointId: endpointId || null,
      status,
      eventType: eventType || null,
      from: from || null,
      to: to || null,
    }),
    listWebhooks(),
    listClients(),
  ]);

  const deliveries = [...deliveriesRaw].sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
  const endpoints = endpointsRaw as WebhookEndpoint[];
  const clients = clientsRaw as IntegrationClient[];

  const endpointsById = new Map(endpoints.map((endpoint) => [endpoint.id, endpoint]));
  const clientsById = new Map<string, IntegrationClient>();
  clients.forEach((client) => {
    clientsById.set(client.id, client);
    clientsById.set(client.clientId, client);
  });

  const deliveredCount = deliveries.filter((delivery) => delivery.status === 'success').length;
  const failedCount = deliveries.filter((delivery) => delivery.status === 'failed' && !delivery.nextRetryAt).length;
  const retryingCount = deliveries.filter((delivery) => delivery.status === 'failed' && delivery.nextRetryAt).length;
  const activeEndpointCount = endpoints.filter((endpoint) => endpoint.status === 'active').length;

  const stats = [
    { label: 'Deliveries shown', value: String(deliveries.length), delta: status ? `${status} filter active` : 'All matching records' },
    { label: 'Delivered', value: String(deliveredCount), delta: 'Successful receiver responses' },
    { label: 'Retrying', value: String(retryingCount), delta: 'Failed but has next retry' },
    { label: 'Failed', value: String(failedCount), delta: 'Needs manual review' },
    { label: 'Active endpoints', value: String(activeEndpointCount), delta: `${endpoints.length} total endpoints` },
  ];

  const csvRows = deliveries.map((delivery) => {
    const endpoint = endpointsById.get(delivery.endpointId);
    const client = endpoint ? clientsById.get(endpoint.clientId) : undefined;
    return [
      delivery.id,
      client?.storeId || 'platform',
      delivery.endpointId,
      endpoint?.targetUrl || '',
      delivery.eventType,
      statusLabel(delivery),
      delivery.responseCode,
      delivery.attempt,
      delivery.nextRetryAt || '',
      delivery.createdAt,
      delivery.payloadRef,
      delivery.responseBodySnippet,
    ]
      .map(csvCell)
      .join(',');
  });
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent([
    ['Delivery ID', 'Store', 'Endpoint', 'Target URL', 'Event', 'Status', 'Response code', 'Attempt', 'Next retry', 'Created at', 'Payload ref', 'Response snippet'].map(csvCell).join(','),
    ...csvRows,
  ].join('\n'))}`;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-100">
              <Webhook className="h-4 w-4" />
              Webhook delivery monitor
            </div>
            <h2 className="mt-5 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              Inspect real webhook deliveries, retry failures, and confirm receiver health.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              This page now reads the integration delivery store directly instead of mock rows, so you can see actual endpoint IDs, events, response codes, and retry state.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-semibold text-slate-200">Delivery actions</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <span>Read real deliveries</span>
                <StatusBadge tone="green">Active</StatusBadge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Replay failed delivery</span>
                <StatusBadge tone="blue">Available</StatusBadge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Export report</span>
                <StatusBadge tone="slate">CSV</StatusBadge>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </section>

      <SectionCard
        title="Filters"
        action={
          <a
            href={csvHref}
            download={`webhook-deliveries-${new Date().toISOString().slice(0, 10)}.csv`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Export CSV <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        }
      >
        <form action="/admin/deliveries" className="grid gap-3 lg:grid-cols-[0.8fr_1fr_1fr_1fr_1fr_auto_auto] lg:items-end">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={status || ''} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10">
              <option value="">All</option>
              <option value="success">Delivered</option>
              <option value="failed">Failed / retrying</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="endpointId">Endpoint ID</label>
            <input id="endpointId" name="endpointId" defaultValue={endpointId} placeholder="wh_..." className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="eventType">Event type</label>
            <input id="eventType" name="eventType" defaultValue={eventType} placeholder="order.paid" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="from">From</label>
            <input id="from" name="from" type="date" defaultValue={from.slice(0, 10)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="to">To</label>
            <input id="to" name="to" type="date" defaultValue={to.slice(0, 10)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" />
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-400">
            <RefreshCw className="h-4 w-4" />
            Filter
          </button>
          <Link href="/admin/deliveries" className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Reset
          </Link>
        </form>
      </SectionCard>

      <SectionCard title="Delivery records">
        {deliveries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
            No webhook deliveries match the current filters. Once webhooks are sent, they will appear here with endpoint, event, response, retry, and replay information.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1.1fr_0.8fr_1.1fr_0.8fr_0.7fr_0.8fr_auto] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 max-xl:hidden">
              <span>Delivery</span>
              <span>Store</span>
              <span>Endpoint</span>
              <span>Event</span>
              <span>Status</span>
              <span>Response</span>
              <span>Action</span>
            </div>
            <div className="divide-y divide-slate-200">
              {deliveries.map((delivery) => {
                const endpoint = endpointsById.get(delivery.endpointId);
                const client = endpoint ? clientsById.get(endpoint.clientId) : undefined;
                const canReplay = delivery.status === 'failed';

                return (
                  <div key={delivery.id} className="grid gap-3 px-4 py-4 text-sm xl:grid-cols-[1.1fr_0.8fr_1.1fr_0.8fr_0.7fr_0.8fr_auto] xl:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">{delivery.id}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatDate(delivery.createdAt)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-slate-700">{client?.storeId || 'platform'}</p>
                      <p className="truncate text-xs text-slate-500">{client?.name || 'Unknown client'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-slate-700">{delivery.endpointId}</p>
                      <p className="truncate text-xs text-slate-500">{endpoint?.targetUrl || 'Endpoint not found'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{delivery.eventType}</p>
                      <p className="text-xs text-slate-500">Attempt {delivery.attempt}</p>
                    </div>
                    <StatusBadge tone={statusTone(delivery)}>{statusLabel(delivery)}</StatusBadge>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800">{delivery.responseCode || '—'}</p>
                      <p className="line-clamp-2 text-xs leading-5 text-slate-500">{responseSummary(delivery)}</p>
                      {delivery.nextRetryAt ? <p className="mt-1 text-xs text-amber-700">Next retry: {formatDate(delivery.nextRetryAt)}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canReplay ? (
                        <form action={replayAction}>
                          <input type="hidden" name="endpointId" value={delivery.endpointId} />
                          <input type="hidden" name="deliveryId" value={delivery.id} />
                          <button className="inline-flex items-center justify-center gap-1 rounded-xl bg-indigo-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-400">
                            <RotateCcw className="h-3.5 w-3.5" />
                            Replay
                          </button>
                        </form>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          OK
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-3">
        <SectionCard title="Replay guidance">
          <div className="space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-semibold text-slate-950">Fix receiver first</p>
              <p className="mt-1 leading-6">Check the endpoint URL, Apps Script deployment, auth secret, and server logs before replaying.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-semibold text-slate-950">Replay creates a new attempt</p>
              <p className="mt-1 leading-6">The replay action stores another delivery row so you can keep the original failure history.</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Common failure causes">
          <div className="space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 p-4">Receiver URL changed or Apps Script was not redeployed.</div>
            <div className="rounded-2xl bg-slate-50 p-4">Shared webhook secret does not match between Sedifex and receiver.</div>
            <div className="rounded-2xl bg-slate-50 p-4">Receiver returned a validation error because a required booking/order field was missing.</div>
          </div>
        </SectionCard>

        <SectionCard title="Connected endpoints">
          <div className="space-y-3 text-sm text-slate-600">
            {endpoints.slice(0, 5).map((endpoint) => (
              <div key={endpoint.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-semibold text-slate-950">{endpoint.id}</p>
                  <StatusBadge tone={endpoint.status === 'active' ? 'green' : 'slate'}>{endpoint.status}</StatusBadge>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{endpoint.targetUrl}</p>
              </div>
            ))}
            {endpoints.length === 0 ? (
              <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>No webhook endpoints have been configured yet.</p>
              </div>
            ) : null}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
