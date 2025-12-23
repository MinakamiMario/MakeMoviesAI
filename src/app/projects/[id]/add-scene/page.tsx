'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MediaUpload from '@/components/MediaUpload';
import styles from './page.module.css';

export default function AddScene({ params }: { params: { id: string } }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sceneCount, setSceneCount] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Check if user is director
      const { data: project } = await supabase
        .from('projects')
        .select('director_id')
        .eq('id', params.id)
        .single();

      if (!project || project.director_id !== user.id) {
        router.push(`/projects/${params.id}`);
        return;
      }

      // Get scene count
      const { count } = await supabase
        .from('scenes')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', params.id);

      setSceneCount(count || 0);
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

    const { error } = await supabase.from('scenes').insert({
      project_id: params.id,
      title,
      description,
      media_url: mediaUrl || null,
      scene_order: sceneCount + 1,
      contributor_id: user.id,
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
        <h1>Add scene</h1>
        <p className={styles.subtitle}>Scene {sceneCount + 1}</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.field}>
            <label>Media</label>
            <MediaUpload onUpload={setMediaUrl} />
          </div>

          <div className={styles.field}>
            <label htmlFor="title">Scene title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Opening — Ship interior"
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
              {loading ? 'Adding...' : 'Add scene'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
