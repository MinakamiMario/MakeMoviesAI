import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://makemovies.ai';

type Props = {
  params: { id: string };
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient();

  const { data: project } = await supabase
    .from('projects')
    .select('title, description, profiles!director_id(username)')
    .eq('id', params.id)
    .single();

  if (!project) {
    return { title: 'Project not found' };
  }

  const director = (project.profiles as any)?.username || 'Unknown';
  const title = project.title;
  const description = project.description || `A film by @${director} on MakeMovies`;

  const ogUrl = `${siteUrl}/api/og?title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(`Directed by @${director}`)}&type=project`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} — MakeMovies`,
      description,
      url: `${siteUrl}/projects/${params.id}`,
      type: 'article',
      images: [
        {
          url: ogUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} — MakeMovies`,
      description,
      images: [ogUrl],
    },
  };
}

export default function ProjectLayout({ children }: Props) {
  return <>{children}</>;
}
