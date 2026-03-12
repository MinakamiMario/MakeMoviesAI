'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

type UserResult = {
  id: string;
  username: string;
  reputation_score: number;
};

function NewMessageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      // Pre-fill from query param
      const toUsername = searchParams.get('to');
      if (toUsername) {
        supabase
          .from('profiles')
          .select('id, username, reputation_score')
          .eq('username', toUsername)
          .single()
          .then(({ data }) => {
            if (data && data.id !== user.id) {
              setSelectedUser(data);
              setTimeout(() => textareaRef.current?.focus(), 100);
            }
          });
      }
    });
  }, []);

  const searchUsers = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, username, reputation_score')
        .ilike('username', `%${q.trim()}%`)
        .neq('id', userId || '')
        .limit(8);

      setResults(data || []);
      setShowDropdown(true);
      setSearching(false);
    }, 300);
  }, [userId]);

  const handleSelect = (user: UserResult) => {
    setSelectedUser(user);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleClearSelection = () => {
    setSelectedUser(null);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !body.trim() || submitting) return;

    setSubmitting(true);

    // Find or create conversation
    const { data: convId, error: convError } = await supabase.rpc('find_or_create_conversation', {
      other_user_id: selectedUser.id,
    });

    if (convError || !convId) {
      setSubmitting(false);
      return;
    }

    // Send message
    const { error: msgError } = await supabase.rpc('send_message', {
      p_conversation_id: convId,
      p_body: body.trim(),
    });

    if (msgError) {
      setSubmitting(false);
      return;
    }

    router.push(`/inbox/${convId}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      textareaRef.current?.closest('form')?.requestSubmit();
    }
  };

  const getStarCount = (score: number) => {
    if (score >= 500) return 5;
    if (score >= 200) return 4;
    if (score >= 100) return 3;
    if (score >= 50) return 2;
    if (score >= 10) return 1;
    return 0;
  };

  return (
    <main className={styles.main}>
      <Navbar />
      <div className={styles.content}>
        <div className={styles.header}>
          <Link href="/inbox" className={styles.backBtn}>←</Link>
          <h1 className={styles.title}>New message</h1>
        </div>

        <form onSubmit={handleSend} className={styles.form}>
          {/* Recipient */}
          <div className={styles.field}>
            <label className={styles.label}>To</label>
            {selectedUser ? (
              <div className={styles.selectedUser}>
                <div className={styles.selectedAvatar}>
                  {selectedUser.username[0].toUpperCase()}
                </div>
                <span className={styles.selectedName}>
                  @{selectedUser.username}
                  {getStarCount(selectedUser.reputation_score) > 0 && (
                    <span className={styles.stars}>
                      {'★'.repeat(getStarCount(selectedUser.reputation_score))}
                    </span>
                  )}
                </span>
                <button type="button" className={styles.clearBtn} onClick={handleClearSelection}>×</button>
              </div>
            ) : (
              <div className={styles.searchWrapper}>
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={e => { setQuery(e.target.value); searchUsers(e.target.value); }}
                  onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  placeholder="Search for a user..."
                  className={styles.searchInput}
                  autoFocus
                />
                {showDropdown && results.length > 0 && (
                  <div className={styles.dropdown}>
                    {results.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        className={styles.dropdownItem}
                        onMouseDown={() => handleSelect(u)}
                      >
                        <div className={styles.dropdownAvatar}>
                          {u.username[0].toUpperCase()}
                        </div>
                        <span className={styles.dropdownName}>
                          @{u.username}
                        </span>
                        {getStarCount(u.reputation_score) > 0 && (
                          <span className={styles.stars}>
                            {'★'.repeat(getStarCount(u.reputation_score))}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {searching && <span className={styles.searchingText}>Searching...</span>}
                {!searching && query.trim() && showDropdown && results.length === 0 && (
                  <div className={styles.dropdown}>
                    <div className={styles.noResults}>No users found</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Message */}
          <div className={styles.field}>
            <label className={styles.label}>Message</label>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedUser ? `Write a message to @${selectedUser.username}...` : 'Select a recipient first...'}
              className={styles.textarea}
              maxLength={5000}
              rows={5}
              disabled={!selectedUser}
            />
            <div className={styles.formFooter}>
              <span className={styles.charCount}>{body.length > 0 ? `${body.length}/5000` : ''}</span>
              <div className={styles.formActions}>
                <span className={styles.shortcutHint}>{body.trim() ? 'Ctrl+Enter' : ''}</span>
                <button
                  type="submit"
                  className={styles.sendBtn}
                  disabled={!selectedUser || !body.trim() || submitting}
                >
                  {submitting ? 'Sending...' : 'Send message'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function NewMessagePage() {
  return (
    <Suspense>
      <NewMessageContent />
    </Suspense>
  );
}
