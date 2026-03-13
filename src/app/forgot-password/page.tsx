'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import styles from '../login/page.module.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>MakeMovies</Link>
        <h1 className={styles.title}>Reset password</h1>

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.6 }}>
              If an account exists for <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>, you will receive a password reset link shortly.
            </p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
              Check your spam folder if you don&apos;t see it within a few minutes.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && <p className={styles.error}>{error}</p>}

            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>

            <div className={styles.field}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className={styles.switch}>
          Remember your password? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
