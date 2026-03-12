'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
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
};

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, count } = await supabase
        .from('projects')
        .select('*', { count: 'exact' })
        .eq('director_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      setProjects(data || []);
      setTotal(count || 0);
      setLoading(false);
    };

    getUser();
  }, [page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main className={styles.main}>
      <Navbar />

      <div className={styles.content}>
        <div className={styles.titleRow}>
          <h1>Your projects</h1>
          <Link href="/projects/new">
            <Button size="md">+ New project</Button>
          </Link>
        </div>

        {loading ? (
          <div className={styles.grid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : projects.length === 0 && page === 0 ? (
          <div className={styles.empty}>
            <p>You haven&apos;t created any projects yet.</p>
            <Link href="/projects/new">
              <Button size="lg">Start your first film</Button>
            </Link>
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
                  <p>{project.description}</p>
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
