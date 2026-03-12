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
  profiles: { username: string; reputation_score: number } | null;
};

function ReputationStars({ score }: { score: number }) {
  // 0-9: 0 stars, 10-49: 1 star, 50-99: 2 stars, 100-199: 3 stars, 200-499: 4 stars, 500+: 5 stars
  let stars = 0;
  if (score >= 500) stars = 5;
  else if (score >= 200) stars = 4;
  else if (score >= 100) stars = 3;
  else if (score >= 50) stars = 2;
  else if (score >= 10) stars = 1;

  if (stars === 0) return null;

  return (
    <span className={styles.stars} title={`Reputation: ${score} pts`}>
      {'★'.repeat(stars)}
      {'☆'.repeat(5 - stars)}
    </span>
  );
}

export default function Comments({ projectId }: { projectId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [userReputation, setUserReputation] = useState(0);
  const [focused, setFocused] = useState(false);
  const supabase = createClient();
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Get current user + profile
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, reputation_score')
          .eq('id', user.id)
          .single();
        if (profile) {
          setUsername(profile.username);
          setUserReputation(profile.reputation_score || 0);
        }
      }
    });

    loadComments();

    // Real-time subscription (now works — publication enabled)
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
      .select('id, body, created_at, author_id, profiles!author_id(username, reputation_score)')
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

    const trimmedBody = body.trim();
    setSubmitting(true);

    // Optimistic update — show comment immediately
    const optimisticComment: Comment = {
      id: `optimistic-${Date.now()}`,
      body: trimmedBody,
      created_at: new Date().toISOString(),
      author_id: userId,
      profiles: { username: username || 'you', reputation_score: userReputation },
    };
    setComments((prev) => [...prev, optimisticComment]);
    setBody('');

    // Scroll to bottom
    setTimeout(() => {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 50);

    // Actually insert
    const { error } = await supabase.from('comments').insert({
      project_id: projectId,
      author_id: userId,
      body: trimmedBody,
    });

    if (error) {
      // Remove optimistic comment on failure
      setComments((prev) => prev.filter((c) => c.id !== optimisticComment.id));
      setBody(trimmedBody); // Restore the text
    } else {
      // Reload to get real ID and real-time will also fire
      await loadComments();
    }

    setSubmitting(false);
  }

  async function handleDelete(commentId: string) {
    // Optimistic delete
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) {
      // Reload if delete failed
      loadComments();
    }
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      const form = textareaRef.current?.closest('form');
      if (form) form.requestSubmit();
    }
  };

  return (
    <section className={styles.comments}>
      <h2 className={styles.title}>
        Discussion
        {comments.length > 0 && (
          <span className={styles.count}>{comments.length}</span>
        )}
      </h2>

      {userId ? (
        <form onSubmit={handleSubmit} className={`${styles.form} ${focused ? styles.formFocused : ''}`}>
          <div className={styles.composerHeader}>
            <div className={styles.composerAvatar}>
              {(username || '?')[0].toUpperCase()}
            </div>
            <span className={styles.composerName}>
              @{username || 'you'}
              <ReputationStars score={userReputation} />
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder="Share your thoughts on this project..."
            className={styles.textarea}
            maxLength={2000}
            rows={focused || body ? 4 : 2}
          />
          <div className={styles.formFooter}>
            <span className={styles.charCount}>
              {body.length > 0 ? `${body.length}/2000` : ''}
            </span>
            <div className={styles.formActions}>
              <span className={styles.shortcutHint}>
                {body.trim() ? 'Ctrl+Enter' : ''}
              </span>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={!body.trim() || submitting}
              >
                {submitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className={styles.loginPromptBox}>
          <p className={styles.loginPromptText}>
            Join the conversation
          </p>
          <Link href="/login" className={styles.loginBtn}>
            Log in to comment
          </Link>
        </div>
      )}

      <div ref={listRef} className={styles.list}>
        {comments.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>💬</span>
            <p className={styles.emptyTitle}>No comments yet</p>
            <p className={styles.emptySubtitle}>Be the first to share your thoughts!</p>
          </div>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              className={`${styles.comment} ${c.id.startsWith('optimistic-') ? styles.commentPending : ''}`}
            >
              <div className={styles.commentLeft}>
                <div className={styles.commentAvatar}>
                  {(c.profiles?.username || '?')[0].toUpperCase()}
                </div>
              </div>
              <div className={styles.commentContent}>
                <div className={styles.commentHeader}>
                  <Link
                    href={`/users/${c.profiles?.username || ''}`}
                    className={styles.author}
                  >
                    @{c.profiles?.username || 'unknown'}
                  </Link>
                  <ReputationStars score={c.profiles?.reputation_score || 0} />
                  {userId && c.author_id !== userId && c.profiles?.username && (
                    <Link
                      href={`/inbox/new?to=${c.profiles.username}`}
                      className={styles.dmBtn}
                      title={`Message @${c.profiles.username}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                    </Link>
                  )}
                  <span className={styles.time}>{timeAgo(c.created_at)}</span>
                  {c.author_id === userId && !c.id.startsWith('optimistic-') && (
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
            </div>
          ))
        )}
      </div>
    </section>
  );
}
