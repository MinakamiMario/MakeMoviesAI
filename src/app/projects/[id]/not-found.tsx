import Link from 'next/link';

export default function ProjectNotFound() {
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
          🎬
        </p>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#fff' }}>
          Project not found
        </h1>
        <p style={{ color: '#888', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          This project may have been removed or the link is incorrect.
        </p>
        <Link
          href="/projects"
          style={{
            display: 'inline-block',
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
      </div>
    </main>
  );
}
