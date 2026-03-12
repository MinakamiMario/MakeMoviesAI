'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import { Skeleton } from '@/components/ui';
import styles from './page.module.css';

const PAGE_SIZE = 50;

type MessageItem = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  profiles: { username: string; avatar_url: string | null; reputation_score: number } | null;
};

type OtherUser = {
  userId: string;
  username: string;
};

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load conversation data
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      // Get other participant
      const { data: participants } = await supabase
        .from('conversation_participants')
        .select('user_id, profiles!user_id(username)')
        .eq('conversation_id', conversationId);

      if (!participants || participants.length === 0) {
        router.push('/inbox');
        return;
      }

      const other = participants.find((p: any) => p.user_id !== user.id);
      if (other) {
        const profile = Array.isArray(other.profiles) ? other.profiles[0] : other.profiles;
        setOtherUser({
          userId: other.user_id,
          username: profile?.username || 'unknown',
        });
      }

      // Load messages
      const { data: msgs, count } = await supabase
        .from('messages')
        .select('*, profiles!sender_id(username, avatar_url, reputation_score)', { count: 'exact' })
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);

      const normalized = (msgs || []).map((m: any) => ({
        ...m,
        profiles: Array.isArray(m.profiles) ? m.profiles[0] || null : m.profiles,
      })).reverse();

      setMessages(normalized);
      setHasOlder((count || 0) > PAGE_SIZE);
      setLoading(false);

      // Mark as read
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      // Scroll to bottom
      setTimeout(() => bottomRef.current?.scrollIntoView(), 100);
    }
    init();
  }, [conversationId]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          // Skip if it's our own optimistic message
          const newMsg = payload.new as any;
          if (newMsg.sender_id === userId) return;

          // Fetch full message with profile
          const { data } = await supabase
            .from('messages')
            .select('*, profiles!sender_id(username, avatar_url, reputation_score)')
            .eq('id', newMsg.id)
            .single();

          if (data) {
            const normalized = {
              ...data,
              profiles: Array.isArray(data.profiles) ? data.profiles[0] || null : data.profiles,
            };
            setMessages(prev => [...prev, normalized]);
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

            // Mark as read since we're viewing
            await supabase
              .from('conversation_participants')
              .update({ last_read_at: new Date().toISOString() })
              .eq('conversation_id', conversationId)
              .eq('user_id', userId);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, userId]);

  const loadOlder = useCallback(async () => {
    if (messages.length === 0 || loadingOlder) return;
    setLoadingOlder(true);

    const oldest = messages[0];
    const { data: older } = await supabase
      .from('messages')
      .select('*, profiles!sender_id(username, avatar_url, reputation_score)')
      .eq('conversation_id', conversationId)
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1);

    const normalized = (older || []).map((m: any) => ({
      ...m,
      profiles: Array.isArray(m.profiles) ? m.profiles[0] || null : m.profiles,
    })).reverse();

    if (normalized.length < PAGE_SIZE) setHasOlder(false);
    setMessages(prev => [...normalized, ...prev]);
    setLoadingOlder(false);
  }, [messages, conversationId, loadingOlder]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !userId || submitting) return;

    const trimmed = body.trim();
    setSubmitting(true);

    // Optimistic
    const optimistic: MessageItem = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: userId,
      body: trimmed,
      created_at: new Date().toISOString(),
      profiles: null,
    };
    setMessages(prev => [...prev, optimistic]);
    setBody('');
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    const { error } = await supabase.rpc('send_message', {
      p_conversation_id: conversationId,
      p_body: trimmed,
    });

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setBody(trimmed);
    } else {
      // Replace optimistic with real
      const { data: msgs } = await supabase
        .from('messages')
        .select('*, profiles!sender_id(username, avatar_url, reputation_score)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .range(0, 0);

      if (msgs && msgs[0]) {
        const real = { ...msgs[0], profiles: Array.isArray(msgs[0].profiles) ? msgs[0].profiles[0] || null : msgs[0].profiles };
        setMessages(prev => prev.map(m => m.id === optimistic.id ? real : m));
      }
    }
    setSubmitting(false);
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      textareaRef.current?.closest('form')?.requestSubmit();
    }
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  };

  if (loading) {
    return (
      <main className={styles.main}>
        <Navbar />
        <div className={styles.container}>
          <div className={styles.threadHeader}>
            <Skeleton width="120px" height="1.5rem" />
          </div>
          <div className={styles.messageList}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={i % 2 === 0 ? styles.msgLeft : styles.msgRight}>
                <Skeleton width="60%" height="2.5rem" />
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <Navbar />
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.threadHeader}>
          <Link href="/inbox" className={styles.backBtn}>←</Link>
          {otherUser && (
            <Link href={`/users/${otherUser.username}`} className={styles.otherUser}>
              <div className={styles.headerAvatar}>
                {otherUser.username[0].toUpperCase()}
              </div>
              <span>@{otherUser.username}</span>
            </Link>
          )}
        </div>

        {/* Messages */}
        <div ref={listRef} className={styles.messageList}>
          {hasOlder && (
            <button className={styles.loadOlderBtn} onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? 'Loading...' : 'Load older messages'}
            </button>
          )}

          {messages.map(m => {
            const isMine = m.sender_id === userId;
            return (
              <div key={m.id} className={`${styles.msgRow} ${isMine ? styles.msgRight : styles.msgLeft} ${m.id.startsWith('optimistic-') ? styles.msgPending : ''}`}>
                <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleOther}`}>
                  <p className={styles.msgBody}>{m.body}</p>
                  <span className={styles.msgTime}>{timeAgo(m.created_at)}</span>
                </div>
              </div>
            );
          })}

          {messages.length === 0 && (
            <div className={styles.emptyThread}>
              <p>No messages yet. Say hello!</p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <form onSubmit={handleSend} className={styles.composer}>
          <textarea
            ref={textareaRef}
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className={styles.composerInput}
            maxLength={5000}
            rows={1}
          />
          <button type="submit" className={styles.sendBtn} disabled={!body.trim() || submitting}>
            {submitting ? '...' : '→'}
          </button>
        </form>
      </div>
    </main>
  );
}
