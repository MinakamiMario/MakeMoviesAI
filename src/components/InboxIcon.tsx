'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from './InboxIcon.module.css';

export default function InboxIcon() {
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    // Fetch initial unread count
    const fetchUnread = async () => {
      const { data, error } = await supabase.rpc('get_unread_count');
      if (!error && mounted) {
        setUnreadCount(data ?? 0);
      }
    };

    fetchUnread();

    // Subscribe to new messages for realtime badge updates
    const channel = supabase
      .channel('inbox-unread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          // Re-fetch unread count when any new message arrives
          fetchUnread();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Link href="/inbox" className={styles.inboxLink} title="Messages">
      <svg
        className={styles.icon}
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
      {unreadCount > 0 && (
        <span className={styles.badge}>
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
