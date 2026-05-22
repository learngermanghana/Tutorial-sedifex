import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { ArrowUpRight, Mail, MapPin, Phone, Search, Store, UserRound, Users } from 'lucide-react';
import DeleteCustomerForm from '../../../components/admin/DeleteCustomerForm';
import { SectionCard, StatCard, StatusBadge } from '../../../components/admin/ui';
import { adminFirestore, getFirebaseEnvStatus } from '../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SearchParams = Promise<{ q?: string; storeId?: string }>;
type RawRecord = Record<string, unknown>;
type CustomerRecord = RawRecord & {
  id: string;
  path: string;
  source: 'root' | 'store-subcollection';
  inferredStoreId?: string;
};
type StoreRecord = RawRecord & { id: string };
type OrderRecord = RawRecord & { id: string };

type CustomersData = {
  error: string | null;
  customers: CustomerRecord[];
  storesById: Map<string, StoreRecord>;
  orders: OrderRecord[];
};

function asRecord(value: unknown): RawRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RawRecord : {};
}

function text(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return fallback;
}

function isSafeCustomerPath(path: string) {
  return /^customers\/[^/]+$/.test(path) || /^stores\/[^/]+\/customers\/[^/]+$/.test(path);
}

async function deleteCustomer(formData: FormData) {
  'use server';

  const customerPath = text(formData.get('customerPath'));
  const confirmDelete = text(formData.get('confirmDelete'));
  if (confirmDelete !== 'DELETE_CUSTOMER') return;
  if (!isSafeCustomerPath(customerPath)) return;

  const db = adminFirestore();
  const snapshot = await db.doc(customerPath).get();
  const customerId = snapshot.id;
  const customerData = snapshot.exists ? snapshot.data() || {} : {};

  await db.doc(customerPath).delete();
  await db.collection('adminAuditLogs').add({
    action: 'customer_delete',
    customerPath,
    customerId,
    customerName: text(customerData.name || customerData.customerName || customerData.fullName || customerData.displayName),
    customerEmail: text(customerData.email || customerData.customerEmail),
    actor: 'sedifexadmin',
    createdAt: new Date().toISOString(),
  });

  revalidatePath('/admin/customers');
  revalidatePath(`/admin/customers/${customerId}`);
}

function nestedText(record: RawRecord | undefined, path: string[], fallback = '') {
  let current: unknown = record;
  for (const key of path) current = asRecord(current)[key];
  return text(current, fallback);
}

function firstText(record: RawRecord | undefined, fields: string[], fallback = '') {
  const source = record || {};
  for (const field of fields) {
    const value = text(source[field]);
    if (value) return value;
  }
  return fallback;
}

function customerName(customer: CustomerRecord) {
  return firstText(customer, ['name', 'customerName', 'fullName', 'displayName', 'buyerName', 'contactName'], customer.id);
}

function customerEmail(customer: CustomerRecord) {
  return firstText(customer, ['email', 'customerEmail', 'buyerEmail', 'publicEmail', 'contactEmail'], nestedText(customer, ['customer', 'email']));
}

function customerPhone(customer: CustomerRecord) {
  return firstText(customer, ['phone', 'phoneNumber', 'customerPhone', 'buyerPhone', 'contactPhone', 'whatsappNumber'], nestedText(customer, ['customer', 'phone']));
}

function customerStoreId(customer: CustomerRecord) {
  return firstText(customer, ['storeId', 'merchantId', 'businessId', 'ownerUid'], customer.inferredStoreId || '');
}

function storeName(store: StoreRecord | undefined, fallback = 'Unknown store') {
  return firstText(store, ['displayName', 'storeName', 'name', 'businessName', 'merchantName'], fallback);
}

function storeLocation(store: StoreRecord | undefined) {
  const city = firstText(store, ['city', 'storeCity']);
  const country = firstText(store, ['country', 'storeCountry']);
  return [city, country].filter(Boolean).join(', ');
}

function timestampToMillis(value: unknown) {
  if (!value) return 0;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value && typeof value === 'object') {
    const candidate = value as { seconds?: unknown; _seconds?: unknown; toMillis?: unknown };
    if (typeof candidate.toMillis === 'function') {
      const millis = candidate.toMillis();
      return typeof millis === 'number' && Number.isFinite(millis) ? millis : 0;
    }
    const seconds = typeof candidate.seconds === 'number' ? candidate.seconds : typeof candidate._seconds === 'number' ? candidate._seconds : 0;
    return seconds * 1000;
  }
  return 0;
}

