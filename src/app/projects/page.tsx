'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Button, CardSkeleton } from '@/components/ui';
import styles from './page.module.css';

const PAGE_SIZE = 12;

type ProjectWithStats = {
  id: string;
  title: string;
  description: string | null;
  director_id: string;
  created_at: string;
  forked_from_project_id: string | null;
  director_username: string;
  director_reputation: number;
  scene_count: number;
  contribution_count: number;
  fork_count: number;
};

type SortOption = 'newest' | 'oldest' | 'title' | 'most_active' | 'most_forked';

export default function Projects() {
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [genesisOnly, setGenesisOnly] = useState(false);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const supabase = createClient();

  const loadProjects = useCallback(async (
    search: string,
    sortBy: SortOption,
    pg: number,
    genesis: boolean
  ) => {
    setSearching(true);

    const { data, error } = await supabase.rpc('get_projects_with_stats', {
      p_search: search.trim(),
      p_sort: sortBy,
      p_limit: PAGE_SIZE,
      p_offset: pg * PAGE_SIZE,
      p_genesis_only: genesis,
    });

    if (!error && data) {
      const result = data as { projects: ProjectWithStats[]; total: number };
      setProjects(result.projects || []);
      setTotal(result.total || 0);
    }

    setSearching(false);
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    loadProjects('', 'newest', 0, false);
  }, []);

  // Debounced search — reset to page 0
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      loadProjects(query, sort, 0, genesisOnly);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, sort, genesisOnly]);

  // Page change
  useEffect(() => {
    if (!loading) {
      loadProjects(query, sort, page, genesisOnly);
    }
  }, [page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasSearch = query.trim().length > 0;

  const getReputationStar = (score: number): string => {
    if (score >= 500) return '\u2605\u2605\u2605\u2605\u2605';
    if (score >= 200) return '\u2605\u2605\u2605\u2605';
    if (score >= 100) return '\u2605\u2605\u2605';
    if (score >= 50) return '\u2605\u2605';
    if (score >= 10) return '\u2605';
    return '';
  };

  return (
    <main className={styles.main}>
      <Navbar />

      <div className={styles.content}>
        <h1>Browse projects</h1>
        <p className={styles.subtitle}>Find a film to contribute to</p>

        {/* Filter tabs */}
        <div className={styles.filterTabs}>
          <button
            className={`${styles.filterTab} ${!genesisOnly ? styles.filterTabActive : ''}`}
            onClick={() => setGenesisOnly(false)}
            type="button"
          >
            All projects
          </button>
          <button
            className={`${styles.filterTab} ${genesisOnly ? styles.filterTabActive : ''}`}
            onClick={() => setGenesisOnly(true)}
            type="button"
          >
            Genesis Projects
          </button>
        </div>

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
            <option value="most_active">Most active</option>
            <option value="most_forked">Most forked</option>
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
                  <div className={styles.cardHeader}>
                    <h2>{project.title}</h2>
                    {!project.forked_from_project_id && (
                      <span className={styles.genesisBadge}>Genesis</span>
                    )}
                  </div>
                  <p className={styles.director}>
                    by{' '}
                    <span
                      onClick={(e) => {
                        if (project.director_username) {
                          e.preventDefault();
                          window.location.href = `/users/${project.director_username}`;
                        }
                      }}
                      className={styles.usernameLink}
                    >
                      @{project.director_username}
                    </span>
                    {project.director_reputation > 0 && (
                      <span className={styles.reputationStars}>
                        {' '}{getReputationStar(project.director_reputation)}
                      </span>
                    )}
                  </p>
                  {project.description && (
                    <p className={styles.description}>{project.description}</p>
                  )}
                  <div className={styles.cardStats}>
                    <span>{project.scene_count} scene{project.scene_count !== 1 ? 's' : ''}</span>
                    <span className={styles.statDot}>&middot;</span>
                    <span>{project.contribution_count} contribution{project.contribution_count !== 1 ? 's' : ''}</span>
                    {project.fork_count > 0 && (
                      <>
                        <span className={styles.statDot}>&middot;</span>
                        <span>{project.fork_count} fork{project.fork_count !== 1 ? 's' : ''}</span>
                      </>
                    )}
                  </div>
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
