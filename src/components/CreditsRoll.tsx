'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import ShareCreditButton from './ShareCreditButton';
import styles from './CreditsRoll.module.css';

type CreditEntry = {
  user_id: string;
  username: string;
  role: 'Director' | 'Scene' | 'Contributor';
  detail: string | null;
};

type Props = {
  projectId: string;
  projectTitle: string;
  currentUserId?: string | null;
};

export default function CreditsRoll({ projectId, projectTitle, currentUserId }: Props) {
  const [credits, setCredits] = useState<CreditEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!open || loaded) return;

    const fetchCredits = async () => {
      const { data, error } = await supabase.rpc('get_project_credits', {
        p_project_id: projectId,
      });

      if (!error && Array.isArray(data)) {
        setCredits(data as CreditEntry[]);
      }
      setLoaded(true);
    };

    fetchCredits();
  }, [open, loaded, projectId]);

  const director = credits.filter((c) => c.role === 'Director');
  const sceneContributors = credits.filter((c) => c.role === 'Scene');
  const otherContributors = credits.filter((c) => c.role === 'Contributor');

  const isInCredits = currentUserId
    ? credits.some((c) => c.user_id === currentUserId)
    : false;

  return (
    <div className={styles.container}>
      <button
        className={styles.toggleBtn}
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
          &#9654;
        </span>
        Credits
      </button>

      {open && (
        <div className={styles.credits}>
          {credits.length === 0 && loaded ? (
            <p className={styles.empty}>No credits yet</p>
          ) : (
            <>
              {/* Director */}
              {director.length > 0 && (
                <div className={styles.group}>
                  <p className={styles.groupLabel}>Directed by</p>
                  {director.map((d) => (
                    <div key={d.user_id} className={styles.creditEntry}>
                      <Link
                        href={`/users/${d.username}`}
                        className={`${styles.username} ${styles.directorName}`}
                      >
                        @{d.username}
                      </Link>
                      {currentUserId === d.user_id && (
                        <ShareCreditButton
                          projectId={projectId}
                          projectTitle={projectTitle}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Scene Contributors */}
              {sceneContributors.length > 0 && (
                <div className={styles.group}>
                  <p className={styles.groupLabel}>Scenes</p>
                  {sceneContributors.map((c) => (
                    <div key={c.user_id} className={styles.creditEntry}>
                      <Link
                        href={`/users/${c.username}`}
                        className={styles.username}
                      >
                        @{c.username}
                      </Link>
                      {c.detail && (
                        <span className={styles.detail}>{c.detail}</span>
                      )}
                      {currentUserId === c.user_id && (
                        <ShareCreditButton
                          projectId={projectId}
                          projectTitle={projectTitle}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Other Contributors */}
              {otherContributors.length > 0 && (
                <div className={styles.group}>
                  <p className={styles.groupLabel}>Contributors</p>
                  {otherContributors.map((c) => (
                    <div key={c.user_id} className={styles.creditEntry}>
                      <Link
                        href={`/users/${c.username}`}
                        className={styles.username}
                      >
                        @{c.username}
                      </Link>
                      {c.detail && (
                        <span className={styles.detail}>{c.detail}</span>
                      )}
                      {currentUserId === c.user_id && (
                        <ShareCreditButton
                          projectId={projectId}
                          projectTitle={projectTitle}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Share CTA for contributors not yet shown */}
              {isInCredits && (
                <div style={{ marginTop: 'var(--space-lg)' }}>
                  <ShareCreditButton
                    projectId={projectId}
                    projectTitle={projectTitle}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
