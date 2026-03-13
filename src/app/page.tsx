'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import WaitlistForm from '@/components/WaitlistForm';
import styles from './page.module.css';

type TopCreator = {
  id: string;
  username: string;
  reputation_score: number;
  accepted_count: number;
  contribution_count: number;
  project_count: number;
};

function LandingContent() {
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref');
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);
  const [topCreators, setTopCreators] = useState<TopCreator[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.rpc('get_waitlist_count').then(({ data }) => {
      if (typeof data === 'number') setWaitlistCount(data);
    });
    supabase.rpc('get_top_contributors', { p_period: 'all_time', p_limit: 3 }).then(({ data }) => {
      if (data) setTopCreators(data as TopCreator[]);
    });
  }, []);

  return (
    <>
    <Navbar />
    <main className={styles.main}>
      {/* ====== HERO ====== */}
      <section className={styles.hero}>
        <p className={styles.logo}>MAKEMOVIES</p>
        <h1 className={styles.tagline}>Finish films together.</h1>
        <p className={styles.subtitle}>
          The collaborative platform where filmmakers fork, contribute,
          and finish stories — together.
        </p>

        <WaitlistForm referredByCode={ref} />

        {waitlistCount !== null && waitlistCount > 0 && (
          <p className={styles.socialProof}>
            {waitlistCount} creator{waitlistCount !== 1 ? 's' : ''} already waiting
          </p>
        )}
      </section>

      {/* ====== HOW IT WORKS ====== */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>How it works</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <span className={styles.stepNumber}>01</span>
            <h3 className={styles.stepTitle}>Start or Fork</h3>
            <p className={styles.stepDesc}>
              Begin your own project or fork someone else&apos;s film
              to create your own version. Nothing gets deleted — every
              path is preserved.
            </p>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNumber}>02</span>
            <h3 className={styles.stepTitle}>Contribute</h3>
            <p className={styles.stepDesc}>
              Upload scenes to any project. The director decides what
              becomes canon. Your work lives on — in the main timeline
              or as a fork.
            </p>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNumber}>03</span>
            <h3 className={styles.stepTitle}>Get Credit</h3>
            <p className={styles.stepDesc}>
              Everyone who contributes is in the credits. Always.
              Your reputation grows with every accepted scene across
              every project.
            </p>
          </div>
        </div>
      </section>

      {/* ====== THE PROBLEM ====== */}
      <section className={styles.section}>
        <div className={styles.problemBlock}>
          <h2 className={styles.problemTitle}>
            Films shouldn&apos;t die on someone&apos;s hard drive.
          </h2>
          <p className={styles.problemText}>
            Thousands of AI filmmakers create stunning scenes every day —
            but there&apos;s no way to combine them into something bigger.
            Google Drive and Discord aren&apos;t built for collaborative
            storytelling. There&apos;s no credits, no versioning, no way
            to fork a scene you love and take it in your own direction.
          </p>
          <p className={styles.problemText}>
            MakeMovies is the missing layer — version control for film,
            where every contribution is tracked and every creator is credited.
          </p>
        </div>
      </section>

      {/* ====== TOP CREATORS ====== */}
      {topCreators.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Top Creators</h2>
          <div className={styles.creatorsGrid}>
            {topCreators.map((c, i) => (
              <Link
                key={c.id}
                href={`/users/${c.username}`}
                className={styles.creatorCard}
              >
                <span className={styles.creatorMedal}>
                  {['🥇', '🥈', '🥉'][i]}
                </span>
                <div className={styles.creatorAvatar}>
                  {c.username.charAt(0).toUpperCase()}
                </div>
                <span className={styles.creatorName}>@{c.username}</span>
                <span className={styles.creatorRep}>{c.reputation_score} reputation</span>
                <div className={styles.creatorStats}>
                  <span>{c.project_count} projects</span>
                  <span>{c.accepted_count} accepted</span>
                </div>
              </Link>
            ))}
          </div>
          <div className={styles.creatorsLink}>
            <Link href="/leaderboard">View full leaderboard &rarr;</Link>
          </div>
        </section>
      )}

      {/* ====== FOUNDING DIRECTORS ====== */}
      <section className={styles.section}>
        <div className={styles.foundingBlock}>
          <p className={styles.foundingEyebrow}>Limited to 50 spots</p>
          <h2 className={styles.foundingTitle}>Become a Founding Director</h2>
          <div className={styles.perks}>
            <div className={styles.perk}>
              <span className={styles.perkIcon}>⚡</span>
              <div>
                <strong>Early access</strong>
                <p>Be the first to create projects and shape the platform.</p>
              </div>
            </div>
            <div className={styles.perk}>
              <span className={styles.perkIcon}>★</span>
              <div>
                <strong>Founding Director badge</strong>
                <p>Permanently displayed on your profile and every project you direct.</p>
              </div>
            </div>
            <div className={styles.perk}>
              <span className={styles.perkIcon}>◆</span>
              <div>
                <strong>Direct influence</strong>
                <p>Your feedback shapes features. Weekly builds, weekly input.</p>
              </div>
            </div>
          </div>

          <div className={styles.foundingCta}>
            <WaitlistForm referredByCode={ref} compact />
          </div>
        </div>
      </section>
    </main>
    </>
  );
}

export default function Home() {
  return (
    <Suspense>
      <LandingContent />
    </Suspense>
  );
}
