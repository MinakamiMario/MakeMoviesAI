'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from './Comments.module.css';

type Comment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  profiles: { username: string } | null;
};

export default function Comments({ projectId }: { projectId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });

    // Load comments
    loadComments();

    // Real-time subscription
    const channel = supabase
      .channel(`comments:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          loadComments();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comments',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          loadComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  async function loadComments() {
    const { data } = await supabase
      .from('comments')
      .select('id, body, created_at, author_id, profiles!author_id(username)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    const normalized = (data || []).map((c: any) => ({
      ...c,
      profiles: Array.isArray(c.profiles) ? c.profiles[0] || null : c.profiles,
    }));
    setComments(normalized);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !userId || submitting) return;

    setSubmitting(true);
    await supabase.from('comments').insert({
      project_id: projectId,
      author_id: userId,
      body: body.trim(),
    });
    setBody('');
    setSubmitting(false);
  }

  async function handleDelete(commentId: string) {
    await supabase.from('comments').delete().eq('id', commentId);
  }

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  };

  return (
    <section className={styles.comments}>
      <h2 className={styles.title}>
        Comments
        {comments.length > 0 && (
          <span className={styles.count}>{comments.length}</span>
        )}
      </h2>

      {userId && (
        <form onSubmit={handleSubmit} className={styles.form}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a comment..."
            className={styles.textarea}
            maxLength={2000}
            rows={3}
          />
          <div className={styles.formFooter}>
            <span className={styles.charCount}>{body.length}/2000</span>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={!body.trim() || submitting}
            >
              {submitting ? 'Posting...' : 'Post comment'}
            </button>
          </div>
        </form>
      )}

      {!userId && (
        <p className={styles.loginPrompt}>
          <Link href="/login">Log in</Link> to leave a comment.
        </p>
      )}

      <div ref={listRef} className={styles.list}>
        {comments.length === 0 ? (
          <p className={styles.empty}>No comments yet. Be the first!</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className={styles.comment}>
              <div className={styles.commentHeader}>
                <Link
                  href={`/users/${c.profiles?.username || ''}`}
                  className={styles.author}
                >
                  @{c.profiles?.username || 'unknown'}
                </Link>
                <span className={styles.time}>{timeAgo(c.created_at)}</span>
                {c.author_id === userId && (
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(c.id)}
                    title="Delete comment"
                  >
                    ×
                  </button>
                )}
              </div>
              <p className={styles.body}>{c.body}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
