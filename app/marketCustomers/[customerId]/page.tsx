type MarketOrder = {
  orderId: string;
  clientName: string;
  email: string;
  city: string;
  amount: string;
  status: 'Paid' | 'Shipped' | 'Processing';
  purchasedAt: string;
};

const onlineClients: MarketOrder[] = [
  {
    orderId: 'SO-1042',
    clientName: 'Alex Rivera',
    email: 'alex.rivera@email.com',
    city: 'San Diego, CA',
    amount: '$148.00',
    status: 'Paid',
    purchasedAt: '2026-05-17',
  },
  {
    orderId: 'SO-1043',
    clientName: 'Kim Tran',
    email: 'kim.tran@email.com',
    city: 'Austin, TX',
    amount: '$89.50',
    status: 'Shipped',
    purchasedAt: '2026-05-17',
  },
  {
    orderId: 'SO-1044',
    clientName: 'Jordan Miller',
    email: 'jordan.miller@email.com',
    city: 'Seattle, WA',
    amount: '$212.99',
    status: 'Processing',
    purchasedAt: '2026-05-18',
  },
  {
    orderId: 'SO-1045',
    clientName: 'Priya Singh',
    email: 'priya.singh@email.com',
    city: 'Miami, FL',
    amount: '$64.90',
    status: 'Paid',
    purchasedAt: '2026-05-18',
  },
];

function statusStyles(status: MarketOrder['status']) {
  if (status === 'Paid') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  if (status === 'Shipped') return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
  return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
}

export default function MarketCustomerPage({
  params,
}: {
  params: { customerId: string };
}) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">Market customer</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Client online purchases</h1>
          <p className="mt-2 text-sm text-slate-300">
            Customer ID: <span className="font-semibold text-white">{params.customerId}</span>
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Total clients</p>
            <p className="mt-2 text-3xl font-bold">{onlineClients.length}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Orders paid</p>
            <p className="mt-2 text-3xl font-bold">
              {onlineClients.filter((order) => order.status === 'Paid').length}
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Processing</p>
            <p className="mt-2 text-3xl font-bold">
              {onlineClients.filter((order) => order.status === 'Processing').length}
            </p>
          </article>
        </div>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/[0.02] text-xs uppercase tracking-wide text-slate-300">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {onlineClients.map((order) => (
                  <tr key={order.orderId} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium">{order.orderId}</td>
                    <td className="px-4 py-3">{order.clientName}</td>
                    <td className="px-4 py-3 text-slate-300">{order.email}</td>
                    <td className="px-4 py-3 text-slate-300">{order.city}</td>
                    <td className="px-4 py-3">{order.amount}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-1 text-xs ${statusStyles(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{order.purchasedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
