const integrations = [
  { name: "Website API Client", type: "client_id / secret", status: "Active" },
  { name: "Webhook: Orders", type: "webhook", status: "Healthy" },
  { name: "Webhook: Catalog Sync", type: "webhook", status: "Retrying" },
];

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Integrations</h2>
        <p className="text-gray-600">
          Manage API credentials, webhooks, and delivery activity.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {integrations.map((item) => (
          <div
            key={item.name}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-gray-500">{item.type}</p>
            <h3 className="mt-2 text-lg font-semibold text-gray-900">{item.name}</h3>
            <p className="mt-2 text-sm text-gray-600">{item.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
