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

      // Get all conversations for current user
      const { data: myParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at, conversations!inner(id, updated_at)')
        .eq('user_id', user.id)
        .order('conversations(updated_at)', { ascending: false });

      if (!myParticipants || myParticipants.length === 0) {
        setLoading(false);
        return;
      }

      const convIds = myParticipants.map((p: any) => p.conversation_id);

      // Get other participants
      const { data: allParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id, profiles!user_id(username)')
        .in('conversation_id', convIds)
        .neq('user_id', user.id);

      // Get latest message per conversation
      const { data: latestMessages } = await supabase
        .from('messages')
        .select('conversation_id, body, created_at, sender_id')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false });

      // Build lookup maps
      const otherMap = new Map<string, { userId: string; username: string }>();
      (allParticipants || []).forEach((p: any) => {
        const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
        otherMap.set(p.conversation_id, {
          userId: p.user_id,
          username: profile?.username || 'unknown',
        });
      });

      // Latest message per conversation (first occurrence since ordered desc)
      const latestMsgMap = new Map<string, { body: string; created_at: string; sender_id: string }>();
      (latestMessages || []).forEach((m: any) => {
        if (!latestMsgMap.has(m.conversation_id)) {
          latestMsgMap.set(m.conversation_id, m);
        }
      });

      // Count unread per conversation
      const rows: InboxRow[] = myParticipants.map((p: any) => {
        const conv = Array.isArray(p.conversations) ? p.conversations[0] : p.conversations;
        const other = otherMap.get(p.conversation_id);
        const lastMsg = latestMsgMap.get(p.conversation_id);
        const lastReadAt = p.last_read_at;

        // Count unread from latestMessages
        let unread = 0;
        (latestMessages || []).forEach((m: any) => {
          if (m.conversation_id === p.conversation_id && m.sender_id !== user.id && m.created_at > lastReadAt) {
            unread++;
          }
        });

        return {
          conversationId: p.conversation_id,
          updatedAt: conv?.updated_at || '',
          lastReadAt,
          otherUsername: other?.username || 'unknown',
          otherUserId: other?.userId || '',
          lastMessageBody: lastMsg?.body || null,
          lastMessageAt: lastMsg?.created_at || null,
          lastMessageSenderId: lastMsg?.sender_id || null,
          unreadCount: unread,
        };
      });

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
