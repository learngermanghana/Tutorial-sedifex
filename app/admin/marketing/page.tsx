import MarketingCenterClient from '../../../components/admin/MarketingCenterClient';
import { listMarketingContacts, listMarketingSenderStores } from '../../../lib/marketing-contacts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function MarketingPage() {
  const [contacts, stores] = await Promise.all([
    listMarketingContacts().catch((error) => {
      console.error('[marketing] Failed to load contacts', error);
      return [];
    }),
    listMarketingSenderStores().catch((error) => {
      console.error('[marketing] Failed to load sender stores', error);
      return [];
    }),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-200">Marketing center</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">Filter contacts and send bulk campaigns</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          Build one audience from stores, customers, students, donors, volunteers, bookings, registrations, support requests, and orders. Select recipients and send through a store&apos;s Google Apps Script bulk email integration.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contacts loaded</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{contacts.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Opted out</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{contacts.filter((contact) => contact.optedOut).length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sender stores</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{stores.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Apps Script ready</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{stores.filter((store) => store.hasBulkEmailIntegration).length}</p>
        </div>
      </section>

      <MarketingCenterClient contacts={contacts} stores={stores} />
    </div>
  );
}