function orderAmount(order: OrderRecord) {
  const candidates = [order.finalTotal, order.amountPaid, order.amount, order.total, order.subtotal];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  if (typeof order.amountMinor === 'number' && Number.isFinite(order.amountMinor)) return order.amountMinor / 100;
  return 0;
}

function orderCustomerEmail(order: OrderRecord) {
  return firstText(order, ['customerEmail', 'email', 'buyerEmail'], nestedText(order, ['customer', 'email'])).toLowerCase();
}

function orderCustomerPhone(order: OrderRecord) {
  return firstText(order, ['customerPhone', 'phone', 'buyerPhone'], nestedText(order, ['customer', 'phone']));
}

function orderCustomerId(order: OrderRecord) {
  return firstText(order, ['customerId', 'buyerId', 'customer_id']);
}

function customerOrders(customer: CustomerRecord, orders: OrderRecord[]) {
  const id = customer.id;
  const email = customerEmail(customer).toLowerCase();
  const phone = customerPhone(customer);
  const storeId = customerStoreId(customer);

  return orders.filter((order) => {
    const sameCustomerId = Boolean(id && orderCustomerId(order) === id);
    const sameEmail = Boolean(email && orderCustomerEmail(order) === email);
    const samePhone = Boolean(phone && orderCustomerPhone(order) === phone);
    const sameStore = !storeId || firstText(order, ['storeId', 'merchantId', 'businessId']) === storeId;
    return sameStore && (sameCustomerId || sameEmail || samePhone);
  });
}

function searchableCustomer(customer: CustomerRecord, store: StoreRecord | undefined) {
  return [
    customer.id,
    customer.path,
    customerName(customer),
    customerEmail(customer),
    customerPhone(customer),
    customerStoreId(customer),
    storeName(store, ''),
    storeLocation(store),
  ].join(' ').toLowerCase();
}

function normalizeCustomerDoc(doc: FirebaseFirestore.QueryDocumentSnapshot, source: CustomerRecord['source']): CustomerRecord {
  const pathParts = doc.ref.path.split('/');
  const inferredStoreId = pathParts[0] === 'stores' && pathParts[2] === 'customers' ? pathParts[1] : undefined;
  return {
    ...(doc.data() as RawRecord),
    id: doc.id,
    path: doc.ref.path,
    source,
    inferredStoreId,
  };
}

