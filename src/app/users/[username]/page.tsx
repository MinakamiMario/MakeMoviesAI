'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import { CardSkeleton } from '@/components/ui';
import styles from './page.module.css';

const PAGE_SIZE = 12;

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  reputation_score: number;
  comment_count: number;
  contribution_count: number;
  accepted_count: number;
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [projectPage, setProjectPage] = useState(0);
  const [contribPage, setContribPage] = useState(0);
  const [projectTotal, setProjectTotal] = useState(0);
  const [contribTotal, setContribTotal] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      // Get current user for "Message" button visibility
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) setCurrentUserId(currentUser.id);

      // Fetch profile by username
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, created_at, reputation_score, comment_count, contribution_count, accepted_count')
        .eq('username', username)
        .single();

      if (!profileData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProfile(profileData);

      // Fetch counts for stats
      const [projectsCount, contributionsCount] = await Promise.all([
        supabase
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .eq('director_id', profileData.id),
        supabase
          .from('contributions')
          .select('id', { count: 'exact', head: true })
          .eq('contributor_id', profileData.id),
      ]);

      setProjectTotal(projectsCount.count || 0);
      setContribTotal(contributionsCount.count || 0);

      // Fetch first page of projects and contributions
      const [projectsRes, contributionsRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, title, description, created_at')
          .eq('director_id', profileData.id)
          .order('created_at', { ascending: false })
          .range(0, PAGE_SIZE - 1),
        supabase
          .from('contributions')
          .select('id, title, status, created_at, projects!project_id(id, title)')
          .eq('contributor_id', profileData.id)
          .order('created_at', { ascending: false })
          .range(0, PAGE_SIZE - 1),
      ]);

      setProjects(projectsRes.data || []);
      const contribs = (contributionsRes.data || []).map((c: any) => ({
        ...c,
        projects: Array.isArray(c.projects) ? c.projects[0] || null : c.projects,
      })) as ContributionWithProject[];
      setContributions(contribs);
      setLoading(false);
    }

    load();
  }, [username]);

  // Project page changes
  useEffect(() => {
    if (!profile || loading) return;
    const from = projectPage * PAGE_SIZE;
    supabase
      .from('projects')
      .select('id, title, description, created_at')
      .eq('director_id', profile.id)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
      .then(({ data }) => setProjects(data || []));
  }, [projectPage]);

  // Contribution page changes
  useEffect(() => {
    if (!profile || loading) return;
    const from = contribPage * PAGE_SIZE;
    supabase
      .from('contributions')
      .select('id, title, status, created_at, projects!project_id(id, title)')
      .eq('contributor_id', profile.id)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
      .then(({ data }) => {
        const contribs = (data || []).map((c: any) => ({
          ...c,
          projects: Array.isArray(c.projects) ? c.projects[0] || null : c.projects,
        })) as ContributionWithProject[];
        setContributions(contribs);
      });
  }, [contribPage]);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  const acceptedCount = contributions.filter((c) => c.status === 'accepted').length;
  const forkedCount = contributions.filter((c) => c.status === 'forked').length;

  const getStarCount = (score: number) => {
    if (score >= 500) return 5;
    if (score >= 200) return 4;
    if (score >= 100) return 3;
    if (score >= 50) return 2;
    if (score >= 10) return 1;
    return 0;
  };

  const getStarLabel = (stars: number) => {
    if (stars >= 5) return 'Legend';
    if (stars >= 4) return 'Veteran';
    if (stars >= 3) return 'Trusted';
    if (stars >= 2) return 'Active';
    if (stars >= 1) return 'Rising';
    return 'Newcomer';
  };

  const starCount = profile ? getStarCount(profile.reputation_score) : 0;
  const starLabel = getStarLabel(starCount);
  const projectPages = Math.ceil(projectTotal / PAGE_SIZE);
  const contribPages = Math.ceil(contribTotal / PAGE_SIZE);

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
            {starCount > 0 && (
              <div className={styles.reputation}>
                <span className={styles.reputationStars}>
                  {'★'.repeat(starCount)}{'☆'.repeat(5 - starCount)}
                </span>
                <span className={styles.reputationLabel}>{starLabel}</span>
                <span className={styles.reputationScore}>{profile?.reputation_score} pts</span>
              </div>
            )}
            <p className={styles.joined}>
              Joined {profile?.created_at ? formatDate(profile.created_at) : ''}
            </p>
            {currentUserId && profile && currentUserId !== profile.id && (
              <Link href={`/inbox/new?to=${profile.username}`} className={styles.messageBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Message
              </Link>
            )}
          </div>
        </section>

        {/* Stats */}
        <section className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statNumber}>{projectTotal}</span>
            <span className={styles.statLabel}>
              {projectTotal === 1 ? 'Project' : 'Projects'}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNumber}>{contribTotal}</span>
            <span className={styles.statLabel}>
              {contribTotal === 1 ? 'Contribution' : 'Contributions'}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNumber}>{profile?.comment_count || 0}</span>
            <span className={styles.statLabel}>
              {(profile?.comment_count || 0) === 1 ? 'Comment' : 'Comments'}
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
            {projectTotal > 0 && (
              <span className={styles.count}>{projectTotal}</span>
            )}
          </h2>
          {projects.length === 0 ? (
            <p className={styles.empty}>No projects yet.</p>
          ) : (
            <>
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
              {projectPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setProjectPage((p) => p - 1)}
                    disabled={projectPage === 0}
                  >
                    Previous
                  </button>
                  <span className={styles.pageInfo}>
                    Page {projectPage + 1} of {projectPages}
                  </span>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setProjectPage((p) => p + 1)}
                    disabled={projectPage + 1 >= projectPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Contributions */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Contributions
            {contribTotal > 0 && (
              <span className={styles.count}>{contribTotal}</span>
            )}
          </h2>
          {contributions.length === 0 ? (
            <p className={styles.empty}>No contributions yet.</p>
          ) : (
            <>
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
              {contribPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setContribPage((p) => p - 1)}
                    disabled={contribPage === 0}
                  >
                    Previous
                  </button>
                  <span className={styles.pageInfo}>
                    Page {contribPage + 1} of {contribPages}
                  </span>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setContribPage((p) => p + 1)}
                    disabled={contribPage + 1 >= contribPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
