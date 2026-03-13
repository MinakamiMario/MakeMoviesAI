'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import { Button, Skeleton } from '@/components/ui';
import styles from './page.module.css';

type InboxRow = {
  conversationId: string;
  updatedAt: string;
  lastReadAt: string;
  otherUsername: string;
  otherUserId: string;
  lastMessageBody: string | null;
  lastMessageAt: string | null;
  lastMessageSenderId: string | null;
  unreadCount: number;
};

export default function InboxPage() {
  const [conversations, setConversations] = useState<InboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      // Single RPC call for all inbox data
      const { data: inboxData } = await supabase.rpc('get_inbox_summary');

      if (!inboxData || (inboxData as any).error || !Array.isArray(inboxData)) {
        setLoading(false);
        return;
      }

      const rows: InboxRow[] = (inboxData as any[]).map((r: any) => ({
        conversationId: r.conversation_id,
        updatedAt: r.updated_at || '',
        lastReadAt: r.last_read_at || '',
        otherUsername: r.other_username || 'unknown',
        otherUserId: r.other_user_id || '',
        lastMessageBody: r.last_message_body || null,
        lastMessageAt: r.last_message_at || null,
        lastMessageSenderId: r.last_message_sender_id || null,
        unreadCount: r.unread_count || 0,
      }));

      setConversations(rows);
      setLoading(false);
    }
    load();
  }, []);

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const truncate = (text: string, max: number) => {
    if (text.length <= max) return text;
    return text.slice(0, max) + '...';
  };

  if (loading) {
    return (
      <main className={styles.main}>
        <Navbar />
        <div className={styles.content}>
          <div className={styles.header}>
            <Skeleton width="120px" height="2rem" />
            <Skeleton width="130px" height="2.25rem" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.convRow}>
              <Skeleton width="40px" height="40px" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <Skeleton width="120px" height="1rem" />
                <Skeleton width="200px" height="0.875rem" />
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <Navbar />
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>Messages</h1>
          <Link href="/inbox/new">
            <Button variant="primary" size="sm">New message</Button>
          </Link>
        </div>

        {conversations.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>✉</span>
            <p className={styles.emptyTitle}>No messages yet</p>
            <p className={styles.emptySubtitle}>Start a conversation with another filmmaker</p>
            <Link href="/inbox/new">
              <Button variant="primary" size="sm">Send your first message</Button>
            </Link>
          </div>
        ) : (
          <div className={styles.convList}>
            {conversations.map(conv => (
              <Link
                key={conv.conversationId}
                href={`/inbox/${conv.conversationId}`}
                className={`${styles.convRow} ${conv.unreadCount > 0 ? styles.convUnread : ''}`}
              >
                <div className={styles.convAvatar}>
                  {conv.otherUsername[0].toUpperCase()}
                </div>
                <div className={styles.convInfo}>
                  <div className={styles.convTop}>
                    <span className={styles.convName}>@{conv.otherUsername}</span>
                    {conv.lastMessageAt && (
                      <span className={styles.convTime}>{timeAgo(conv.lastMessageAt)}</span>
                    )}
                  </div>
                  <div className={styles.convBottom}>
                    <span className={styles.convPreview}>
                      {conv.lastMessageBody
                        ? (conv.lastMessageSenderId === userId ? 'You: ' : '') + truncate(conv.lastMessageBody, 80)
                        : 'No messages yet'}
                    </span>
                    {conv.unreadCount > 0 && (
                      <span className={styles.unreadBadge}>{conv.unreadCount}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
