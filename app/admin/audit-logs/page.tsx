const logs = [
  { ts: '2026-05-12T08:22:13Z', actor: 'felix@sedifex.com', action: 'role.updated', target: 'user/ama' },
  { ts: '2026-05-12T07:13:41Z', actor: 'system', action: 'webhook.retry', target: 'delivery/evt_923' },
];

export default function AuditLogsPage() {
  return (
    <div><h2 className="text-2xl font-bold">Audit Logs</h2><p className="text-gray-600">Core safety feature enabled early.</p><ul className="mt-4 space-y-2">{logs.map((l)=><li key={l.ts+l.action} className="rounded border p-3 text-sm">{l.ts} · {l.actor} · {l.action} · {l.target}</li>)}</ul></div>
  );
}
