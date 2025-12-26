'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

type Project = {
  id: string;
  title: string;
  description: string;
  director_id: string;
  profiles: {
    username: string;
  };
};

type Scene = {
  id: string;
  title: string;
  description: string;
  media_url: string | null;
  scene_order: number;
  contributor_id: string | null;
  profiles: {
    username: string;
  } | null;
};

type Contribution = {
  id: string;
  title: string;
  description: string;
  media_url: string | null;
  status: string;
  contributor_id: string;
  parent_scene_id: string | null;
  profiles: {
    username: string;
  };
};

type ForkOrigin = {
  original_project_id: string;
  projects: {
    id: string;
    title: string;
  }[];
};

export default function ProjectPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<Project | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDirector, setIsDirector] = useState(false);
  const [forkedFrom, setForkedFrom] = useState<ForkOrigin | null>(null);
  const [forkCount, setForkCount] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadProject();
  }, [params.id]);

  const loadProject = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    const { data: project } = await supabase
      .from('projects')
      .select('*, profiles(username)')
      .eq('id', params.id)
      .single();

    if (!project) {
      router.push('/projects');
      return;
    }

    setProject(project);
    setIsDirector(user?.id === project.director_id);

    const { data: scenes } = await supabase
      .from('scenes')
      .select('*, profiles(username)')
      .eq('project_id', params.id)
      .order('scene_order', { ascending: true });

    setScenes(scenes || []);

    const { data: contributions } = await supabase
      .from('contributions')
      .select('*, profiles(username)')
      .eq('project_id', params.id)
      .eq('status', 'pending');

    setContributions(contributions || []);

    const { data: forkData } = await supabase
      .from('forks')
      .select('original_project_id, projects!forks_original_project_id_fkey(id, title)')
      .eq('new_project_id', params.id)
      .single();

    if (forkData?.projects && Array.isArray(forkData.projects) && forkData.projects.length > 0) {
      setForkedFrom({
        original_project_id: forkData.original_project_id,
        projects: forkData.projects,
      });
    }

    const { count } = await supabase
      .from('forks')
      .select('*', { count: 'exact', head: true })
      .eq('original_project_id', params.id);

    setForkCount(count || 0);

    setLoading(false);
  };

  const handleAccept = async (contribution: Contribution) => {
    const nextOrder = scenes.length + 1;

    const { data: newScene } = await supabase.from('scenes').insert({
      project_id: params.id,
      title: contribution.title,
      description: contribution.description,
      media_url: contribution.media_url,
      scene_order: nextOrder,
      contributor_id: contribution.contributor_id,
    }).select().single();

    await supabase
      .from('contributions')
      .update({ status: 'accepted' })
      .eq('id', contribution.id);

    if (newScene && user) {
      await supabase.from('decision_events').insert({
        project_id: params.id,
        actor_id: user.id,
        event_type: 'accept_contribution',
        contribution_id: contribution.id,
        result_scene_id: newScene.id,
      });
    }

    loadProject();
  };

  const handleFork = async (contribution: Contribution) => {
    const { data: newProject } = await supabase
      .from('projects')
      .insert({
        title: `${project?.title} (Fork)`,
        description: `Forked from "${project?.title}" — ${contribution.title}`,
        director_id: contribution.contributor_id,
      })
      .select()
      .single();

    if (newProject) {
      for (const scene of scenes) {
        await supabase.from('scenes').insert({
          project_id: newProject.id,
          title: scene.title,
          description: scene.description,
          media_url: scene.media_url,
          scene_order: scene.scene_order,
          contributor_id: scene.contributor_id,
        });
      }

      await supabase.from('scenes').insert({
        project_id: newProject.id,
        title: contribution.title,
        description: contribution.description,
        media_url: contribution.media_url,
        scene_order: scenes.length + 1,
        contributor_id: contribution.contributor_id,
      });

      await supabase.from('forks').insert({
        original_project_id: params.id,
        forked_by: contribution.contributor_id,
        forked_from_contribution_id: contribution.id,
        new_project_id: newProject.id,
      });

      await supabase
        .from('contributions')
        .update({ status: 'forked' })
        .eq('id', contribution.id);

      if (user) {
        await supabase.from('decision_events').insert({
          project_id: params.id,
          actor_id: user.id,
          event_type: 'fork_contribution',
          contribution_id: contribution.id,
          result_new_project_id: newProject.id,
        });
      }
    }

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
              <Link href={`/projects/${forkedFrom.original_project_id}`}>
                {forkedFrom.projects?.[0]?.title}
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
              {scenes.map((scene) => (
                <div key={scene.id} className={styles.scene}>
                  <span className={styles.sceneNumber}>
                    {String(scene.scene_order).padStart(2, '0')}
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

        {isDirector && contributions.length > 0 && (
          <div className={styles.contributions}>
            <h2>Pending contributions</h2>
            {contributions.map((contribution) => (
              <div key={contribution.id} className={styles.contribution}>
                <div className={styles.contributionContent}>
                  {contribution.media_url && (
                    <div className={styles.contributionMedia}>
                      {contribution.media_url.match(/\.(mp4|webm|mov)$/i) ? (
                        <video src={contribution.media_url} controls />
                      ) : (
                        <img src={contribution.media_url} alt={contribution.title} />
                      )}
                    </div>
                  )}
                  <h3>{contribution.title}</h3>
                  {contribution.description && <p>{contribution.description}</p>}
                  <span className={styles.contributor}>
                    by @{contribution.profiles?.username}
                  </span>
                </div>
                <div className={styles.contributionActions}>
                  <button
                    onClick={() => handleAccept(contribution)}
                    className={styles.acceptBtn}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleFork(contribution)}
                    className={styles.forkBtn}
                  >
                    Fork
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
