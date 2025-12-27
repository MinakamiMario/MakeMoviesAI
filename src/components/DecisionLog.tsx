'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import styles from './DecisionLog.module.css';

type DecisionEvent = {
  id: string;
  event_type: 'accept_contribution' | 'fork_contribution';
  created_at: string;
  contribution_id: string;
  result_scene_id: string | null;
  result_new_project_id: string | null;
  profiles: { username: string };
  contributions: { title: string };
  result_project?: { title: string } | null;
};

type Props = {
  projectId: string;
};

export default function DecisionLog({ projectId }: Props) {
  const [events, setEvents] = useState<DecisionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadEvents();
  }, [projectId]);

  const loadEvents = async () => {
    const { data } = await supabase
      .from('decision_events')
      .select(`
        id,
        event_type,
        created_at,
        contribution_id,
        result_scene_id,
        result_new_project_id,
        profiles!decision_events_actor_id_fkey(username),
        contributions(title),
        result_project:projects!decision_events_result_new_project_id_fkey(title)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    setEvents((data as unknown as DecisionEvent[]) || []);
    setLoading(false);
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) return <p className={styles.loading}>Loading decisions...</p>;
  if (events.length === 0) return null;

  return (
    <div className={styles.container}>
      <h2>Decision Log</h2>
      <div className={styles.events}>
        {events.map((event) => (
          <div key={event.id} className={styles.event}>
            <span className={styles.timestamp}>{formatDate(event.created_at)}</span>
            <span className={`${styles.badge} ${styles[event.event_type]}`}>
              {event.event_type === 'accept_contribution' ? 'Accepted' : 'Forked'}
            </span>
            <span className={styles.description}>
              <strong>@{event.profiles?.username}</strong>
              {event.event_type === 'accept_contribution' ? ' accepted ' : ' forked '}
              "{event.contributions?.title}"
              {event.event_type === 'fork_contribution' && event.result_new_project_id && (
                <>
                  {' → '}
                  <Link href={`/projects/${event.result_new_project_id}`}>
                    {event.result_project?.title || 'View fork'}
                  </Link>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
