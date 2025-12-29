'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MediaUpload from '@/components/MediaUpload';
import { getDefaultBranch, getBranchEdges, findLastSceneId } from '@/lib/graph';
import styles from '../add-scene/page.module.css';

export default function Contribute({ params }: { params: { id: string } }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [parentSceneId, setParentSceneId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: project } = await supabase
        .from('projects')
        .select('title, director_id')
        .eq('id', params.id)
        .single();

      if (!project) {
        router.push('/projects');
        return;
      }

      if (project.director_id === user.id) {
        router.push(`/projects/${params.id}/add-scene`);
        return;
      }

      setProjectTitle(project.title);

      // Get default branch and find last scene for parent_scene_id
      const defaultBranch = await getDefaultBranch(supabase, params.id);
      if (defaultBranch) {
        const edges = await getBranchEdges(supabase, defaultBranch.id);
        setParentSceneId(findLastSceneId(edges));
      }
    };

    checkAuth();
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('You must be logged in');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('contributions').insert({
      project_id: params.id,
      title,
      description,
      media_url: mediaUrl || null,
      contributor_id: user.id,
      parent_scene_id: parentSceneId,
      status: 'pending',
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push(`/projects/${params.id}`);
    }
  };

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>MakeMovies</Link>
      </header>

      <div className={styles.content}>
        <h1>Submit contribution</h1>
        <p className={styles.subtitle}>For "{projectTitle}"</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.field}>
            <label>Media</label>
            <MediaUpload projectId={params.id} onUpload={(url) => setMediaUrl(url)} />
          </div>

          <div className={styles.field}>
            <label htmlFor="title">Scene title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Your scene idea..."
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happens in this scene..."
              rows={4}
            />
          </div>

          <div className={styles.actions}>
            <Link href={`/projects/${params.id}`} className={styles.cancelBtn}>
              Cancel
            </Link>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