async function loadCustomers(): Promise<CustomersData> {
  const env = getFirebaseEnvStatus();
  if (!env.ready) return { error: 'Firebase environment variables are not ready.', customers: [], storesById: new Map(), orders: [] };

  try {
    const db = adminFirestore();
    const [rootCustomersSnap, groupCustomersSnap, storesSnap, ordersSnap] = await Promise.all([
      db.collection('customers').limit(500).get().catch(() => null),
      db.collectionGroup('customers').limit(500).get().catch(() => null),
      db.collection('stores').limit(500).get().catch(() => null),
      db.collection('integrationOrders').limit(500).get().catch(() => null),
    ]);

    const byPath = new Map<string, CustomerRecord>();
    for (const doc of rootCustomersSnap?.docs || []) byPath.set(doc.ref.path, normalizeCustomerDoc(doc, 'root'));
    for (const doc of groupCustomersSnap?.docs || []) {
      if (!byPath.has(doc.ref.path)) byPath.set(doc.ref.path, normalizeCustomerDoc(doc, doc.ref.path.startsWith('customers/') ? 'root' : 'store-subcollection'));
    }

    const storesById = new Map<string, StoreRecord>();
    for (const doc of storesSnap?.docs || []) storesById.set(doc.id, { ...(doc.data() as RawRecord), id: doc.id });

    const orders = (ordersSnap?.docs || []).map((doc) => ({ ...(doc.data() as RawRecord), id: doc.id } as OrderRecord));

    return {
      error: null,
      customers: [...byPath.values()].sort((a, b) => customerName(a).localeCompare(customerName(b))),
      storesById,
      orders,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to load customers.', customers: [], storesById: new Map(), orders: [] };
  }
}

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (params.q || '').trim().toLowerCase();
  const selectedStoreId = (params.storeId || '').trim();
  const data = await loadCustomers();

  const filtered = data.customers.filter((customer) => {
    const storeId = customerStoreId(customer);
    const store = data.storesById.get(storeId);
    const matchesQuery = query ? searchableCustomer(customer, store).includes(query) : true;
    const matchesStore = selectedStoreId ? storeId === selectedStoreId : true;
    return matchesQuery && matchesStore;
  });

  const storeIds = [...new Set(data.customers.map(customerStoreId).filter(Boolean))].sort((a, b) => storeName(data.storesById.get(a), a).localeCompare(storeName(data.storesById.get(b), b)));
  const customersWithEmail = data.customers.filter((customer) => customerEmail(customer)).length;
  const customersWithPhone = data.customers.filter((customer) => customerPhone(customer)).length;
  const rootCount = data.customers.filter((customer) => customer.source === 'root').length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Customers" value={String(data.customers.length)} delta="Loaded from /customers and store customer subcollections" />
        <StatCard label="With email" value={String(customersWithEmail)} delta="Can be contacted by email" />
        <StatCard label="With phone" value={String(customersWithPhone)} delta="Can be contacted by phone/WhatsApp" />
        <StatCard label="Root records" value={String(rootCount)} delta="Direct /customers documents" />
      </section>

      {data.error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{data.error}</div> : null}

      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-100">
              <Users className="h-4 w-4" /> Customers from all stores
            </div>
            <h2 className="mt-5 max-w-4xl text-3xl font-bold tracking-tight sm:text-4xl">See customer records across every store.</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
              This combines the main /customers collection with customer subcollections under stores, then connects each customer to store names and recent orders where possible.
            </p>
          </div>
          <Link href="/admin/stores" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950 hover:bg-slate-100">
            Open Stores <Store className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <SectionCard title="Search customers">
        <form className="grid gap-3 lg:grid-cols-[1fr_280px_auto] lg:items-end" action="/admin/customers">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Search className="h-4 w-4" /> Search</span>
            <input name="q" defaultValue={params.q || ''} placeholder="Search name, email, phone, store name, or customer ID" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" />
          </label>
          <label className="block">
            <span className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Store</span>
            <select name="storeId" defaultValue={selectedStoreId} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10">
              <option value="">All stores</option>
              {storeIds.map((storeId) => <option key={storeId} value={storeId}>{storeName(data.storesById.get(storeId), storeId)}</option>)}
            </select>
          </label>
          <button className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800">Apply</button>
        </form>
      </SectionCard>

      <SectionCard title={`Customer directory (${filtered.length} shown)`}>
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm leading-6 text-slate-600">No customers matched this search.</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="hidden grid-cols-[1.1fr_1fr_1fr_0.8fr_150px] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
              <span>Customer</span><span>Contact</span><span>Store</span><span>Orders</span><span>Actions</span>
            </div>
            <div className="divide-y divide-slate-100">
              {filtered.slice(0, 200).map((customer) => {
                const storeId = customerStoreId(customer);
                const store = data.storesById.get(storeId);
                const orders = customerOrders(customer, data.orders);
                const spent = orders.reduce((sum, order) => sum + orderAmount(order), 0);
                const detailHref = `/admin/customers/${encodeURIComponent(customer.id)}${storeId ? `?storeId=${encodeURIComponent(storeId)}` : ''}`;
                const name = customerName(customer);

                return (
                  <div key={customer.path} className="grid gap-4 px-4 py-4 text-sm xl:grid-cols-[1.1fr_1fr_1fr_0.8fr_150px] xl:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><UserRound className="h-4 w-4" /></span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-950">{name}</p>
                          <p className="truncate text-xs text-slate-500">{customer.id}</p>
                        </div>
                      </div>
                      <p className="mt-2 break-all text-xs text-slate-400">{customer.path}</p>
                    </div>
                    <div className="space-y-1 text-slate-600">
                      <p className="flex items-center gap-2 truncate"><Mail className="h-3.5 w-3.5 text-slate-400" />{customerEmail(customer) || 'No email'}</p>
                      <p className="flex items-center gap-2 truncate"><Phone className="h-3.5 w-3.5 text-slate-400" />{customerPhone(customer) || 'No phone'}</p>
                    </div>
                    <div className="min-w-0 text-slate-600">
                      <p className="truncate font-semibold text-slate-950">{storeName(store, storeId || 'No store')}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{storeLocation(store) || storeId || 'Not linked'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge tone={orders.length > 0 ? 'green' : 'slate'}>{orders.length} orders</StatusBadge>
                      <StatusBadge tone={spent > 0 ? 'green' : 'slate'}>GHS {spent.toFixed(2)}</StatusBadge>
                      <StatusBadge tone={customer.source === 'root' ? 'blue' : 'slate'}>{customer.source === 'root' ? '/customers' : 'store customers'}</StatusBadge>
                    </div>
                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <Link href={detailHref} className="inline-flex items-center justify-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500">
                        Open <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                      <DeleteCustomerForm action={deleteCustomer} customerPath={customer.path} customerName={name} compact />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
