'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Notification } from '@/types';
import styles from './NotificationBell.module.css';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_unread_notification_count');
    if (!error && typeof data === 'number') {
      setUnreadCount(data);
    }
  }, []);

  // Fetch recent notifications (when dropdown opens)
  const fetchNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setNotifications(data as Notification[]);
      setLoaded(true);
    }
  }, []);

  // Initial count + realtime subscription
  useEffect(() => {
    let mounted = true;

    fetchUnreadCount();

    const channel = supabase
      .channel('notifications-bell')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        () => {
          if (mounted) {
            fetchUnreadCount();
            // If dropdown is open, refresh the list too
            if (open) fetchNotifications();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications' },
        () => {
          if (mounted) {
            fetchUnreadCount();
            if (open) fetchNotifications();
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [open]);

  // Load notifications when dropdown opens
  useEffect(() => {
    if (open && !loaded) {
      fetchNotifications();
    }
  }, [open, loaded]);

  // Mark all as read
  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    await supabase.rpc('mark_notifications_read', {
      p_notification_ids: unreadIds,
    });

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  // Click a notification → mark read + navigate
  const handleClick = async (notification: Notification) => {
    if (!notification.read) {
      await supabase.rpc('mark_notifications_read', {
        p_notification_ids: [notification.id],
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    setOpen(false);

    // Navigate to project
    if (notification.project_id) {
      router.push(`/projects/${notification.project_id}`);
    }
  };

  const toggleDropdown = () => {
    setOpen((prev) => !prev);
  };

  return (
    <div className={styles.bellWrapper}>
      <button
        className={styles.bellBtn}
        onClick={toggleDropdown}
        aria-label="Notifications"
        aria-expanded={open}
      >
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
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className={styles.backdropOverlay}
            onClick={() => setOpen(false)}
          />
          <div className={styles.dropdown}>
            <div className={styles.dropdownHeader}>
              <span className={styles.dropdownTitle}>Notifications</span>
              {unreadCount > 0 && (
                <button
                  className={styles.markAllBtn}
                  onClick={handleMarkAllRead}
                >
                  Mark all read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className={styles.emptyState}>No notifications yet</div>
            ) : (
              <ul className={styles.notificationList}>
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      className={`${styles.notificationItem} ${!n.read ? styles.unread : ''}`}
                      onClick={() => handleClick(n)}
                      type="button"
                    >
                      <span className={styles.notificationTitle}>
                        {n.title}
                      </span>
                      {n.body && (
                        <p className={styles.notificationBody}>{n.body}</p>
                      )}
                      <p className={styles.notificationTime}>
                        {timeAgo(n.created_at)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
