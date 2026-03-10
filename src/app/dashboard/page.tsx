'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Button, CardSkeleton } from '@/components/ui';
import styles from './page.module.css';

type Project = {
  id: string;
  title: string;
  description: string;
  created_at: string;
};

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .eq('director_id', user.id)
        .order('created_at', { ascending: false });

      setProjects(projects || []);
      setLoading(false);
    };

    getUser();
  }, []);

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
        ) : projects.length === 0 ? (
          <div className={styles.empty}>
            <p>You haven&apos;t created any projects yet.</p>
            <Link href="/projects/new">
              <Button size="lg">Start your first film</Button>
            </Link>
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
                <p>{project.description}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
