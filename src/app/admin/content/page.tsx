'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import styles from './page.module.css';

type ContentTab = 'comments' | 'contributions';

type Comment = {
  id: string;
  body: string;
  author_id: string;
  project_id: string;
  created_at: string;
  author_username?: string;
  project_title?: string;
};

type Contribution = {
  id: string;
  title: string;
  status: string;
  contributor_id: string;
  project_id: string;
  created_at: string;
  contributor_username?: string;
  project_title?: string;
};

const PAGE_SIZE = 20;

export default function AdminContentPage() {
  const [tab, setTab] = useState<ContentTab>('comments');
  const [comments, setComments] = useState<Comment[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [removing, setRemoving] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      if (tab === 'comments') {
        const { data, count } = await supabase
          .from('comments')
          .select(`
            id, body, author_id, project_id, created_at,
            profiles!author_id(username),
            projects!project_id(title)
          `, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);

        if (data) {
          setComments(data.map((c: any) => ({
            ...c,
            author_username: c.profiles?.username,
            project_title: c.projects?.title,
          })));
        }
        setTotal(count || 0);
      } else {
        const { data, count } = await supabase
          .from('contributions')
          .select(`
            id, title, status, contributor_id, project_id, created_at,
            profiles!contributor_id(username),
            projects!project_id(title)
          `, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);

        if (data) {
          setContributions(data.map((c: any) => ({
            ...c,
            contributor_username: c.profiles?.username,
            project_title: c.projects?.title,
          })));
        }
        setTotal(count || 0);
      }
      setLoading(false);
    }
    load();
  }, [tab, page]);

  const removeComment = async (id: string) => {
    setRemoving(id);
    await supabase.rpc('admin_remove_comment', { p_comment_id: id });
    setComments(comments.filter(c => c.id !== id));
    setTotal(t => t - 1);
    setRemoving(null);
  };

  const removeContribution = async (id: string) => {
    setRemoving(id);
    await supabase.rpc('admin_remove_contribution', { p_contribution_id: id });
    setContributions(contributions.filter(c => c.id !== id));
    setTotal(t => t - 1);
    setRemoving(null);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Content</h1>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'comments' ? styles.tabActive : ''}`}
          onClick={() => { setTab('comments'); setPage(0); }}
        >
          Comments
        </button>
        <button
          className={`${styles.tab} ${tab === 'contributions' ? styles.tabActive : ''}`}
          onClick={() => { setTab('contributions'); setPage(0); }}
        >
          Contributions
        </button>
      </div>

      <div className={styles.resultCount}>{total} {tab}</div>

      {loading ? (
        <div className={styles.loadingState}>Loading...</div>
      ) : tab === 'comments' ? (
        <div className={styles.contentList}>
          {comments.length === 0 ? (
            <div className={styles.emptyState}>No comments</div>
          ) : comments.map((c) => (
            <div key={c.id} className={styles.contentCard}>
              <div className={styles.contentHeader}>
                <Link href={`/users/${c.author_username}`} className={styles.username}>
                  @{c.author_username}
                </Link>
                <span className={styles.contentMeta}>
                  in <Link href={`/projects/${c.project_id}`}>{c.project_title}</Link>
                </span>
                <span className={styles.contentTime}>
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className={styles.contentBody}>{c.body}</div>
              <div className={styles.contentActions}>
                <button
                  className={styles.removeBtn}
                  onClick={() => removeComment(c.id)}
                  disabled={removing === c.id}
                >
                  {removing === c.id ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.contentList}>
          {contributions.length === 0 ? (
            <div className={styles.emptyState}>No contributions</div>
          ) : contributions.map((c) => (
            <div key={c.id} className={styles.contentCard}>
              <div className={styles.contentHeader}>
                <Link href={`/users/${c.contributor_username}`} className={styles.username}>
                  @{c.contributor_username}
                </Link>
                <span className={styles.statusBadge}>{c.status}</span>
                <span className={styles.contentMeta}>
                  in <Link href={`/projects/${c.project_id}`}>{c.project_title}</Link>
                </span>
                <span className={styles.contentTime}>
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className={styles.contentBody}>{c.title}</div>
              <div className={styles.contentActions}>
                <Link href={`/projects/${c.project_id}`} className={styles.viewLink}>
                  View Project
                </Link>
                <button
                  className={styles.removeBtn}
                  onClick={() => removeContribution(c.id)}
                  disabled={removing === c.id}
                >
                  {removing === c.id ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className={styles.pageBtn}>
            Previous
          </button>
          <span className={styles.pageInfo}>Page {page + 1} of {totalPages}</span>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)} className={styles.pageBtn}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
