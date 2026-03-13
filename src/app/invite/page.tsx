'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

type Referral = {
  username: string;
  joined_at: string;
  reputation_score: number;
};

type ReferralStats = {
  referral_code: string;
  referral_count: number;
  referrals: Referral[];
};

export default function InvitePage() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?redirect=/invite');
        return;
      }

      const { data } = await supabase.rpc('get_my_referral_stats');
      if (data && !data.error) {
        setStats(data as ReferralStats);
      }
      setLoading(false);
    };

    load();
  }, []);

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const inviteLink = stats ? `${siteUrl}/signup?ref=${stats.referral_code}` : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = inviteLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareOnX = () => {
    const text = `Join me on MakeMovies \u2014 a platform where filmmakers finish stories together \ud83c\udfac`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(inviteLink)}`;
    window.open(url, '_blank', 'width=550,height=420');
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <main className={styles.main}>
        <Navbar />
        <div className={styles.content}>
          <div className={styles.loading}>Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <Navbar />

      <div className={styles.content}>
        <h1 className={styles.title}>Invite Filmmakers</h1>
        <p className={styles.subtitle}>
          Share your invite link and grow the community. Every filmmaker you bring makes the platform better.
        </p>

        {/* Stats */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats?.referral_count || 0}</span>
            <span className={styles.statLabel}>People invited</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statCode}>{stats?.referral_code || '...'}</span>
            <span className={styles.statLabel}>Your code</span>
          </div>
        </div>

        {/* Invite link */}
        <div className={styles.inviteBox}>
          <input
            type="text"
            readOnly
            value={inviteLink}
            className={styles.inviteInput}
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button className={styles.copyBtn} onClick={copyLink}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Share buttons */}
        <div className={styles.shareRow}>
          <button className={styles.shareBtn} onClick={shareOnX}>
            Share on X
          </button>
          <button
            className={styles.shareBtn}
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: 'Join MakeMovies',
                  text: 'A platform where filmmakers finish stories together',
                  url: inviteLink,
                });
              }
            }}
          >
            Share...
          </button>
        </div>

        {/* Referral list */}
        {stats && stats.referrals.length > 0 && (
          <div className={styles.referralSection}>
            <h2 className={styles.sectionTitle}>Your invites</h2>
            <div className={styles.referralList}>
              {stats.referrals.map((r) => (
                <div key={r.username} className={styles.referralRow}>
                  <span className={styles.referralName}>@{r.username}</span>
                  <span className={styles.referralDate}>{formatDate(r.joined_at)}</span>
                  {r.reputation_score > 0 && (
                    <span className={styles.referralScore}>{r.reputation_score} pts</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
