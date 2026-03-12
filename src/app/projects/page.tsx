'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Button, CardSkeleton } from '@/components/ui';
import styles from './page.module.css';

const PAGE_SIZE = 12;

type Project = {
  id: string;
  title: string;
  description: string;
  created_at: string;
  profiles: {
    username: string;
  };
};

type SortOption = 'newest' | 'oldest' | 'title';

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const supabase = createClient();

  const loadProjects = useCallback(async (search: string, sortBy: SortOption, pg: number) => {
    setSearching(true);

    const from = pg * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q = supabase
      .from('projects')
      .select('*, profiles!director_id(username, reputation_score)', { count: 'exact' });

    if (search.trim()) {
      q = q.or(`title.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`);
    }

    if (sortBy === 'newest') {
      q = q.order('created_at', { ascending: false });
    } else if (sortBy === 'oldest') {
      q = q.order('created_at', { ascending: true });
    } else {
      q = q.order('title', { ascending: true });
    }

    const { data, count } = await q.range(from, to);
    setProjects(data || []);
    setTotal(count || 0);
    setSearching(false);
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    loadProjects('', 'newest', 0);
  }, []);

  // Debounced search — reset to page 0
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      loadProjects(query, sort, 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, sort]);

  // Page change
  useEffect(() => {
    if (!loading) {
      loadProjects(query, sort, page);
    }
  }, [page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasSearch = query.trim().length > 0;

  return (
    <main className={styles.main}>
      <Navbar />

      <div className={styles.content}>
        <h1>Browse projects</h1>
        <p className={styles.subtitle}>Find a film to contribute to</p>

        <div className={styles.searchBar}>
          <input
            type="text"
            placeholder="Search projects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={styles.searchInput}
            aria-label="Search projects"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className={styles.sortSelect}
            aria-label="Sort projects"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">A — Z</option>
          </select>
        </div>

        {!loading && (
          <p className={styles.resultCount}>
            {searching ? 'Searching...' : `${total} project${total !== 1 ? 's' : ''}`}
          </p>
        )}

        {loading ? (
          <div className={styles.grid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className={styles.empty}>
            {hasSearch ? (
              <>
                <p>No projects match &ldquo;{query}&rdquo;</p>
                <Button variant="ghost" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              </>
            ) : (
              <>
                <p>No projects yet.</p>
                <Link href="/projects/new">
                  <Button>Start the first one</Button>
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            <div className={styles.grid}>
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className={styles.card}
                >
                  <h2>{project.title}</h2>
                  <p className={styles.director}>
                    by{' '}
                    <span
                      onClick={(e) => {
                        if (project.profiles?.username) {
                          e.preventDefault();
                          window.location.href = `/users/${project.profiles.username}`;
                        }
                      }}
                      className={styles.usernameLink}
                    >
                      @{project.profiles?.username}
                    </span>
                  </p>
                  {project.description && (
                    <p className={styles.description}>{project.description}</p>
                  )}
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  className={styles.pageBtn}
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 0}
                >
                  Previous
                </button>
                <span className={styles.pageInfo}>
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  className={styles.pageBtn}
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page + 1 >= totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
