const stores = [
  { name: "Glittering Med Spa", plan: "Pro", status: "Active", location: "Accra" },
  { name: "Kwaku Lotteryy", plan: "Business", status: "Pending", location: "Tema" },
  { name: "Makeup N More School", plan: "Starter", status: "Active", location: "Tema" },
];

export default function StoresPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Stores</h2>
        <p className="text-gray-600">Manage store lifecycle, plan, and verification.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Location</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => (
              <tr key={store.name} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium text-gray-900">{store.name}</td>
                <td className="px-4 py-3">{store.plan}</td>
                <td className="px-4 py-3">{store.status}</td>
                <td className="px-4 py-3">{store.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
