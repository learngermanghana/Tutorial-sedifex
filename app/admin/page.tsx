const cards = [
  { title: "Active Stores", value: "24" },
  { title: "Orders Today", value: "182" },
  { title: "Webhook Failures", value: "3" },
  { title: "Admin Users", value: "12" },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
        <p className="text-gray-600">
          A quick snapshot of Sedifex platform activity.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-gray-500">{card.title}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
