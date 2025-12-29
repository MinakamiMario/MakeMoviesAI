'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
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

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const loadProjects = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      const { data: projects } = await supabase
        .from('projects')
        .select('*, profiles!director_id(username)')
        .order('created_at', { ascending: false });

      setProjects(projects || []);
      setLoading(false);
    };

    loadProjects();
  }, []);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>MakeMovies</Link>
        <nav className={styles.nav}>
          {user ? (
            <Link href="/dashboard">Dashboard</Link>
          ) : (
            <Link href="/login">Sign in</Link>
          )}
        </nav>
      </header>

      <div className={styles.content}>
        <h1>Browse projects</h1>
        <p className={styles.subtitle}>Find a film to contribute to</p>

        {loading ? (
          <p className={styles.loading}>Loading...</p>
        ) : projects.length === 0 ? (
          <div className={styles.empty}>
            <p>No projects yet.</p>
            {user && (
              <Link href="/projects/new" className={styles.newBtn}>
                Start the first one
              </Link>
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
                  by @{project.profiles?.username}
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
