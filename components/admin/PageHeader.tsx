import { ChevronRight, Home } from 'lucide-react';

export default function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Home className="h-3.5 w-3.5" />
        <span>Admin</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-700">{title}</span>
      </div>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
    </section>
  );
}
