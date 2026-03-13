import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://makemovies.ai';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${siteUrl}/projects`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${siteUrl}/signup`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/login`, changeFrequency: 'monthly', priority: 0.5 },
  ];

  // Dynamic: all public projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, created_at')
    .order('created_at', { ascending: false })
    .limit(5000);

  const projectPages: MetadataRoute.Sitemap = (projects || []).map((p) => ({
    url: `${siteUrl}/projects/${p.id}`,
    lastModified: new Date(p.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Dynamic: public user profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('username, created_at')
    .not('username', 'is', null)
    .limit(5000);

  const profilePages: MetadataRoute.Sitemap = (profiles || []).map((p) => ({
    url: `${siteUrl}/users/${p.username}`,
    lastModified: new Date(p.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...projectPages, ...profilePages];
}
