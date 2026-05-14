import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="relative h-56 sm:h-64">
          <img
            src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1000&q=80"
            alt="Team at Sedifex dashboard"
            className="absolute inset-0 h-full w-full object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />

          <div className="absolute left-4 top-4 rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-slate-950 shadow">
            Sedifex
          </div>
        </div>

        <div className="relative z-10 -mt-8 px-5 pb-5">
          <div className="rounded-2xl border border-white/10 bg-slate-950/95 p-5 shadow-xl">
            <h1 className="text-center text-2xl font-bold text-white">
              Manage your Sedifex store
            </h1>

            <p className="mt-2 text-center text-sm text-slate-400">
              Sign in to manage products, orders, bookings, and integrations.
            </p>

            <Link
              href="/admin/login"
              className="mt-6 flex w-full items-center justify-center rounded-xl bg-indigo-500 px-8 py-3 text-base font-semibold text-white transition hover:bg-indigo-400"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
