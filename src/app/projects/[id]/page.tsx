'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';
import ProjectHeader from '@/components/ProjectHeader';
import SceneTimeline from '@/components/SceneTimeline';
import PendingContributions from '@/components/PendingContributions';
import { Skeleton, SceneSkeleton } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { Scene, Contribution, ForkOrigin, BranchData, Project } from '@/types';
import { loadProjectData } from '@/lib/projectLoader';
import { acceptContribution, forkContribution } from '@/lib/decisions';

// Code-split heavy components (loaded after initial render)
const CinemaMode = dynamic(() => import('@/components/CinemaMode'), { ssr: false });
const ContributionReview = dynamic(() => import('@/components/ContributionReview'), { ssr: false });
const Comments = dynamic(() => import('@/components/Comments'));
const DecisionLog = dynamic(() => import('@/components/DecisionLog'));
const LineageTree = dynamic(() => import('@/components/LineageTree'));
const CreditsRoll = dynamic(() => import('@/components/CreditsRoll'));
const ProjectAnalytics = dynamic(() => import('@/components/ProjectAnalytics'));

export default function ProjectPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<Project | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [branch, setBranch] = useState<BranchData | null>(null);
  const [forkedFrom, setForkedFrom] = useState<ForkOrigin | null>(null);
  const [forkCount, setForkCount] = useState(0);
  const [forkDepth, setForkDepth] = useState<number | null>(null);
  const [forkCountLabel, setForkCountLabel] = useState<string | null>(null);
  const [forkPointLabel, setForkPointLabel] = useState<string | null>(null);
  const [forkedByLabel, setForkedByLabel] = useState<string | null>(null);
  const [forkedAtLabel, setForkedAtLabel] = useState<string | null>(null);
  const [isDirector, setIsDirector] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [cinemaOpen, setCinemaOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [shareConfirm, setShareConfirm] = useState(false);

  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();

  const handleShare = async () => {
    const url = `${window.location.origin}/projects/${params.id}`;
    const text = project ? `Watch "${project.title}" on MakeMovies` : 'Check out this film on MakeMovies';

    if (navigator.share) {
      try {
        await navigator.share({ title: project?.title || 'MakeMovies', text, url });
        return;
      } catch {
        // User cancelled or not supported — fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(url);
    setShareConfirm(true);
    setTimeout(() => setShareConfirm(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const url = `${window.location.origin}/projects/${params.id}`;
    const text = project ? `Watch "${project.title}" on MakeMovies\n${url}` : url;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareX = () => {
    const url = `${window.location.origin}/projects/${params.id}`;
    const text = project
      ? `Watch "${project.title}" — a collaborative film on @MakeMoviesAI`
      : 'Check out this film on MakeMovies';
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
  };

  useEffect(() => {
    loadData();
  }, [params.id]);

  // Track view on page load
  useEffect(() => {
    if (!loading && project) {
      supabase.rpc('track_project_view', {
        p_project_id: params.id,
        p_viewer_id: user?.id || null,
      }).then(() => {});
    }
  }, [loading, project?.id]);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    const data = await loadProjectData(supabase, params.id, user?.id || null);

    if (!data) {
      router.push('/projects');
      return;
    }

    setProject(data.project);
    setScenes(data.scenes);
    setContributions(data.contributions);
    setBranch(data.branch);
    setForkedFrom(data.forkedFrom);
    setForkCount(data.forkCount);
    setForkDepth(data.forkDepth);
    setForkCountLabel(data.forkCountLabel);
    setForkPointLabel(data.forkPointLabel);
    setForkedByLabel(data.forkedByLabel);
    setForkedAtLabel(data.forkedAtLabel);
    setIsDirector(data.isDirector);
    setLoading(false);
  };

  const findParentScene = (parentSceneId: string | null): Scene | null => {
    if (!parentSceneId) return null;
    return scenes.find(s => s.id === parentSceneId) || null;
  };

  const getParentSceneOrder = (parentSceneId: string | null): number => {
    if (!parentSceneId) return 0;
    const index = scenes.findIndex(s => s.id === parentSceneId);
    return index >= 0 ? index + 1 : 0;
  };

  const handleAccept = async (contribution: Contribution) => {
    if (!branch || !user) {
      console.error('handleAccept: missing branch or user');
      return;
    }

    const result = await acceptContribution(
      supabase,
      params.id,
      branch,
      contribution
    );

    if (!result.success) {
      toast.error(result.error || 'Failed to accept contribution');
      return;
    }

    toast.success('Contribution accepted — new scene added!');
    setSelectedContribution(null);
    loadData();
  };

  const handleFork = async (contribution: Contribution) => {
    if (!user) {
      console.error('handleFork: not authenticated');
      return;
    }

    const result = await forkContribution(supabase, contribution);

    if (!result.success) {
      toast.error(result.error || 'Failed to fork contribution');
      return;
    }

    toast.success('Forked! A new project has been created.');
    setSelectedContribution(null);
    loadData();
  };

  const handleExportRequest = async () => {
    if (!user) {
      toast.error('Sign in to export');
      return;
    }

    setExportLoading(true);
    const { data } = await supabase.rpc('request_project_export', {
      p_project_id: params.id,
      p_resolution: '720p',
    });

    if (data?.error) {
      toast.error(data.error);
    } else if (data?.success) {
      toast.success('Export requested! We\'ll notify you when it\'s ready.');
    }
    setExportLoading(false);
  };

  if (loading) {
    return (
      <main className={styles.main}>
        <Navbar />
        <div className={styles.content}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <Skeleton width="50%" height="2rem" />
            <Skeleton width="80%" height="1rem" />
            <Skeleton width="30%" height="0.875rem" />
          </div>
          <div style={{ marginTop: 'var(--space-2xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <Skeleton width="6rem" height="1.5rem" />
            {Array.from({ length: 3 }).map((_, i) => (
              <SceneSkeleton key={i} />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!project) return null;

  const hasPlayableScenes = scenes.some(s => s.media_url);

  return (
    <main className={styles.main}>
      <Navbar />

      <div className={styles.content}>
        <ProjectHeader
          project={project}
          forkedFrom={forkedFrom}
          forkCount={forkCount}
          forkDepth={forkDepth}
          forkCountLabel={forkCountLabel}
          forkPointLabel={forkPointLabel}
          forkedByLabel={forkedByLabel}
          forkedAtLabel={forkedAtLabel}
        />

        {/* Action bar: Watch Film, Export, Compare */}
        {scenes.length > 0 && (
          <div className={styles.actionBar}>
            {hasPlayableScenes && (
              <button
                className={styles.cinemaBtn}
                onClick={() => setCinemaOpen(true)}
              >
                &#9654; Watch Film
              </button>
            )}

            {user && hasPlayableScenes && (
              <button
                className={styles.exportBtn}
                onClick={handleExportRequest}
                disabled={exportLoading}
              >
                {exportLoading ? 'Requesting...' : '\u2B07 Export MP4'}
              </button>
            )}

            {project.forked_from_project_id && (
              <Link
                href={`/projects/${project.forked_from_project_id}/compare/${params.id}`}
                className={styles.compareLink}
              >
                Compare with original
              </Link>
            )}

            {/* Share buttons — always visible */}
            <div className={styles.shareGroup}>
              <button className={styles.shareBtn} onClick={handleShare} title="Copy link">
                {shareConfirm ? '✓ Copied!' : '🔗 Share'}
              </button>
              <button className={styles.shareBtnWa} onClick={handleShareWhatsApp} title="Share on WhatsApp">
                WhatsApp
              </button>
              <button className={styles.shareBtnX} onClick={handleShareX} title="Share on X">
                𝕏
              </button>
            </div>
          </div>
        )}

        <SceneTimeline
          scenes={scenes}
          isDirector={isDirector}
          projectId={params.id}
          showContributeButton={!!user && !isDirector}
          onCinemaOpen={(startIndex) => setCinemaOpen(true)}
        />

        <PendingContributions
          contributions={contributions}
          onSelect={setSelectedContribution}
          isDirector={isDirector}
          currentUserId={user?.id || null}
        />

        <LineageTree projectId={params.id} projectTitle={project.title} />
        <DecisionLog projectId={params.id} />
        <Comments projectId={params.id} />
        <CreditsRoll
          projectId={params.id}
          projectTitle={project.title}
          currentUserId={user?.id}
        />

        {/* Signup CTA for unauthenticated visitors */}
        {!user && (
          <div className={styles.signupCta}>
            <h3 className={styles.ctaTitle}>Want to contribute to this film?</h3>
            <p className={styles.ctaText}>
              Join MakeMovies to fork, contribute scenes, and collaborate with filmmakers worldwide.
            </p>
            <Link href={`/signup?redirect=/projects/${params.id}`} className={styles.ctaBtn}>
              Join MakeMovies — it&apos;s free
            </Link>
          </div>
        )}

        {/* Director-only analytics */}
        {isDirector && (
          <ProjectAnalytics projectId={params.id} />
        )}
      </div>

      {selectedContribution && (
        <ContributionReview
          contribution={selectedContribution}
          parentScene={findParentScene(selectedContribution.parent_scene_id)}
          parentSceneOrder={getParentSceneOrder(selectedContribution.parent_scene_id)}
          onAccept={() => handleAccept(selectedContribution)}
          onFork={() => handleFork(selectedContribution)}
          onClose={() => setSelectedContribution(null)}
          isDirector={isDirector}
        />
      )}

      {/* Cinema Mode overlay */}
      {cinemaOpen && (
        <CinemaMode
          scenes={scenes.map(s => ({
            id: s.id,
            title: s.title,
            media_url: s.media_url,
            contributor_username: s.profiles?.username || null,
          }))}
          projectTitle={project.title}
          onClose={() => setCinemaOpen(false)}
        />
      )}
    </main>
  );
}
