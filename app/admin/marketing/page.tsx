import MarketingCenterClient from '../../../components/admin/MarketingCenterClient';
import { listMarketingContacts } from '../../../lib/marketing-contacts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function MarketingPage() {
  const contacts = await listMarketingContacts().catch((error) => {
    console.error('[marketing] Failed to load contacts', error);
    return [];
  });

  const storeContacts = contacts.filter((contact) => contact.source.split(',').includes('stores') || contact.role.split(',').includes('store_owner'));
  const customerContacts = contacts.filter((contact) => {
    const sources = contact.source.split(',');
    const roles = contact.role.split(',');
    return sources.some((item) => ['customers', 'orders', 'bookings', 'support_requests'].includes(item)) || roles.some((item) => ['customer', 'buyer', 'booking_customer', 'support_request'].includes(item));
  });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-200">Marketing center</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">Send Sedifex Team campaigns</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          Build an audience from stores, customers, buyers, bookings, and support contacts. Choose stores, customers, or both, then send as Sedifex Team through the Sedifex marketing Apps Script.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contacts loaded</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{contacts.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stores</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{storeContacts.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customers</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{customerContacts.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Opted out</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{contacts.filter((contact) => contact.optedOut).length}</p>
        </div>
      </section>

      <MarketingCenterClient contacts={contacts} />
    </div>
  );
}