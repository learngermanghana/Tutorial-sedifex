import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail, Phone, ShoppingBag, Store, UserRound } from 'lucide-react';
import DeleteCustomerForm from '../../../../components/admin/DeleteCustomerForm';
import { SectionCard, StatCard, StatusBadge } from '../../../../components/admin/ui';
import { adminFirestore, getFirebaseEnvStatus } from '../../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = Promise<{ customerId: string }>;
type SearchParams = Promise<{ storeId?: string }>;
type RawRecord = Record<string, unknown>;
type CustomerRecord = RawRecord & { id: string; path: string; source: 'root' | 'store-subcollection'; inferredStoreId?: string };
type StoreRecord = RawRecord & { id: string };
type OrderRecord = RawRecord & { id: string };

type CustomerDetailData = {
  error: string | null;
  customer: CustomerRecord | null;
  store: StoreRecord | null;
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

  redirect('/admin/customers');
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

function customerName(customer: CustomerRecord | null) {
  return firstText(customer || undefined, ['name', 'customerName', 'fullName', 'displayName', 'buyerName', 'contactName'], customer?.id || 'Customer');
}

function customerEmail(customer: CustomerRecord | null) {
  return firstText(customer || undefined, ['email', 'customerEmail', 'buyerEmail', 'publicEmail', 'contactEmail'], nestedText(customer || undefined, ['customer', 'email']));
}

function customerPhone(customer: CustomerRecord | null) {
  return firstText(customer || undefined, ['phone', 'phoneNumber', 'customerPhone', 'buyerPhone', 'contactPhone', 'whatsappNumber'], nestedText(customer || undefined, ['customer', 'phone']));
}

function customerAddress(customer: CustomerRecord | null) {
  const address = firstText(customer || undefined, ['address', 'addressLine1', 'deliveryAddress', 'customerAddress']);
  const city = firstText(customer || undefined, ['city', 'town']);
  const country = firstText(customer || undefined, ['country']);
  return [address, city, country].filter(Boolean).join(', ') || 'Not set';
}

function customerStoreId(customer: CustomerRecord | null) {
  return firstText(customer || undefined, ['storeId', 'merchantId', 'businessId', 'ownerUid'], customer?.inferredStoreId || '');
}

function storeName(store: StoreRecord | null, fallback = 'Unknown store') {
  return firstText(store || undefined, ['displayName', 'storeName', 'name', 'businessName', 'merchantName'], fallback);
}

function storeLocation(store: StoreRecord | null) {
  const city = firstText(store || undefined, ['city', 'storeCity']);
  const country = firstText(store || undefined, ['country', 'storeCountry']);
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

function formatDate(value: unknown) {
  const millis = timestampToMillis(value);
  if (!millis) return 'Not set';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(millis));
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

function orderStoreId(order: OrderRecord) {
  return firstText(order, ['storeId', 'merchantId', 'businessId']);
}

function orderItems(order: OrderRecord) {
  return Array.isArray(order.items) ? order.items as RawRecord[] : [];
}

function orderStatus(order: OrderRecord) {
  return firstText(order, ['paymentStatus', 'orderStatus', 'status'], 'Unknown');
}

function normalizeCustomerDoc(doc: FirebaseFirestore.DocumentSnapshot, source: CustomerRecord['source']): CustomerRecord | null {
  if (!doc.exists) return null;
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

function matchesCustomer(order: OrderRecord, customer: CustomerRecord) {
  const id = customer.id;
  const email = customerEmail(customer).toLowerCase();
  const phone = customerPhone(customer);
  const storeId = customerStoreId(customer);
  const sameCustomerId = Boolean(id && orderCustomerId(order) === id);
  const sameEmail = Boolean(email && orderCustomerEmail(order) === email);
  const samePhone = Boolean(phone && orderCustomerPhone(order) === phone);
  const sameStore = !storeId || orderStoreId(order) === storeId;
  return sameStore && (sameCustomerId || sameEmail || samePhone);
}

async function findCustomer(customerId: string, storeId?: string): Promise<CustomerDetailData> {
  const env = getFirebaseEnvStatus();
  if (!env.ready) return { error: 'Firebase environment variables are not ready.', customer: null, store: null, orders: [] };

  try {
    const db = adminFirestore();
    let customer: CustomerRecord | null = null;

    if (storeId) {
      customer = normalizeCustomerDoc(await db.doc(`stores/${storeId}/customers/${customerId}`).get(), 'store-subcollection');
    }

    if (!customer) {
      customer = normalizeCustomerDoc(await db.doc(`customers/${customerId}`).get(), 'root');
    }

    if (!customer) {
      const groupSnap = await db.collectionGroup('customers').where('__name__', '==', customerId).limit(10).get();
      const matchingDoc = storeId ? groupSnap.docs.find((doc) => doc.ref.path.startsWith(`stores/${storeId}/`)) : groupSnap.docs[0];
      customer = matchingDoc ? normalizeCustomerDoc(matchingDoc, matchingDoc.ref.path.startsWith('customers/') ? 'root' : 'store-subcollection') : null;
    }

    if (!customer) return { error: `Customer not found: ${customerId}`, customer: null, store: null, orders: [] };

    const resolvedStoreId = customerStoreId(customer) || storeId || '';
    const [storeSnap, ordersSnap] = await Promise.all([
      resolvedStoreId ? db.doc(`stores/${resolvedStoreId}`).get().catch(() => null) : Promise.resolve(null),
      db.collection('integrationOrders').limit(500).get().catch(() => null),
    ]);

    const store = storeSnap?.exists ? { ...(storeSnap.data() as RawRecord), id: storeSnap.id } as StoreRecord : null;
    const orders = (ordersSnap?.docs || [])
      .map((doc) => ({ ...(doc.data() as RawRecord), id: doc.id } as OrderRecord))
      .filter((order) => matchesCustomer(order, customer as CustomerRecord))
      .sort((a, b) => timestampToMillis(b.updatedAt || b.createdAt || b.paymentUpdatedAt) - timestampToMillis(a.updatedAt || a.createdAt || a.paymentUpdatedAt));

    return { error: null, customer, store, orders };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to load customer.', customer: null, store: null, orders: [] };
  }
}

function InfoCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-base font-bold text-slate-950">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid gap-1 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[150px_1fr] sm:items-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default async function CustomerDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { customerId } = await params;
  const query = await searchParams;
  const decodedCustomerId = decodeURIComponent(customerId);
  const data = await findCustomer(decodedCustomerId, query.storeId);
  const customer = data.customer;
  const spent = data.orders.reduce((sum, order) => sum + orderAmount(order), 0);
  const lastOrder = data.orders[0];
  const storeId = customerStoreId(customer);
  const name = customerName(customer);

  if (!customer) {
    return (
      <div className="space-y-6">
        <Link href="/admin/customers" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500"><ArrowLeft className="h-4 w-4" /> Back to customers</Link>
        <SectionCard title="Customer not found"><p className="text-sm leading-6 text-slate-600">{data.error || 'This customer could not be loaded.'}</p></SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/customers" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500"><ArrowLeft className="h-4 w-4" /> Back to customers</Link>
        <DeleteCustomerForm action={deleteCustomer} customerPath={customer.path} customerName={name} />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-100">
              <UserRound className="h-4 w-4" /> Customer profile
            </div>
            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">{name}</h2>
            <p className="mt-2 break-all text-sm leading-7 text-slate-300">Customer ID: {customer.id}</p>
            <p className="mt-1 break-all text-sm leading-7 text-slate-300">Path: {customer.path}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={customer.source === 'root' ? 'blue' : 'slate'}>{customer.source === 'root' ? '/customers' : 'store customer'}</StatusBadge>
            <StatusBadge tone={data.orders.length > 0 ? 'green' : 'slate'}>{data.orders.length} orders</StatusBadge>
            <StatusBadge tone={spent > 0 ? 'green' : 'slate'}>GHS {spent.toFixed(2)}</StatusBadge>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Orders" value={data.orders.length} />
        <InfoCard label="Total spent" value={`GHS ${spent.toFixed(2)}`} />
        <InfoCard label="Last order" value={lastOrder ? formatDate(lastOrder.updatedAt || lastOrder.createdAt || lastOrder.paymentUpdatedAt) : 'No order'} />
        <InfoCard label="Store" value={storeName(data.store, storeId || 'Not linked')} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="space-y-6">
          <SectionCard title="Customer information">
            <div className="grid gap-3">
              <DetailRow label="Name" value={name} />
              <DetailRow label="Email" value={customerEmail(customer) || 'Not set'} />
              <DetailRow label="Phone" value={customerPhone(customer) || 'Not set'} />
              <DetailRow label="Address" value={customerAddress(customer)} />
              <DetailRow label="Created" value={formatDate(customer.createdAt || customer.createTime)} />
              <DetailRow label="Updated" value={formatDate(customer.updatedAt || customer.updateTime)} />
            </div>
          </SectionCard>

          <SectionCard title="Order history">
            {data.orders.length === 0 ? (
              <p className="text-sm leading-6 text-slate-600">No orders found for this customer from the first 500 integration orders.</p>
            ) : (
              <div className="space-y-3">
                {data.orders.slice(0, 25).map((order) => (
                  <div key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-slate-950">Order {order.id}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(order.updatedAt || order.createdAt || order.paymentUpdatedAt)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge tone={orderStatus(order).toLowerCase().includes('paid') || orderStatus(order).toLowerCase().includes('active') ? 'green' : 'slate'}>{orderStatus(order)}</StatusBadge>
                        <StatusBadge tone="blue">GHS {orderAmount(order).toFixed(2)}</StatusBadge>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      {orderItems(order).slice(0, 5).map((item, index) => (
                        <p key={`${order.id}-${index}`} className="flex items-start gap-2 text-xs text-slate-600"><ShoppingBag className="mt-0.5 h-3.5 w-3.5 text-slate-400" />{text(item.type || item.item_type, 'item')} • {text(item.name || item.productName || item.serviceName, 'Item')} • Qty {text(item.qty || item.quantity, '1')}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Contact actions">
            <div className="grid gap-3">
              {customerEmail(customer) ? <a href={`mailto:${customerEmail(customer)}`} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-500"><Mail className="h-4 w-4" /> Email customer</a> : null}
              {customerPhone(customer) ? <a href={`tel:${customerPhone(customer)}`} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><Phone className="h-4 w-4" /> Call customer</a> : null}
            </div>
          </SectionCard>

          <SectionCard title="Linked store">
            <div className="space-y-3">
              <DetailRow label="Store" value={storeName(data.store, storeId || 'Not linked')} />
              <DetailRow label="Store ID" value={storeId || 'Not set'} />
              <DetailRow label="Location" value={storeLocation(data.store) || 'Not set'} />
              {storeId ? <Link href={`/admin/stores/${encodeURIComponent(storeId)}`} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"><Store className="h-4 w-4" /> Open store</Link> : null}
            </div>
          </SectionCard>

          <SectionCard title="Danger zone">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <p className="font-semibold">Delete this fake or wrong customer record.</p>
              <p className="mt-1 leading-6">This only deletes the customer document. It does not delete orders or the linked store.</p>
              <div className="mt-4">
                <DeleteCustomerForm action={deleteCustomer} customerPath={customer.path} customerName={name} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Raw customer data">
            <div className="max-h-[520px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
              <pre>{JSON.stringify(customer, null, 2)}</pre>
            </div>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
