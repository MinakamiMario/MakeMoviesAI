import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://makemovies.ai';

type Props = {
  params: { username: string };
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, reputation_score, contribution_count, accepted_count')
    .eq('username', params.username)
    .single();

  if (!profile) {
    return { title: 'User not found' };
  }

  const { data: projectCount } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('director_id', profile.username);

  const title = `@${profile.username}`;
  const description = `Filmmaker on MakeMovies with ${profile.reputation_score || 0} reputation points`;
  const stats = `${profile.contribution_count || 0} contributions | ${profile.accepted_count || 0} accepted`;

  const ogUrl = `${siteUrl}/api/og?title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(description)}&type=user&stats=${encodeURIComponent(stats)}`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} — MakeMovies`,
      description,
      url: `${siteUrl}/users/${params.username}`,
      type: 'profile',
      images: [
        {
          url: ogUrl,
          width: 1200,
          height: 630,
          alt: `@${profile.username} on MakeMovies`,
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

export default function UserLayout({ children }: Props) {
  return <>{children}</>;
}
