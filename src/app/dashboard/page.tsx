'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

type Project = {
  id: string;
  title: string;
  description: string;
  created_at: string;
};

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
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

      setUser(user);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <main className={styles.main}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>MakeMovies</Link>
        <nav className={styles.nav}>
          <Link href="/projects">Browse</Link>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            Sign out
          </button>
        </nav>
      </header>

      <div className={styles.content}>
        <div className={styles.titleRow}>
          <h1>Your projects</h1>
          <Link href="/projects/new" className={styles.newBtn}>
            + New project
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className={styles.empty}>
            <p>You haven't created any projects yet.</p>
            <Link href="/projects/new" className={styles.newBtn}>
              Start your first film
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
