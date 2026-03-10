'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { createDefaultBranch, createDefaultCut } from '@/lib/graph';
import styles from './page.module.css';

export default function NewProject() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      }
    };
    checkAuth();
  }, []);

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

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        title,
        description,
        director_id: user.id,
      })
      .select()
      .single();

    if (projectError || !project) {
      setError(projectError?.message || 'Failed to create project');
      setLoading(false);
      return;
    }

    const branch = await createDefaultBranch(supabase, project.id, user.id);
    if (!branch) {
      setError('Failed to create project branch');
      setLoading(false);
      return;
    }

    await createDefaultCut(supabase, project.id, user.id);

    toast.success('Project created!');
    router.push(`/projects/${project.id}`);
  };

  return (
    <main className={styles.main}>
      <Navbar showNav={false} />

      <div className={styles.content}>
        <h1>Start a new project</h1>
        <p className={styles.subtitle}>You&apos;ll be the director. Others can contribute.</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.field}>
            <label htmlFor="title">Project title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The Last Signal"
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short description of your film..."
              rows={4}
            />
          </div>

          <div className={styles.actions}>
            <Link href="/dashboard">
              <Button variant="ghost" type="button">Cancel</Button>
            </Link>
            <Button type="submit" loading={loading}>
              Create project
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
