'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';
import DecisionLog from '@/components/DecisionLog';
import LineageTree from '@/components/LineageTree';
import ContributionCard from '@/components/ContributionCard';
import ContributionReview from '@/components/ContributionReview';
import {
  Project,
  Scene,
  Contribution,
  ForkOrigin,
  BranchData,
} from '@/types';
import {
  getDefaultBranch,
  getBranchEdges,
  buildSceneOrder,
  findLastSceneId,
  createEdge,
  createDefaultBranch,
  createDefaultCut,
} from '@/lib/graph';

export default function ProjectPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<Project | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDirector, setIsDirector] = useState(false);
  const [forkedFrom, setForkedFrom] = useState<ForkOrigin | null>(null);
  const [forkCount, setForkCount] = useState(0);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [branch, setBranch] = useState<BranchData | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadProject();
  }, [params.id]);

  const loadProject = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    const { data: projectData } = await supabase
      .from('projects')
      .select('*, profiles!director_id(username)')
      .eq('id', params.id)
      .single();

    if (!projectData) {
      router.push('/projects');
      return;
    }

    setProject(projectData as Project);
    const userIsDirector = user?.id === projectData.director_id;
    setIsDirector(userIsDirector);

    if (projectData.forked_from_project_id) {
      const { data: parentProject } = await supabase
        .from('projects')
        .select('title')
        .eq('id', projectData.forked_from_project_id)
        .single();

      setForkedFrom({
        forked_from_project_id: projectData.forked_from_project_id,
        parent_project: parentProject,
      });
    }

    const defaultBranch = await getDefaultBranch(supabase, params.id);
    setBranch(defaultBranch);

    if (defaultBranch) {
      const edges = await getBranchEdges(supabase, defaultBranch.id);
      const orderedSceneIds = buildSceneOrder(edges);

      if (orderedSceneIds.length > 0) {
        const { data: scenesData } = await supabase
          .from('scenes')
          .select('*, profiles!contributor_id(username)')
          .in('id', orderedSceneIds);

        const sceneMap = new Map((scenesData || []).map(s => [s.id, s]));
        const orderedScenes = orderedSceneIds
          .map(id => sceneMap.get(id))
          .filter(Boolean) as Scene[];

        setScenes(orderedScenes);
      } else {
        setScenes([]);
      }
    }

    let contributionsQuery = supabase
      .from('contributions')
      .select('*, profiles!contributor_id(username)')
      .eq('project_id', params.id)
      .eq('status', 'pending');

    if (!userIsDirector && user) {
      contributionsQuery = contributionsQuery.eq('contributor_id', user.id);
    }

    const { data: contributionsData } = await contributionsQuery;
    setContributions((contributionsData as Contribution[]) || []);

    const { count } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('forked_from_project_id', params.id);

    setForkCount(count || 0);
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

  const handleSelectContribution = (contribution: Contribution) => {
    setSelectedContribution(contribution);
  };

  const handleCloseModal = () => {
    setSelectedContribution(null);
  };

  const handleAccept = async (contribution: Contribution) => {
    if (!branch || !user) return;

    const lastSceneId = findLastSceneId(await getBranchEdges(supabase, branch.id));

    const { data: newScene } = await supabase.from('scenes').insert({
      project_id: params.id,
      title: contribution.title,
      description: contribution.description,
      media_url: contribution.media_url,
      scene_order: scenes.length + 1,
      contributor_id: contribution.contributor_id,
    }).select().single();

    if (!newScene) return;

    await createEdge(supabase, params.id, branch.id, lastSceneId, newScene.id, user.id);

    await supabase
      .from('contributions')
      .update({ status: 'accepted' })
      .eq('id', contribution.id);

    await supabase.from('decision_events').insert({
      project_id: params.id,
      actor_id: user.id,
      event_type: 'accept_contribution',
      contribution_id: contribution.id,
      result_scene_id: newScene.id,
      metadata: { branch_id: branch.id },
    });

    setSelectedContribution(null);
    loadProject();
  };

  const handleFork = async (contribution: Contribution) => {
    if (!user) return;

    const { data: newProject } = await supabase
      .from('projects')
      .insert({
        title: `${project?.title} (Fork)`,
        description: `Forked from "${project?.title}" — ${contribution.title}`,
        director_id: contribution.contributor_id,
        forked_from_project_id: params.id,
        forked_at_scene_id: contribution.parent_scene_id,
        forked_from_contribution_id: contribution.id,
        forked_by: contribution.contributor_id,
      })
      .select()
      .single();

    if (!newProject) return;

    const newBranch = await createDefaultBranch(supabase, newProject.id, contribution.contributor_id);
    if (!newBranch) return;

    await createDefaultCut(supabase, newProject.id, contribution.contributor_id);

    let prevSceneId: string | null = null;
    for (const scene of scenes) {
      const { data: copiedScene } = await supabase.from('scenes').insert({
        project_id: newProject.id,
        title: scene.title,
        description: scene.description,
        media_url: scene.media_url,
        scene_order: scene.scene_order,
        contributor_id: scene.contributor_id,
      }).select().single();

      if (copiedScene) {
        await createEdge(supabase, newProject.id, newBranch.id, prevSceneId, copiedScene.id, contribution.contributor_id);
        prevSceneId = copiedScene.id;
      }
    }

    const { data: finalScene } = await supabase.from('scenes').insert({
      project_id: newProject.id,
      title: contribution.title,
      description: contribution.description,
      media_url: contribution.media_url,
      scene_order: scenes.length + 1,
      contributor_id: contribution.contributor_id,
    }).select().single();

    if (finalScene) {
      await createEdge(supabase, newProject.id, newBranch.id, prevSceneId, finalScene.id, contribution.contributor_id);
    }

    await supabase
      .from('contributions')
      .update({ status: 'forked' })
      .eq('id', contribution.id);

    await supabase.from('decision_events').insert({
      project_id: params.id,
      actor_id: user.id,
      event_type: 'fork_contribution',
      contribution_id: contribution.id,
      result_new_project_id: newProject.id,
      metadata: { forked_at_scene_id: contribution.parent_scene_id },
    });

    setSelectedContribution(null);
    loadProject();
  };

  if (loading) {
    return (
      <main className={styles.main}>
        <p className={styles.loading}>Loading...</p>
      </main>
    );
  }

  if (!project) return null;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>MakeMovies</Link>
        <nav className={styles.nav}>
          <Link href="/projects">Browse</Link>
          {user ? (
            <Link href="/dashboard">Dashboard</Link>
          ) : (
            <Link href="/login">Sign in</Link>
          )}
        </nav>
      </header>

      <div className={styles.content}>
        <div className={styles.projectHeader}>
          <span className={styles.label}>Project</span>
          <h1>{project.title}</h1>
          <p className={styles.director}>
            Directed by <span>@{project.profiles?.username}</span>
          </p>
          {forkedFrom && (
            <p className={styles.forkedFrom}>
              Forked from{' '}
              <Link href={`/projects/${forkedFrom.forked_from_project_id}`}>
                {forkedFrom.parent_project?.title || 'Unknown'}
              </Link>
            </p>
          )}
          {forkCount > 0 && (
            <span className={styles.forkBadge}>
              {forkCount} fork{forkCount !== 1 ? 's' : ''}
            </span>
          )}
          {project.description && (
            <p className={styles.description}>{project.description}</p>
          )}
        </div>

        <div className={styles.timeline}>
          <div className={styles.timelineHeader}>
            <h2>Timeline</h2>
            {isDirector && (
              <Link href={`/projects/${params.id}/add-scene`} className={styles.addBtn}>
                + Add scene
              </Link>
            )}
          </div>

          {scenes.length === 0 ? (
            <p className={styles.empty}>No scenes yet.</p>
          ) : (
            <div className={styles.scenes}>
              {scenes.map((scene, index) => (
                <div key={scene.id} className={styles.scene}>
                  <span className={styles.sceneNumber}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className={styles.sceneContent}>
                    {scene.media_url && (
                      <div className={styles.sceneMedia}>
                        {scene.media_url.match(/\.(mp4|webm|mov)$/i) ? (
                          <video src={scene.media_url} controls />
                        ) : (
                          <img src={scene.media_url} alt={scene.title} />
                        )}
                      </div>
                    )}
                    <h3>{scene.title}</h3>
                    {scene.description && <p>{scene.description}</p>}
                    {scene.profiles && (
                      <span className={styles.contributor}>
                        by @{scene.profiles.username}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {user && !isDirector && (
            <Link
              href={`/projects/${params.id}/contribute`}
              className={styles.contributeBtn}
            >
              + Submit a contribution
            </Link>
          )}
        </div>

        {contributions.length > 0 && (
          <div className={styles.contributions}>
            <h2>
              {isDirector ? 'Pending Contributions' : 'Your Submissions'}
            </h2>
            <div className={styles.contributionsList}>
              {contributions.map((contribution) => (
                <ContributionCard
                  key={contribution.id}
                  contribution={contribution}
                  onSelect={handleSelectContribution}
                  isOwnSubmission={contribution.contributor_id === user?.id}
                />
              ))}
            </div>
          </div>
        )}

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
          onClose={handleCloseModal}
          isDirector={isDirector}
        />
      )}
    </main>
  );
}
