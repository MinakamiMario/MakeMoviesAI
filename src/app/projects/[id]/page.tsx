'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';
import ProjectHeader from '@/components/ProjectHeader';
import SceneTimeline from '@/components/SceneTimeline';
import PendingContributions from '@/components/PendingContributions';
import DecisionLog from '@/components/DecisionLog';
import LineageTree from '@/components/LineageTree';
import ContributionReview from '@/components/ContributionReview';
import { Skeleton, SceneSkeleton } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { Scene, Contribution, ForkOrigin, BranchData, Project } from '@/types';
import { loadProjectData } from '@/lib/projectLoader';
import { acceptContribution, forkContribution } from '@/lib/decisions';

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

  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();

  useEffect(() => {
    loadData();
  }, [params.id]);

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

        <SceneTimeline
          scenes={scenes}
          isDirector={isDirector}
          projectId={params.id}
          showContributeButton={!!user && !isDirector}
        />

        <PendingContributions
          contributions={contributions}
          onSelect={setSelectedContribution}
          isDirector={isDirector}
          currentUserId={user?.id || null}
        />

        <LineageTree projectId={params.id} projectTitle={project.title} />
        <DecisionLog projectId={params.id} />
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
    </main>
  );
}
