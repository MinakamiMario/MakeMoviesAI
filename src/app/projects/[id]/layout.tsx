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
    .select('title, description, forked_from_project_id, profiles!director_id(username)')
    .eq('id', params.id)
    .single();

  if (!project) {
    return { title: 'Project not found' };
  }

  // Parallel stats fetch for richer OG tags
  const [{ count: sceneCount }, { count: contribCount }, { count: forkCount }] = await Promise.all([
    supabase.from('scenes').select('*', { count: 'exact', head: true }).eq('project_id', params.id),
    supabase.from('contributions').select('*', { count: 'exact', head: true }).eq('project_id', params.id),
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('forked_from_project_id', params.id),
  ]);

  // Supabase may return joined profile as object or array depending on relationship
  const profileData = project.profiles as unknown;
  const director = (
    Array.isArray(profileData)
      ? (profileData[0] as { username: string } | undefined)?.username
      : (profileData as { username: string } | null)?.username
  ) || 'Unknown';
  const title = project.title;
  const isGenesis = !project.forked_from_project_id;
  const description = project.description
    || `A ${isGenesis ? 'genesis' : 'forked'} film by @${director} on MakeMovies`;

  const stats = [
    `${sceneCount || 0} scenes`,
    `${contribCount || 0} contributions`,
    `${forkCount || 0} forks`,
  ].join(' | ');

  const ogUrl = `${siteUrl}/api/og?title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(`Directed by @${director}`)}&type=project&stats=${encodeURIComponent(stats)}`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} — MakeMovies`,
      description,
      url: `${siteUrl}/projects/${params.id}`,
      type: 'video.other',
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
