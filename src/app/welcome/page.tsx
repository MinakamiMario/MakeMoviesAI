'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from './page.module.css';

export default function Welcome() {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // If account is older than 5 minutes, redirect to dashboard
      const createdAt = new Date(user.created_at).getTime();
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      if (createdAt < fiveMinAgo) {
        router.push('/dashboard');
        return;
      }

      // Get username from profile
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      setUsername(data?.username || null);
      setLoading(false);
    };

    checkUser();
  }, []);

  if (loading) return null;

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>MakeMovies</Link>

        <h1 className={styles.greeting}>
          Welcome{username ? <>, <span className={styles.username}>@{username}</span></> : ''}
        </h1>
        <p className={styles.subtitle}>
          You&apos;re now part of the collaborative filmmaking community.
        </p>

        <p className={styles.question}>What do you want to do first?</p>

        <div className={styles.choices}>
          <Link href="/projects/new" className={styles.choiceCard}>
            <span className={styles.choiceIcon}>&#127916;</span>
            <span className={styles.choiceTitle}>Start directing</span>
            <span className={styles.choiceDesc}>
              Create your own film project and invite contributors
            </span>
          </Link>

          <Link href="/projects" className={styles.choiceCard}>
            <span className={styles.choiceIcon}>&#127912;</span>
            <span className={styles.choiceTitle}>Start contributing</span>
            <span className={styles.choiceDesc}>
              Find a project and add your scenes to someone&apos;s film
            </span>
          </Link>
        </div>

        <Link href="/projects" className={styles.exploreLink}>
          Browse all projects &rarr;
        </Link>
      </div>
    </main>
  );
}
