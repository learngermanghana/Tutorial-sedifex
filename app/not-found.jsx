import Link from 'next/link';
import { PageShell } from '@/components/page-shell';

export default function NotFound() {
  return (
    <PageShell>
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-slate-600">The tutorial you requested may have moved. Return home and choose a section from the tutorial index.</p>
        <Link href="/" className="mt-4 inline-flex rounded-full bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700">
          Go to home
        </Link>
      </section>
    </PageShell>
  );
}
