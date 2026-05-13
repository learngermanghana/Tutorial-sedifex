import { SectionCard, StatusBadge } from '../../../components/admin/ui';

const users = [
  { name: 'Nia Mensah', role: 'Super Admin', email: 'nia@sedi.io', status: 'Active' },
  { name: 'Darius Cole', role: 'Ops Admin', email: 'darius@sedi.io', status: 'Pending Invite' },
  { name: 'Priya Desai', role: 'Security Admin', email: 'priya@sedi.io', status: 'Active' },
];

export default function UsersPage() {
  return <SectionCard title="Admin Users" action={<button className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white">Invite Admin</button>}><div className="overflow-hidden rounded-xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{users.map((user) => <tr key={user.email} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-4 py-3"><p className="font-medium text-slate-900">{user.name}</p></td><td className="px-4 py-3 text-slate-600">{user.email}</td><td className="px-4 py-3"><StatusBadge tone="slate">{user.role}</StatusBadge></td><td className="px-4 py-3"><StatusBadge tone={user.status === 'Active' ? 'green' : 'yellow'}>{user.status}</StatusBadge></td></tr>)}</tbody></table></div></SectionCard>;
}
