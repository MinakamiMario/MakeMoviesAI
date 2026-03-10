'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import { CardSkeleton } from '@/components/ui';
import styles from './page.module.css';

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
};

type Project = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
};

type ContributionWithProject = {
  id: string;
  title: string;
  status: 'pending' | 'accepted' | 'forked';
  created_at: string;
  projects: { id: string; title: string } | null;
};

export default function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contributions, setContributions] = useState<ContributionWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      // Fetch profile by username
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, created_at')
        .eq('username', username)
        .single();

      if (!profileData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProfile(profileData);

      // Fetch user's directed projects and contributions in parallel
      const [projectsRes, contributionsRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, title, description, created_at')
          .eq('director_id', profileData.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('contributions')
          .select('id, title, status, created_at, projects!project_id(id, title)')
          .eq('contributor_id', profileData.id)
          .order('created_at', { ascending: false }),
      ]);

      setProjects(projectsRes.data || []);
      // Supabase returns the joined table as an object (single relation)
      // but TypeScript may infer it as an array; normalize it
      const contribs = (contributionsRes.data || []).map((c: any) => ({
        ...c,
        projects: Array.isArray(c.projects) ? c.projects[0] || null : c.projects,
      })) as ContributionWithProject[];
      setContributions(contribs);
      setLoading(false);
    }

    load();
  }, [username]);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  const acceptedCount = contributions.filter((c) => c.status === 'accepted').length;
  const forkedCount = contributions.filter((c) => c.status === 'forked').length;

  if (loading) {
    return (
      <main className={styles.main}>
        <Navbar />
        <div className={styles.content}>
          <div className={styles.profileSkeleton}>
            <div className={styles.avatarSkeleton} />
            <div className={styles.nameSkeleton} />
            <div className={styles.metaSkeleton} />
          </div>
          <div className={styles.grid}>
            {Array.from({ length: 3 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className={styles.main}>
        <Navbar />
        <div className={styles.content}>
          <div className={styles.notFound}>
            <h1>User not found</h1>
            <p>No user with the handle @{username} exists.</p>
            <Link href="/projects" className={styles.backLink}>
              Browse projects
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <Navbar />
      <div className={styles.content}>
        {/* Profile header */}
        <section className={styles.profileHeader}>
          <div className={styles.avatar}>
            {(profile?.username || '?')[0].toUpperCase()}
          </div>
          <div>
            <h1 className={styles.displayName}>@{profile?.username}</h1>
            <p className={styles.joined}>
              Joined {profile?.created_at ? formatDate(profile.created_at) : ''}
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statNumber}>{projects.length}</span>
            <span className={styles.statLabel}>
              {projects.length === 1 ? 'Project' : 'Projects'}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNumber}>{contributions.length}</span>
            <span className={styles.statLabel}>
              {contributions.length === 1 ? 'Contribution' : 'Contributions'}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNumber}>{acceptedCount}</span>
            <span className={styles.statLabel}>Accepted</span>
          </div>
          {forkedCount > 0 && (
            <div className={styles.stat}>
              <span className={styles.statNumber}>{forkedCount}</span>
              <span className={styles.statLabel}>Forked</span>
            </div>
          )}
        </section>

        {/* Projects */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Projects directed
            {projects.length > 0 && (
              <span className={styles.count}>{projects.length}</span>
            )}
          </h2>
          {projects.length === 0 ? (
            <p className={styles.empty}>No projects yet.</p>
          ) : (
            <div className={styles.grid}>
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className={styles.card}
                >
                  <h3>{project.title}</h3>
                  {project.description && (
                    <p className={styles.cardDescription}>{project.description}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Contributions */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Contributions
            {contributions.length > 0 && (
              <span className={styles.count}>{contributions.length}</span>
            )}
          </h2>
          {contributions.length === 0 ? (
            <p className={styles.empty}>No contributions yet.</p>
          ) : (
            <div className={styles.contributionList}>
              {contributions.map((c) => (
                <Link
                  key={c.id}
                  href={c.projects ? `/projects/${c.projects.id}` : '#'}
                  className={styles.contributionRow}
                >
                  <div className={styles.contributionInfo}>
                    <span className={styles.contributionTitle}>{c.title}</span>
                    {c.projects && (
                      <span className={styles.contributionProject}>
                        in {c.projects.title}
                      </span>
                    )}
                  </div>
                  <span
                    className={`${styles.statusBadge} ${
                      c.status === 'accepted'
                        ? styles.statusAccepted
                        : c.status === 'forked'
                        ? styles.statusForked
                        : styles.statusPending
                    }`}
                  >
                    {c.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
