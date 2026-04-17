import { notFound } from 'next/navigation';
import { PageShell } from '@/components/page-shell';
import { TutorialPage } from '@/components/tutorial-page';
import { getTutorialBySlug, sortedTutorials } from '@/data/tutorials';

export const dynamicParams = false;
export const dynamic = 'force-static';

export function generateStaticParams() {
  return sortedTutorials.map((tutorial) => ({ slug: tutorial.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const tutorial = getTutorialBySlug(slug);

  if (!tutorial) {
    return { title: 'Tutorial not found' };
  }

  return {
    title: tutorial.title,
    description: tutorial.description,
    alternates: {
      canonical: `https://tutorial.sedifex.com/tutorials/${tutorial.slug}`
    }
  };
}

export default async function TutorialDetailPage({ params }) {
  const { slug } = await params;
  const tutorial = getTutorialBySlug(slug);

  if (!tutorial) {
    notFound();
  }

  return (
    <PageShell currentSlug={tutorial.slug}>
      <TutorialPage tutorial={tutorial} />
    </PageShell>
  );
}
