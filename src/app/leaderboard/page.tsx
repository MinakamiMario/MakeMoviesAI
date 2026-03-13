'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

type Contributor = {
  id: string;
  username: string;
  bio: string | null;
  reputation_score: number;
  accepted_count: number;
  contribution_count: number;
  project_count: number;
  contributions_period: number;
  accepted_period: number;
  comment_count: number;
  created_at: string;
};

type Period = 'week' | 'month' | 'year' | 'all_time';

const PERIOD_LABELS: Record<Period, string> = {
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
  all_time: 'All Time',
};

export default function LeaderboardPage() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase.rpc('get_top_contributors', {
        p_period: period,
        p_limit: 50,
      });
      if (data) setContributors(data as Contributor[]);
      setLoading(false);
    }
    load();
  }, [period]);

  return (
    <main className={styles.main}>
      <Navbar />

      <div className={styles.content}>
        <div className={styles.hero}>
          <h1 className={styles.title}>Leaderboard</h1>
          <p className={styles.subtitle}>
            Top contributors making films happen
          </p>
        </div>

        <div className={styles.periodTabs}>
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              className={`${styles.periodTab} ${period === p ? styles.periodTabActive : ''}`}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Top 3 Podium */}
        {!loading && contributors.length >= 3 && (
          <div className={styles.podium}>
            {[1, 0, 2].map((idx) => {
              const c = contributors[idx];
              if (!c) return null;
              const rank = idx + 1;
              const medal = ['🥇', '🥈', '🥉'][idx];
              return (
                <Link
                  key={c.id}
                  href={`/users/${c.username}`}
                  className={`${styles.podiumCard} ${styles[`podium${rank}`]}`}
                >
                  <span className={styles.podiumMedal}>{medal}</span>
                  <div className={styles.podiumAvatar}>
                    {c.username.charAt(0).toUpperCase()}
                  </div>
                  <span className={styles.podiumName}>@{c.username}</span>
                  <span className={styles.podiumRep}>{c.reputation_score} rep</span>
                  <div className={styles.podiumStats}>
                    <span>{c.accepted_period || c.accepted_count} accepted</span>
                    <span>{c.contributions_period || c.contribution_count} contribs</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Full Table */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Creator</th>
                <th>Reputation</th>
                <th>Accepted</th>
                <th>Contributions</th>
                <th>Projects</th>
                <th>Comments</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j}><div className={styles.skeleton} /></td>
                    ))}
                  </tr>
                ))
              ) : contributors.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    No contributors found for this period
                  </td>
                </tr>
              ) : (
                contributors.map((c, i) => (
                  <tr key={c.id} className={i < 3 ? styles.topRow : ''}>
                    <td className={styles.rankCell}>
                      {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                    </td>
                    <td>
                      <Link href={`/users/${c.username}`} className={styles.userLink}>
                        <div className={styles.tableAvatar}>
                          {c.username.charAt(0).toUpperCase()}
                        </div>
                        <div className={styles.userInfo}>
                          <span className={styles.userName}>@{c.username}</span>
                          {c.bio && <span className={styles.userBio}>{c.bio}</span>}
                        </div>
                      </Link>
                    </td>
                    <td className={styles.numCell}>{c.reputation_score}</td>
                    <td className={styles.numCell}>{c.accepted_period || c.accepted_count}</td>
                    <td className={styles.numCell}>{c.contributions_period || c.contribution_count}</td>
                    <td className={styles.numCell}>{c.project_count}</td>
                    <td className={styles.numCell}>{c.comment_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
