'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui';
import {
  ProjectCard,
  ProjectCardSkeleton,
  CuratedRow,
  TagFilterBar,
  ViewToggle,
  useViewMode,
} from '@/components/browse';
import type { ViewMode } from '@/components/browse';
import { BrowseProject, Tag } from '@/types';
import styles from './page.module.css';

const PAGE_SIZE = 12;

type SortOption = 'newest' | 'oldest' | 'title' | 'most_active' | 'most_forked' | 'trending' | 'most_viewed';

type CuratedRows = {
  trending_this_week: BrowseProject[];
  new_releases: BrowseProject[];
  most_forked: BrowseProject[];
  tag_rows: { tag_name: string; tag_slug: string; projects: BrowseProject[] }[];
};

export default function Projects() {
  // Discovery mode state
  const [curatedRows, setCuratedRows] = useState<CuratedRows | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(true);

  // Search/filter mode state
  const [projects, setProjects] = useState<BrowseProject[]>([]);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // Shared state
  const [tags, setTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOption>('trending');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<'discover' | 'all' | 'genesis' | 'forks'>('discover');
  const [viewMode, setViewMode] = useViewMode();

  const supabase = createClient();

  // Determine mode: discovery (curated rows) vs search (full list)
  const isSearchMode = query.trim().length > 0 || selectedTags.length > 0 || typeFilter !== 'discover';

  // Load tags + curated rows on mount
  useEffect(() => {
    loadDiscovery();
  }, []);

  // Debounced search when filters change
  useEffect(() => {
    if (!isSearchMode) return;
    const timer = setTimeout(() => {
      setPage(0);
      loadSearchResults(query, sort, 0, selectedTags, typeFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, sort, selectedTags, typeFilter]);

  // Page change in search mode
  useEffect(() => {
    if (isSearchMode && page > 0) {
      loadSearchResults(query, sort, page, selectedTags, typeFilter);
    }
  }, [page]);

  const loadDiscovery = async () => {
    setDiscoveryLoading(true);

    const [tagsResult, curatedResult] = await Promise.all([
      supabase.rpc('get_all_tags'),
      supabase.rpc('get_curated_rows'),
    ]);

    if (tagsResult.data) {
      setTags(tagsResult.data as Tag[]);
    }

    if (curatedResult.data) {
      const data = curatedResult.data as CuratedRows;
      setCuratedRows(data);
    }

    setDiscoveryLoading(false);
  };

  const loadSearchResults = async (
    search: string,
    sortBy: SortOption,
    pg: number,
    tagSlugs: string[],
    filter: 'discover' | 'all' | 'genesis' | 'forks'
  ) => {
    setSearching(true);

    const { data, error } = await supabase.rpc('get_browse_projects', {
      p_search: search.trim(),
      p_sort: sortBy,
      p_limit: PAGE_SIZE,
      p_offset: pg * PAGE_SIZE,
      p_genesis_only: filter === 'genesis',
      p_forks_only: filter === 'forks',
      p_tag_slugs: tagSlugs.length > 0 ? tagSlugs : null,
    });

    if (!error && data) {
      const result = data as { projects: BrowseProject[]; total: number };
      setProjects(result.projects || []);
      setTotal(result.total || 0);
    }

    setSearching(false);
  };

  const toggleTag = (slug: string) => {
    setSelectedTags((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const clearFilters = () => {
    setQuery('');
    setSelectedTags([]);
    setTypeFilter('discover');
    setSort('trending');
    setPage(0);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main className={styles.main}>
      <Navbar />

      <div className={styles.content}>
        {/* Hero header */}
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>Discover Films</h1>
          <p className={styles.heroSubtitle}>
            Explore collaborative creations from filmmakers worldwide
          </p>
        </div>

        {/* Search bar — always visible */}
        <div className={styles.searchBar}>
          <div className={styles.searchIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search projects, directors, genres..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={styles.searchInput}
            aria-label="Search projects"
          />
          {isSearchMode && (
            <div className={styles.searchActions}>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className={styles.sortSelect}
                aria-label="Sort projects"
              >
                <option value="trending">Trending</option>
                <option value="newest">Newest</option>
                <option value="most_viewed">Most viewed</option>
                <option value="most_forked">Most forked</option>
                <option value="most_active">Most active</option>
                <option value="title">A — Z</option>
              </select>
              <ViewToggle value={viewMode} onChange={setViewMode} />
            </div>
          )}
        </div>

        {/* Filter row — always visible */}
        <div className={styles.filterRow}>
          <button
            className={`${styles.filterChip} ${typeFilter === 'discover' ? styles.filterChipActive : ''}`}
            onClick={() => setTypeFilter('discover')}
          >
            Discover
          </button>
          <button
            className={`${styles.filterChip} ${typeFilter === 'all' ? styles.filterChipActive : ''}`}
            onClick={() => setTypeFilter('all')}
          >
            All projects
          </button>
          <button
            className={`${styles.filterChip} ${typeFilter === 'genesis' ? styles.filterChipActive : ''}`}
            onClick={() => setTypeFilter('genesis')}
          >
            Genesis
          </button>
          <button
            className={`${styles.filterChip} ${typeFilter === 'forks' ? styles.filterChipActive : ''}`}
            onClick={() => setTypeFilter('forks')}
          >
            Forks
          </button>
          {isSearchMode && (query || selectedTags.length > 0) && (
            <button className={styles.clearBtn} onClick={clearFilters}>
              Clear all
            </button>
          )}
        </div>

        {/* Tag filter bar */}
        {tags.length > 0 && (
          <TagFilterBar
            tags={tags}
            selectedSlugs={selectedTags}
            onToggle={toggleTag}
            onClear={() => setSelectedTags([])}
          />
        )}

        {/* ========= DISCOVERY MODE ========= */}
        {!isSearchMode && (
          <div className={styles.discovery}>
            {discoveryLoading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <section key={i} className={styles.skeletonRow}>
                    <div className={styles.skeletonRowTitle} />
                    <div className={styles.skeletonRowCards}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <ProjectCardSkeleton key={j} variant="row" />
                      ))}
                    </div>
                  </section>
                ))}
              </>
            ) : curatedRows ? (
              <>
                {curatedRows.trending_this_week.length > 0 && (
                  <CuratedRow
                    title="Trending This Week"
                    projects={curatedRows.trending_this_week}
                  />
                )}
                {curatedRows.new_releases.length > 0 && (
                  <CuratedRow
                    title="New Releases"
                    projects={curatedRows.new_releases}
                  />
                )}
                {curatedRows.most_forked.length > 0 && (
                  <CuratedRow
                    title="Most Forked"
                    projects={curatedRows.most_forked}
                  />
                )}
                {curatedRows.tag_rows?.map((row) => (
                  <CuratedRow
                    key={row.tag_slug}
                    title={row.tag_name}
                    projects={row.projects}
                  />
                ))}

                {curatedRows.trending_this_week.length === 0 &&
                  curatedRows.new_releases.length === 0 &&
                  curatedRows.most_forked.length === 0 && (
                    <div className={styles.empty}>
                      <p>No projects yet. Be the first to create one!</p>
                      <Link href="/projects/new">
                        <Button>Start a project</Button>
                      </Link>
                    </div>
                  )}
              </>
            ) : null}
          </div>
        )}

        {/* ========= SEARCH / FILTER MODE ========= */}
        {isSearchMode && (
          <div className={styles.searchResults}>
            {!searching && (
              <p className={styles.resultCount}>
                {total} project{total !== 1 ? 's' : ''} found
              </p>
            )}

            {searching && projects.length === 0 ? (
              <div className={viewMode === 'grid' ? styles.grid : styles.list}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <ProjectCardSkeleton key={i} variant={viewMode} />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className={styles.empty}>
                <p>No projects match your search</p>
                <Button variant="ghost" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <>
                <div className={viewMode === 'grid' ? styles.grid : styles.list}>
                  {projects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      variant={viewMode}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className={styles.pagination}>
                    <button
                      className={styles.pageBtn}
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page === 0}
                    >
                      &larr; Previous
                    </button>
                    <span className={styles.pageInfo}>
                      Page {page + 1} of {totalPages}
                    </span>
                    <button
                      className={styles.pageBtn}
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page + 1 >= totalPages}
                    >
                      Next &rarr;
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
