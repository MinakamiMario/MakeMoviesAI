import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
      color: '#e0e0e0',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '2rem' }}>
        <p style={{ fontSize: '4rem', fontWeight: 700, color: '#c9a227', margin: 0 }}>
          404
        </p>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#fff' }}>
          Page not found
        </h1>
        <p style={{ color: '#888', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link
            href="/projects"
            style={{
              padding: '0.75rem 1.5rem',
              background: '#c9a227',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
            }}
          >
            Browse films
          </Link>
          <Link
            href="/"
            style={{
              padding: '0.75rem 1.5rem',
              background: 'transparent',
              color: '#c9a227',
              border: '1px solid rgba(201,162,39,0.3)',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
            }}
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
