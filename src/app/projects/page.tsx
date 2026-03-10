'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Button, CardSkeleton } from '@/components/ui';
import styles from './page.module.css';

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
  const supabase = createClient();

  const loadProjects = useCallback(async (search: string, sortBy: SortOption) => {
    setSearching(true);

    let q = supabase
      .from('projects')
      .select('*, profiles!director_id(username)');

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

    const { data } = await q;
    setProjects(data || []);
    setSearching(false);
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    loadProjects('', 'newest');
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProjects(query, sort);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, sort]);

  const resultCount = projects.length;
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

        {hasSearch && !loading && (
          <p className={styles.resultCount}>
            {searching ? 'Searching...' : `${resultCount} project${resultCount !== 1 ? 's' : ''} found`}
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
        )}
      </div>
    </main>
  );
}
