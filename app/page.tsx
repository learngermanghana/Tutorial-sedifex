import Link from "next/link";

const highlights = ["Stores", "Products", "Bookings", "Integrations"];

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-white">
      <div className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="absolute -right-24 bottom-16 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />

      <section className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur sm:p-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500 text-lg font-black shadow-lg shadow-indigo-500/20">
              S
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-200">
                Sedifex
              </p>
              <p className="text-xs text-slate-400">Admin Console</p>
            </div>
          </div>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
            Secure access
          </span>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Manage Sedifex faster.
          </h1>
          <p className="max-w-md text-base leading-7 text-slate-300">
            Sign in to manage stores, product feeds, bookings, checkout setup,
            and integrations from one clean dashboard.
          </p>
        </div>

        <div className="mt-7 flex flex-wrap gap-2">
          {highlights.map((item) => (
            <span
              key={item}
              className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm text-slate-200"
            >
              {item}
            </span>
          ))}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto]">
          <Link
            href="/admin/login"
            className="inline-flex items-center justify-center rounded-2xl bg-indigo-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            Log in to admin
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            View dashboard
          </Link>
        </div>

        <p className="mt-6 text-xs leading-6 text-slate-500">
          Lightweight landing page with no external hero image, so it loads
          quicker and keeps the first screen focused on login.
        </p>
      </section>
    </main>
  );
}
