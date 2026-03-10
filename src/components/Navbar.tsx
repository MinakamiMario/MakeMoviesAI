'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './Navbar.module.css';

type Props = {
  /** Show navigation links. Set false for form pages (logo only). */
  showNav?: boolean;
};

export default function Navbar({ showNav = true }: Props) {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user);
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();
        if (data) setUsername(data.username);
      }
    });
  }, []);

  // Close menu on route change (resize)
  useEffect(() => {
    const close = () => setMenuOpen(false);
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push('/');
  };

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>MakeMovies</Link>

      {showNav && (
        <>
          <button
            className={`${styles.hamburger} ${menuOpen ? styles.hamburgerOpen : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span />
            <span />
            <span />
          </button>

          <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ''}`}>
            <Link href="/projects" className={styles.navLink} onClick={() => setMenuOpen(false)}>
              Browse
            </Link>
            {user ? (
              <>
                <Link href="/dashboard" className={styles.navLink} onClick={() => setMenuOpen(false)}>
                  Dashboard
                </Link>
                {username && (
                  <Link href={`/users/${username}`} className={styles.navLink} onClick={() => setMenuOpen(false)}>
                    Profile
                  </Link>
                )}
                <button className={styles.signOutBtn} onClick={handleSignOut}>
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/login" className={styles.navLink} onClick={() => setMenuOpen(false)}>
                Sign in
              </Link>
            )}
          </nav>

          {menuOpen && <div className={styles.overlay} onClick={() => setMenuOpen(false)} />}
        </>
      )}
    </header>
  );
}
