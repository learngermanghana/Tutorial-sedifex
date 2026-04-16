import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
          Sedifex Tutorials
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/tutorials/dashboard" className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:border-teal-300 hover:text-teal-700">
            Start Learning
          </Link>
          <a href="https://www.sedifex.com" target="_blank" rel="noreferrer" className="rounded-full bg-teal-600 px-3 py-1.5 font-medium text-white hover:bg-teal-700">
            Visit Sedifex
          </a>
        </nav>
      </div>
    </header>
  );
}
