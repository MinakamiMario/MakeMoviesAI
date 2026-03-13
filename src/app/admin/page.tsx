'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import styles from './page.module.css';

type Stats = {
  total_users: number;
  total_projects: number;
  total_contributions: number;
  total_comments: number;
  pending_reports: number;
  signups_7d: number;
  projects_7d: number;
  contributions_7d: number;
};

type ActivityItem = {
  type: string;
  username?: string;
  user_id?: string;
  title?: string;
  project_id?: string;
  body?: string;
  status?: string;
  time: string;
};

type SignupPoint = { day: string; count: number };

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [signups, setSignups] = useState<SignupPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [statsRes, activityRes, signupsRes] = await Promise.all([
        supabase.rpc('admin_get_dashboard_stats'),
        supabase.rpc('admin_get_recent_activity', { p_limit: 20 }),
        supabase.rpc('admin_get_signup_chart', { p_days: 14 }),
      ]);

      if (statsRes.data) setStats(statsRes.data as unknown as Stats);
      if (activityRes.data) setActivity(activityRes.data as unknown as ActivityItem[]);
      if (signupsRes.data) setSignups(signupsRes.data as unknown as SignupPoint[]);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingSkeleton />;

  const statCards = stats ? [
    { label: 'Total Users', value: stats.total_users, sub: `+${stats.signups_7d} this week` },
    { label: 'Total Projects', value: stats.total_projects, sub: `+${stats.projects_7d} this week` },
    { label: 'Contributions', value: stats.total_contributions, sub: `+${stats.contributions_7d} this week` },
    { label: 'Comments', value: stats.total_comments, sub: null },
    { label: 'Pending Reports', value: stats.pending_reports, sub: null, alert: stats.pending_reports > 0 },
  ] : [];

  const maxSignup = Math.max(...signups.map(s => s.count), 1);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Dashboard</h1>

      {/* Stat Cards */}
      <div className={styles.statsGrid}>
        {statCards.map((card) => (
          <div key={card.label} className={`${styles.statCard} ${card.alert ? styles.statAlert : ''}`}>
            <div className={styles.statValue}>{card.value}</div>
            <div className={styles.statLabel}>{card.label}</div>
            {card.sub && <div className={styles.statSub}>{card.sub}</div>}
          </div>
        ))}
      </div>

      {/* Signup Chart */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Signups (14 days)</h2>
        <div className={styles.chart}>
          {signups.map((point) => (
            <div key={point.day} className={styles.chartBar}>
              <div
                className={styles.chartFill}
                style={{ height: `${(point.count / maxSignup) * 100}%` }}
              />
              <span className={styles.chartLabel}>
                {new Date(point.day).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
              </span>
              <span className={styles.chartCount}>{point.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Recent Activity</h2>
        </div>
        <div className={styles.activityList}>
          {activity.map((item, i) => (
            <div key={i} className={styles.activityItem}>
              <span className={styles.activityIcon}>
                {item.type === 'signup' && '👤'}
                {item.type === 'project' && '🎬'}
                {item.type === 'contribution' && '🎞'}
                {item.type === 'comment' && '💬'}
              </span>
              <div className={styles.activityContent}>
                <span className={styles.activityText}>
                  {item.type === 'signup' && (
                    <>New user <Link href={`/users/${item.username}`}>@{item.username}</Link> signed up</>
                  )}
                  {item.type === 'project' && (
                    <>
                      <Link href={`/users/${item.username}`}>@{item.username}</Link> created{' '}
                      <Link href={`/projects/${item.project_id}`}>{item.title}</Link>
                    </>
                  )}
                  {item.type === 'contribution' && (
                    <>
                      <Link href={`/users/${item.username}`}>@{item.username}</Link> contributed &quot;{item.title}&quot;
                    </>
                  )}
                  {item.type === 'comment' && (
                    <>
                      <Link href={`/users/${item.username}`}>@{item.username}</Link> commented
                    </>
                  )}
                </span>
                <span className={styles.activityTime}>
                  {formatRelativeTime(item.time)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className={styles.quickLinks}>
        <Link href="/admin/reports" className={styles.quickLink}>
          🚩 View Reports {stats && stats.pending_reports > 0 && `(${stats.pending_reports})`}
        </Link>
        <Link href="/admin/users" className={styles.quickLink}>
          👥 Manage Users
        </Link>
        <Link href="/admin/audit" className={styles.quickLink}>
          📋 Audit Log
        </Link>
      </div>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function LoadingSkeleton() {
  return (
    <div className={styles.container}>
      <div className={styles.skeletonTitle} />
      <div className={styles.statsGrid}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className={styles.statCard}>
            <div className={styles.skeletonValue} />
            <div className={styles.skeletonLabel} />
          </div>
        ))}
      </div>
    </div>
  );
}
