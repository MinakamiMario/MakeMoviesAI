'use client';

import { useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './WaitlistForm.module.css';

type WaitlistResult = {
  id: string;
  position: number;
  referral_code: string;
  total: number;
  already_exists: boolean;
};

type Props = {
  referredByCode?: string | null;
  /** Compact mode for repeated CTA sections */
  compact?: boolean;
};

function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 10);
}

export default function WaitlistForm({ referredByCode, compact = false }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WaitlistResult | null>(null);
  const [copied, setCopied] = useState(false);

  const supabase = createClient();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: rpcError } = await supabase.rpc('join_waitlist', {
        p_email: trimmed,
        p_referral_code: generateReferralCode(),
        p_referred_by_code: referredByCode || null,
      });

      if (rpcError) {
        if (rpcError.message.includes('Invalid email')) {
          setError('Enter a valid email address.');
        } else {
          setError('Something went wrong. Try again.');
          console.error('Waitlist RPC error:', rpcError);
        }
        setLoading(false);
        return;
      }

      setResult(data as WaitlistResult);
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const referralUrl = result
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}?ref=${result.referral_code}`
    : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text in a temp input
      const input = document.createElement('input');
      input.value = referralUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const twitterShareUrl = result
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        `I just joined the MakeMovies waitlist — a collaborative platform to finish films together. Join me:\n${referralUrl}`
      )}`
    : '';

  // --- Success State ---
  if (result) {
    return (
      <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
        <div className={styles.success}>
          <div className={styles.successIcon}>✓</div>
          <h3 className={styles.successTitle}>
            {result.already_exists ? "You're already on the list!" : "You're in!"}
          </h3>
          <p className={styles.position}>
            You&apos;re <strong>#{result.position}</strong> of {result.total} creators
          </p>

          <div className={styles.shareSection}>
            <p className={styles.shareLabel}>Share to move up the list</p>
            <div className={styles.referralRow}>
              <input
                type="text"
                value={referralUrl}
                readOnly
                className={styles.referralInput}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                type="button"
                onClick={handleCopy}
                className={styles.copyBtn}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <a
              href={twitterShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.twitterBtn}
            >
              Share on X
            </a>
          </div>
        </div>
      </div>
    );
  }

  // --- Form State ---
  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputRow}>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className={styles.emailInput}
            aria-label="Email address"
            autoComplete="email"
          />
          <button
            type="submit"
            disabled={loading}
            className={styles.submitBtn}
          >
            {loading ? 'Joining...' : 'Join the waitlist'}
          </button>
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </form>
    </div>
  );
}
