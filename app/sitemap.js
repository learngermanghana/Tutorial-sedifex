import { sortedTutorials } from '@/data/tutorials';

export default function sitemap() {
  const baseUrl = 'https://tutorial.sedifex.com';

  return [
    {
      url: baseUrl,
      changeFrequency: 'weekly',
      priority: 1
    },
    ...sortedTutorials.map((tutorial) => ({
      url: `${baseUrl}/tutorials/${tutorial.slug}`,
      changeFrequency: 'weekly',
      priority: 0.8
    }))
  ];
}
