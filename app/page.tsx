import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        <img
          src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1400&q=80"
          alt="Team at Sedifex dashboard"
          className="h-[420px] w-full object-cover"
        />
        <div className="flex justify-center p-6">
          <Link
            href="/admin/login"
            className="rounded-lg bg-indigo-500 px-8 py-3 text-base font-semibold text-white transition hover:bg-indigo-400"
          >
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
