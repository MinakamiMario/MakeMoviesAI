'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import styles from './page.module.css';

type Report = {
  id: string;
  reporter_username: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  description: string | null;
  status: string;
  reviewed_by_username: string | null;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
};

const PAGE_SIZE = 20;

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const supabase = createClient();

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc('admin_get_reports', {
      p_page: page,
      p_page_size: PAGE_SIZE,
      p_status: statusFilter === 'all' ? null : statusFilter,
    });

    if (data) {
      const d = data as any;
      setReports(d.reports || []);
      setTotal(d.total || 0);
    }
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const resolve = async (reportId: string, newStatus: string) => {
    await supabase.rpc('admin_resolve_report', {
      p_report_id: reportId,
      p_new_status: newStatus,
      p_admin_notes: notes || null,
    });
    setResolving(null);
    setNotes('');
    fetchReports();
  };

  const removeContent = async (report: Report) => {
    if (report.target_type === 'comment') {
      await supabase.rpc('admin_remove_comment', { p_comment_id: report.target_id });
    } else if (report.target_type === 'contribution') {
      await supabase.rpc('admin_remove_contribution', { p_contribution_id: report.target_id });
    }
    resolve(report.id, 'actioned');
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const reasonLabels: Record<string, string> = {
    spam: 'Spam',
    harassment: 'Harassment',
    inappropriate_content: 'Inappropriate',
    copyright: 'Copyright',
    other: 'Other',
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Reports</h1>

      <div className={styles.filters}>
        {['pending', 'reviewed', 'actioned', 'dismissed', 'all'].map((s) => (
          <button
            key={s}
            className={`${styles.filterBtn} ${statusFilter === s ? styles.filterActive : ''}`}
            onClick={() => { setStatusFilter(s); setPage(1); }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className={styles.resultCount}>{total} reports</div>

      {loading ? (
        <div className={styles.loadingState}>Loading...</div>
      ) : reports.length === 0 ? (
        <div className={styles.emptyState}>
          {statusFilter === 'pending' ? 'No pending reports' : 'No reports found'}
        </div>
      ) : (
        <div className={styles.reportList}>
          {reports.map((report) => (
            <div key={report.id} className={`${styles.reportCard} ${styles[`status_${report.status}`]}`}>
              <div className={styles.reportHeader}>
                <span className={`${styles.reasonBadge} ${styles[`reason_${report.reason}`]}`}>
                  {reasonLabels[report.reason] || report.reason}
                </span>
                <span className={styles.targetBadge}>{report.target_type}</span>
                <span className={styles.reportTime}>
                  {new Date(report.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className={styles.reportBody}>
                <div className={styles.reportInfo}>
                  Reported by{' '}
                  <Link href={`/users/${report.reporter_username}`}>
                    @{report.reporter_username}
                  </Link>
                </div>
                {report.description && (
                  <div className={styles.reportDesc}>{report.description}</div>
                )}
              </div>

              {report.status === 'pending' ? (
                resolving === report.id ? (
                  <div className={styles.resolveForm}>
                    <textarea
                      placeholder="Admin notes (optional)"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className={styles.notesInput}
                      rows={2}
                    />
                    <div className={styles.resolveActions}>
                      <button
                        className={styles.btnDismiss}
                        onClick={() => resolve(report.id, 'dismissed')}
                      >
                        Dismiss
                      </button>
                      <button
                        className={styles.btnReview}
                        onClick={() => resolve(report.id, 'reviewed')}
                      >
                        Mark Reviewed
                      </button>
                      {(report.target_type === 'comment' || report.target_type === 'contribution') && (
                        <button
                          className={styles.btnAction}
                          onClick={() => removeContent(report)}
                        >
                          Remove Content
                        </button>
                      )}
                      <button
                        className={styles.btnCancel}
                        onClick={() => { setResolving(null); setNotes(''); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.reportActions}>
                    <button
                      className={styles.btnResolve}
                      onClick={() => setResolving(report.id)}
                    >
                      Resolve
                    </button>
                  </div>
                )
              ) : (
                <div className={styles.reportResolved}>
                  {report.reviewed_by_username && (
                    <span>Handled by @{report.reviewed_by_username}</span>
                  )}
                  {report.admin_notes && (
                    <span className={styles.adminNotes}>Note: {report.admin_notes}</span>
                  )}
                </div>
              )}
            </div>
          ))}
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
