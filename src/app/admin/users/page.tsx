'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import styles from './page.module.css';

type UserRow = {
  id: string;
  username: string;
  email: string;
  role: string;
  reputation: number;
  project_count: number;
  contribution_count: number;
  created_at: string;
};

type UserDetail = {
  id: string;
  username: string;
  email: string;
  role: string;
  bio: string | null;
  reputation: number;
  created_at: string;
  project_count: number;
  contribution_count: number;
  comment_count: number;
  report_count: number;
  recent_projects: { id: string; title: string; created_at: string }[];
  recent_contributions: { id: string; title: string; status: string; project_id: string }[];
};

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const supabase = createClient();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc('admin_list_users', {
      p_page: page,
      p_page_size: PAGE_SIZE,
      p_search: search || null,
      p_role: roleFilter === 'all' ? null : roleFilter,
      p_sort: sort,
    });

    if (data) {
      const d = data as any;
      setUsers(d.users || []);
      setTotal(d.total || 0);
    }
    setLoading(false);
  }, [page, search, roleFilter, sort]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const openDetail = async (userId: string) => {
    setDetailLoading(true);
    setDetail(null);
    const { data, error } = await supabase.rpc('admin_get_user_detail', { p_user_id: userId });
    if (data && !error) {
      const d = data as any;
      const p = d.profile || {};
      setDetail({
        id: p.id,
        username: p.username,
        email: p.email || '',
        role: p.role,
        bio: p.bio,
        reputation: p.reputation_score || 0,
        created_at: p.created_at,
        project_count: (d.projects || []).length,
        contribution_count: (d.contributions || []).length,
        comment_count: (d.comments || []).length,
        report_count: (d.reports_about || []).length,
        recent_projects: d.projects || [],
        recent_contributions: d.contributions || [],
      });
    }
    setDetailLoading(false);
  };

  const changeRole = async (userId: string, newRole: string) => {
    setActionLoading(true);
    await supabase.rpc('admin_change_user_role', { p_user_id: userId, p_new_role: newRole });
    await fetchUsers();
    if (detail && detail.id === userId) {
      setDetail({ ...detail, role: newRole });
    }
    setActionLoading(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Users</h1>

      {/* Filters */}
      <div className={styles.filters}>
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <input
            type="text"
            placeholder="Search username or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={styles.searchInput}
          />
          <button type="submit" className={styles.searchBtn}>Search</button>
        </form>

        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className={styles.select}
        >
          <option value="all">All Roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="moderator">Moderator</option>
          <option value="suspended">Suspended</option>
        </select>

        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1); }}
          className={styles.select}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="most_projects">Most Projects</option>
          <option value="most_contributions">Most Contributions</option>
          <option value="highest_reputation">Highest Reputation</option>
        </select>
      </div>

      <div className={styles.resultCount}>{total} users</div>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Rep</th>
              <th>Projects</th>
              <th>Contribs</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(7)].map((_, j) => (
                    <td key={j}><div className={styles.skeleton} /></td>
                  ))}
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className={styles.empty}>No users found</td></tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <button
                      className={styles.usernameBtn}
                      onClick={() => openDetail(user.id)}
                    >
                      @{user.username}
                    </button>
                  </td>
                  <td>
                    <span className={`${styles.roleBadge} ${styles[`role_${user.role}`]}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>{user.reputation}</td>
                  <td>{user.project_count}</td>
                  <td>{user.contribution_count}</td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className={styles.actions}>
                      <Link href={`/users/${user.username}`} className={styles.actionLink}>
                        View
                      </Link>
                      {user.role !== 'suspended' ? (
                        <button
                          className={styles.actionDanger}
                          onClick={() => changeRole(user.id, 'suspended')}
                          disabled={actionLoading}
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          className={styles.actionSuccess}
                          onClick={() => changeRole(user.id, 'user')}
                          disabled={actionLoading}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className={styles.pageBtn}
          >
            Previous
          </button>
          <span className={styles.pageInfo}>Page {page} of {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className={styles.pageBtn}
          >
            Next
          </button>
        </div>
      )}

      {/* Detail Drawer */}
      {(detail || detailLoading) && (
        <div className={styles.drawer}>
          <div className={styles.drawerContent}>
            <button className={styles.drawerClose} onClick={() => setDetail(null)}>
              &times;
            </button>

            {detailLoading ? (
              <div className={styles.drawerLoading}>Loading...</div>
            ) : detail && (
              <>
                <h2 className={styles.drawerTitle}>@{detail.username}</h2>
                <div className={styles.drawerMeta}>{detail.email}</div>

                <div className={styles.drawerStats}>
                  <div><strong>{detail.reputation}</strong> rep</div>
                  <div><strong>{detail.project_count}</strong> projects</div>
                  <div><strong>{detail.contribution_count}</strong> contributions</div>
                  <div><strong>{detail.comment_count}</strong> comments</div>
                  <div><strong>{detail.report_count}</strong> reports filed</div>
                </div>

                <div className={styles.drawerField}>
                  <label>Bio</label>
                  <div>{detail.bio || 'No bio set'}</div>
                </div>

                <div className={styles.drawerField}>
                  <label>Role</label>
                  <select
                    value={detail.role}
                    onChange={(e) => changeRole(detail.id, e.target.value)}
                    className={styles.select}
                    disabled={actionLoading}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderator</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

                <div className={styles.drawerField}>
                  <label>Joined</label>
                  <div>{new Date(detail.created_at).toLocaleString()}</div>
                </div>

                {detail.recent_projects.length > 0 && (
                  <div className={styles.drawerField}>
                    <label>Recent Projects</label>
                    <ul className={styles.drawerList}>
                      {detail.recent_projects.map((p) => (
                        <li key={p.id}>
                          <Link href={`/projects/${p.id}`}>{p.title}</Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {detail.recent_contributions.length > 0 && (
                  <div className={styles.drawerField}>
                    <label>Recent Contributions</label>
                    <ul className={styles.drawerList}>
                      {detail.recent_contributions.map((c) => (
                        <li key={c.id}>
                          <Link href={`/projects/${c.project_id}`}>{c.title}</Link>
                          <span className={styles.contribStatus}>{c.status}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
