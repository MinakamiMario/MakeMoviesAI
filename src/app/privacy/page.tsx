import Link from 'next/link';
import Navbar from '@/components/Navbar';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — MakeMovies',
  description: 'Privacy Policy for MakeMovies, the collaborative filmmaking platform.',
};

export default function Privacy() {
  return (
    <main style={{ minHeight: '100vh' }}>
      <Navbar />
      <article style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
        <h1 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Privacy Policy</h1>
        <p style={{ color: 'var(--text-tertiary)', marginBottom: '2rem' }}>Last updated: March 2026</p>

        <h2 style={{ color: 'var(--text-primary)', marginTop: '2rem' }}>1. Data We Collect</h2>
        <p>We collect the following data when you use MakeMovies:</p>
        <ul style={{ paddingLeft: '1.5rem' }}>
          <li><strong>Account data</strong>: email address, username, password (hashed)</li>
          <li><strong>Content data</strong>: projects, scenes, contributions, comments, and messages you create</li>
          <li><strong>Usage data</strong>: page views, project views, and basic analytics</li>
          <li><strong>Technical data</strong>: IP address, browser type (for security and abuse prevention)</li>
        </ul>

        <h2 style={{ color: 'var(--text-primary)', marginTop: '2rem' }}>2. How We Use Your Data</h2>
        <ul style={{ paddingLeft: '1.5rem' }}>
          <li>To provide and maintain the Platform</li>
          <li>To send notifications about your projects and contributions</li>
          <li>To prevent abuse and enforce our Terms of Service</li>
          <li>To improve the Platform based on usage patterns</li>
        </ul>

        <h2 style={{ color: 'var(--text-primary)', marginTop: '2rem' }}>3. Data Sharing</h2>
        <p>We do not sell your personal data. We may share data with:</p>
        <ul style={{ paddingLeft: '1.5rem' }}>
          <li><strong>Service providers</strong>: hosting (Supabase, Vercel), email delivery, and analytics services that process data on our behalf</li>
          <li><strong>Legal requirements</strong>: when required by law or to protect our rights</li>
        </ul>

        <h2 style={{ color: 'var(--text-primary)', marginTop: '2rem' }}>4. Data Storage &amp; Security</h2>
        <p>Your data is stored securely on Supabase infrastructure (EU/US regions). We use encryption in transit (TLS) and at rest. Passwords are hashed using industry-standard algorithms. We implement row-level security on all database tables.</p>

        <h2 style={{ color: 'var(--text-primary)', marginTop: '2rem' }}>5. Your Rights (GDPR/AVG)</h2>
        <p>Under the General Data Protection Regulation (GDPR) and the Dutch Algemene Verordening Gegevensbescherming (AVG), you have the right to:</p>
        <ul style={{ paddingLeft: '1.5rem' }}>
          <li><strong>Access</strong>: request a copy of your personal data</li>
          <li><strong>Rectification</strong>: correct inaccurate data</li>
          <li><strong>Erasure</strong>: request deletion of your data (&quot;right to be forgotten&quot;)</li>
          <li><strong>Portability</strong>: receive your data in a structured format</li>
          <li><strong>Object</strong>: object to processing of your data</li>
          <li><strong>Restriction</strong>: restrict processing under certain conditions</li>
        </ul>
        <p>To exercise these rights, contact <strong>privacy@makemovies.ai</strong>.</p>

        <h2 style={{ color: 'var(--text-primary)', marginTop: '2rem' }}>6. Cookies</h2>
        <p>We use essential cookies for authentication and session management only. We do not use tracking cookies or third-party advertising cookies.</p>

        <h2 style={{ color: 'var(--text-primary)', marginTop: '2rem' }}>7. Data Retention</h2>
        <p>We retain your data for as long as your account is active. When you delete your account, we remove your personal data within 30 days. Publicly contributed content (scenes in other users&apos; projects) may be retained as part of the collaborative work.</p>

        <h2 style={{ color: 'var(--text-primary)', marginTop: '2rem' }}>8. Children</h2>
        <p>MakeMovies is not intended for users under 16 years of age. We do not knowingly collect data from children under 16.</p>

        <h2 style={{ color: 'var(--text-primary)', marginTop: '2rem' }}>9. Changes to This Policy</h2>
        <p>We may update this Privacy Policy at any time. We will notify you of significant changes via email or in-app notification.</p>

        <h2 style={{ color: 'var(--text-primary)', marginTop: '2rem' }}>10. Contact</h2>
        <p>For privacy inquiries: <strong>privacy@makemovies.ai</strong></p>
        <p>Data Protection Officer: MakeMovies B.V., The Netherlands</p>

        <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
          <Link href="/terms" style={{ color: 'var(--accent)' }}>Terms of Service</Link>
          <span style={{ margin: '0 0.5rem', color: 'var(--text-tertiary)' }}>&middot;</span>
          <Link href="/" style={{ color: 'var(--accent)' }}>Back to home</Link>
        </div>
      </article>
    </main>
  );
}
