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
  bio: string | null;
  referral_count: number;
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

type ActivityItem = {
  type: 'project' | 'contribution' | 'accepted';
  title: string;
  projectTitle?: string;
  projectId?: string;
  date: string;
};

export default function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contributions, setContributions] = useState<ContributionWithProject[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [projectPage, setProjectPage] = useState(0);
  const [contribPage, setContribPage] = useState(0);
  const [projectTotal, setProjectTotal] = useState(0);
  const [contribTotal, setContribTotal] = useState(0);
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState('');
  const [bioSaving, setBioSaving] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const supabase = createClient();

  const isOwnProfile = currentUserId && profile && currentUserId === profile.id;

  useEffect(() => {
    async function load() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) setCurrentUserId(currentUser.id);

      // Single RPC call replaces 6+ sequential queries
      const { data: rpcData } = await supabase.rpc('get_user_profile_data', {
        p_username: username,
        p_page_size: PAGE_SIZE,
      });

      if (!rpcData || !(rpcData as any).found) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const d = rpcData as any;
      setProfile(d.profile);
      setBioText(d.profile.bio || '');
      setProjectTotal(d.project_count || 0);
      setContribTotal(d.contribution_count || 0);
      setProjects(d.projects || []);
      setContributions(d.contributions || []);

      // Map activity from RPC
      const activityItems: ActivityItem[] = (d.activity || []).map((a: any) => ({
        type: a.type,
        title: a.title,
        projectTitle: a.project_title,
        projectId: a.project_id,
        date: a.date,
      }));
      setActivity(activityItems);

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

  const handleSaveBio = async () => {
    if (!profile) return;
    setBioSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ bio: bioText.trim() || null })
      .eq('id', profile.id);
    if (!error) {
      setProfile({ ...profile, bio: bioText.trim() || null });
      setEditingBio(false);
    }
    setBioSaving(false);
  };

  const handleShareProfile = async () => {
    const url = `${window.location.origin}/users/${profile?.username}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `@${profile?.username} on MakeMovies`, url });
        return;
      } catch { /* fallback */ }
    }
    await navigator.clipboard.writeText(url);
    setShareMsg('Link copied!');
    setTimeout(() => setShareMsg(''), 2000);
  };

  const handleShareOnX = () => {
    const url = `${window.location.origin}/users/${profile?.username}`;
    const text = `Check out @${profile?.username}'s filmmaker profile on MakeMovies`;
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank'
    );
  };

  const formatActivityDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return formatDate(iso);
  };

  const getActivityIcon = (type: string) => {
    if (type === 'project') return '🎬';
    if (type === 'accepted') return '✅';
    return '🎭';
  };

  const getActivityLabel = (item: ActivityItem) => {
    if (item.type === 'project') return `Created "${item.title}"`;
    if (item.type === 'accepted') return `Contribution accepted: "${item.title}"`;
    return `Contributed to "${item.projectTitle}"`;
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
          <div className={styles.profileInfo}>
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
              {(profile?.referral_count || 0) > 0 && (
                <span className={styles.referralBadge}>
                  {profile?.referral_count} invited
                </span>
              )}
            </p>
            <div className={styles.profileActions}>
              {currentUserId && profile && currentUserId !== profile.id && (
                <Link href={`/inbox/new?to=${profile.username}`} className={styles.messageBtn}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  Message
                </Link>
              )}
              <button className={styles.shareBtn} onClick={handleShareProfile}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Share
              </button>
              <button className={styles.shareXBtn} onClick={handleShareOnX}>
                Share on X
              </button>
              {shareMsg && <span className={styles.shareConfirm}>{shareMsg}</span>}
            </div>
          </div>
        </section>

        {/* Bio */}
        <section className={styles.bioSection}>
          {isOwnProfile && editingBio ? (
            <div className={styles.bioEdit}>
              <textarea
                className={styles.bioTextarea}
                value={bioText}
                onChange={(e) => setBioText(e.target.value)}
                placeholder="Tell the community about yourself..."
                maxLength={280}
                rows={3}
              />
              <div className={styles.bioEditActions}>
                <span className={styles.bioCharCount}>{bioText.length}/280</span>
                <button className={styles.bioCancelBtn} onClick={() => { setEditingBio(false); setBioText(profile?.bio || ''); }}>
                  Cancel
                </button>
                <button className={styles.bioSaveBtn} onClick={handleSaveBio} disabled={bioSaving}>
                  {bioSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.bioDisplay}>
              {profile?.bio ? (
                <p className={styles.bioText}>{profile.bio}</p>
              ) : isOwnProfile ? (
                <p className={styles.bioPlaceholder}>Add a bio to tell people about yourself</p>
              ) : null}
              {isOwnProfile && (
                <button className={styles.bioEditBtn} onClick={() => setEditingBio(true)}>
                  {profile?.bio ? 'Edit bio' : 'Add bio'}
                </button>
              )}
            </div>
          )}
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

        {/* Activity Feed */}
        {activity.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Recent activity</h2>
            <div className={styles.activityFeed}>
              {activity.map((item, i) => (
                <div key={i} className={styles.activityItem}>
                  <span className={styles.activityIcon}>{getActivityIcon(item.type)}</span>
                  <div className={styles.activityContent}>
                    {item.projectId ? (
                      <Link href={`/projects/${item.projectId}`} className={styles.activityLink}>
                        {getActivityLabel(item)}
                      </Link>
                    ) : (
                      <span>{getActivityLabel(item)}</span>
                    )}
                    <span className={styles.activityDate}>{formatActivityDate(item.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

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
