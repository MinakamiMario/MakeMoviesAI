'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { Tag } from '@/types';
import styles from './page.module.css';

export default function NewProject() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      // Load tags
      const { data: tagsData } = await supabase.rpc('get_all_tags');
      if (tagsData) setTags(tagsData as Tag[]);
    };
    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedTagIds.length === 0) {
      setError('Select at least one tag');
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('You must be logged in');
      setLoading(false);
      return;
    }

    // Atomic RPC: project + tags + branch + cut in one transaction
    const { data: result, error: rpcError } = await supabase.rpc('create_project_atomic', {
      p_title: title,
      p_description: description || null,
      p_tag_ids: selectedTagIds,
    });

    if (rpcError || !result?.success) {
      setError(result?.error || rpcError?.message || 'Failed to create project');
      setLoading(false);
      return;
    }

    toast.success('Project created!');
    router.push(`/projects/${result.project_id}`);
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

          {tags.length > 0 && (
            <div className={styles.field}>
              <label>Tags <span className={styles.fieldHint}>(pick 1–5)</span></label>
              <div className={styles.tagPicker}>
                {tags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      className={`${styles.tagPill} ${selected ? styles.tagPillActive : ''}`}
                      onClick={() => {
                        if (selected) {
                          setSelectedTagIds((prev) => prev.filter((id) => id !== tag.id));
                        } else if (selectedTagIds.length < 5) {
                          setSelectedTagIds((prev) => [...prev, tag.id]);
                        }
                      }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
