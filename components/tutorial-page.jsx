import Image from 'next/image';
import Link from 'next/link';

export function TutorialPage({ tutorial }) {
  return (
    <article className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-700">Tutorial</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{tutorial.title}</h1>
        <p className="mt-3 max-w-3xl text-slate-600">{tutorial.intro}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {tutorial.roles.map((role) => (
            <span key={role} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {role}
            </span>
          ))}
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Key actions</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
            {tutorial.keyActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Role-based note</h2>
          <p className="mt-3 text-slate-700">
            Owners/Admins usually configure settings and policy, while staff focuses on quick execution during customer-facing operations.
          </p>
          <p className="mt-2 text-slate-700">
            If your navigation looks different, your workspace role may be limiting the sections you can access.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Step-by-step</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-slate-700">
          {tutorial.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Practical notes</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
          {tutorial.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      {tutorial.screenshot ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Screen example</h2>
          <div className="relative mt-4 overflow-hidden rounded-xl border border-slate-200">
            <Image src={tutorial.screenshot.src} alt={tutorial.screenshot.alt} width={1600} height={1000} className="h-auto w-full" />
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-teal-100 bg-teal-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-teal-900">Need deeper setup help?</h2>
        <p className="mt-2 text-teal-800">Explore platform details and contact options from the official Sedifex website.</p>
        <Link href="https://www.sedifex.com" className="mt-4 inline-flex rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
          Open www.sedifex.com
        </Link>
      </section>
    </article>
  );
}
