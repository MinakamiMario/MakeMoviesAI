'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './page.module.css';

type AuditEntry = {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  admin_username: string;
};

const PAGE_SIZE = 25;

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  remove_comment: { label: 'Removed Comment', icon: '💬', color: 'var(--error)' },
  remove_contribution: { label: 'Removed Contribution', icon: '🎞', color: 'var(--error)' },
  suspend_user: { label: 'Suspended User', icon: '🚫', color: 'var(--error)' },
  change_role: { label: 'Changed Role', icon: '🔑', color: 'var(--accent)' },
  resolve_report: { label: 'Resolved Report', icon: '🚩', color: 'var(--success)' },
};

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const supabase = createClient();

  const fetchLog = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc('admin_get_audit_log', {
      p_page: page,
      p_page_size: PAGE_SIZE,
    });

    if (data) {
      const d = data as any;
      setEntries(d.entries || []);
      setTotal(d.total || 0);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Audit Log</h1>
      <div className={styles.resultCount}>{total} entries</div>

      {loading ? (
        <div className={styles.loadingState}>Loading...</div>
      ) : entries.length === 0 ? (
        <div className={styles.emptyState}>No audit entries yet</div>
      ) : (
        <div className={styles.auditList}>
          {entries.map((entry) => {
            const actionInfo = ACTION_LABELS[entry.action] || {
              label: entry.action,
              icon: '📝',
              color: 'var(--text-secondary)',
            };

            return (
              <div key={entry.id} className={styles.auditEntry}>
                <div className={styles.entryIcon}>{actionInfo.icon}</div>
                <div className={styles.entryContent}>
                  <div className={styles.entryMain}>
                    <span className={styles.entryAction} style={{ color: actionInfo.color }}>
                      {actionInfo.label}
                    </span>
                    <span className={styles.entryAdmin}>by @{entry.admin_username}</span>
                    {entry.target_type && (
                      <span className={styles.entryTarget}>
                        on {entry.target_type}
                      </span>
                    )}
                  </div>
                  <div className={styles.entryTime}>
                    {new Date(entry.created_at).toLocaleString()}
                  </div>

                  {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                    <button
                      className={styles.expandBtn}
                      onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                    >
                      {expanded === entry.id ? 'Hide details' : 'Show details'}
                    </button>
                  )}

                  {expanded === entry.id && (
                    <pre className={styles.metadataBlock}>
                      {JSON.stringify(entry.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button disabled={page === 1} onClick={() => setPage(page - 1)} className={styles.pageBtn}>
            Previous
          </button>
          <span className={styles.pageInfo}>Page {page} of {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className={styles.pageBtn}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
