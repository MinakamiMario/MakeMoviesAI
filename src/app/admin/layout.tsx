import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const metadata = { title: 'Admin Panel' };

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/reports', label: 'Reports', icon: '🚩' },
  { href: '/admin/content', label: 'Content', icon: '📝' },
  { href: '/admin/audit', label: 'Audit Log', icon: '📋' },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, username')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240,
        borderRight: '1px solid var(--border)',
        padding: 'var(--space-lg) 0',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        background: 'var(--bg-secondary)',
      }}>
        <Link href="/" style={{
          display: 'block',
          padding: '0 var(--space-lg)',
          marginBottom: 'var(--space-xl)',
          fontSize: 'var(--text-lg)',
          fontWeight: 700,
          color: 'var(--accent)',
          textDecoration: 'none',
        }}>
          MakeMovies
        </Link>

        <div style={{
          padding: '0 var(--space-md)',
          marginBottom: 'var(--space-lg)',
        }}>
          <span style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Admin Panel
          </span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-sm) var(--space-lg)',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                transition: 'var(--transition-fast)',
                borderRadius: 0,
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <div style={{
          padding: 'var(--space-md) var(--space-lg)',
          borderTop: '1px solid var(--border)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)',
        }}>
          Signed in as <strong style={{ color: 'var(--text-secondary)' }}>{profile.username}</strong>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: 'var(--space-xl)', overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
