export default function AdminTopbar() {
  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500">
          Manage stores, users, integrations, and operations
        </p>
      </div>

      <div className="flex items-center gap-3">
        <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option>Platform</option>
          <option>Store</option>
        </select>

        <div className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium">
          Admin
        </div>
      </div>
    </header>
  );
}
