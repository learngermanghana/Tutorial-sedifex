import { SectionCard } from '../../../components/admin/ui';

export default function SettingsPage() {
  return <SectionCard title="Admin Settings"><div className="space-y-3 text-sm"><p className="rounded-xl border border-slate-200 p-3">Session policy: 12h inactivity timeout.</p><p className="rounded-xl border border-slate-200 p-3">MFA enforcement: Required for super_admin and ops_admin.</p><p className="rounded-xl border border-slate-200 p-3">Scope default: Platform context with store override.</p></div></SectionCard>;
}
