import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || 'MakeMovies';
  const subtitle = searchParams.get('subtitle') || 'Finish films together';
  const type = searchParams.get('type') || 'default'; // default | project | user
  const stats = searchParams.get('stats') || '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#0a0a0a',
          fontFamily: 'Inter, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle gradient overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(ellipse at 30% 50%, rgba(201,162,39,0.08) 0%, transparent 60%)',
            display: 'flex',
          }}
        />

        {/* Gold accent line at top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(to right, transparent, #c9a227, transparent)',
            display: 'flex',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            zIndex: 1,
            padding: '0 80px',
            textAlign: 'center',
          }}
        >
          {/* Logo */}
          <div
            style={{
              fontSize: '14px',
              letterSpacing: '6px',
              textTransform: 'uppercase',
              color: '#666666',
              marginBottom: '8px',
              display: 'flex',
            }}
          >
            MAKEMOVIES
          </div>

          {/* Type badge */}
          {type !== 'default' && (
            <div
              style={{
                fontSize: '12px',
                letterSpacing: '3px',
                textTransform: 'uppercase',
                color: '#c9a227',
                padding: '4px 16px',
                border: '1px solid rgba(201,162,39,0.3)',
                borderRadius: '20px',
                display: 'flex',
              }}
            >
              {type === 'project' ? 'PROJECT' : 'FILMMAKER'}
            </div>
          )}

          {/* Title */}
          <div
            style={{
              fontSize: type === 'default' ? '64px' : '52px',
              fontWeight: 300,
              color: '#e8e8e8',
              lineHeight: 1.1,
              maxWidth: '900px',
              display: 'flex',
            }}
          >
            {title}
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: '22px',
              color: '#999999',
              fontWeight: 300,
              maxWidth: '700px',
              display: 'flex',
            }}
          >
            {subtitle}
          </div>

          {/* Stats line */}
          {stats && (
            <div
              style={{
                fontSize: '16px',
                color: '#666666',
                marginTop: '8px',
                display: 'flex',
                gap: '24px',
              }}
            >
              {stats.split('|').map((stat, i) => (
                <span key={i} style={{ display: 'flex' }}>{stat.trim()}</span>
              ))}
            </div>
          )}
        </div>

        {/* Bottom tagline */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            fontSize: '14px',
            color: '#444444',
            display: 'flex',
          }}
        >
          makemovies.ai
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
