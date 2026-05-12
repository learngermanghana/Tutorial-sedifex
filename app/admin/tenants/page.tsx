const tenants = [
  { tenant: 'Sedifex HQ', stores: 16, plan: 'Enterprise' },
  { tenant: 'North Ops', stores: 5, plan: 'Business' },
];

export default function TenantsPage() {
  return (
    <div><h2 className="text-2xl font-bold">Tenants & Stores</h2><ul className="mt-4 space-y-2">{tenants.map((t)=><li key={t.tenant} className="rounded border p-3">{t.tenant} · {t.stores} stores · {t.plan}</li>)}</ul></div>
  );
}
