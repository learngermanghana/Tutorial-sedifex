import Link from 'next/link';
import { sortedTutorials } from '@/data/tutorials';

type SidebarNavProps = {
  currentSlug?: string;
};

export function SidebarNav({ currentSlug }: SidebarNavProps) {
  return (
    <aside className="sticky top-4 h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-slate-900">Tutorial Sections</p>
      <ul className="space-y-1.5 text-sm">
        {sortedTutorials.map((item) => {
          const active = item.slug === currentSlug;
          const isChild = item.parentSlug === 'sell';

          return (
            <li key={item.slug} className={isChild ? 'pl-4' : ''}>
              <Link
                href={`/tutorials/${item.slug}`}
                className={`block rounded-lg px-3 py-2 transition ${
                  active ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {item.title}
                {isChild ? <span className="ml-2 text-xs text-slate-400">under Sell</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
