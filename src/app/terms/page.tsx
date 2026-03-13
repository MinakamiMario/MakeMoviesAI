import Link from 'next/link';
import Navbar from '@/components/Navbar';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — MakeMovies',
  description: 'Terms of Service for MakeMovies, the collaborative filmmaking platform.',
};

export default function Terms() {
  return (
    <main style={{ minHeight: '100vh' }}>
      <Navbar />
      <article style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
        <h1 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Terms of Service</h1>
        <p style={{ color: 'var(--text-tertiary)', marginBottom: '2rem' }}>Last updated: March 2026</p>

        <h2 style={{ color: 'var(--text-primary)', marginTop: '2rem' }}>1. Acceptance of Terms</h2>
        <p>By accessing or using MakeMovies (&quot;the Platform&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.</p>

        <h2 style={{ color: 'var(--text-primary)', marginTop: '2rem' }}>2. Description of Service</h2>
        <p>MakeMovies is a collaborative filmmaking platform where users can create projects, contribute scenes, fork projects, and collaborate on video content. The Platform is provided &quot;as is&quot; and may change at any time.</p>

        <h2 style={{ color: 'var(--text-primary)', marginTop: '2rem' }}>3. User Accounts</h2>
        <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. You must be at least 16 years old to use the Platform.</p>

        <h2 style={{ color: 'var(--text-primary)', marginTop: '2rem' }}>4. Content Ownership &amp; License</h2>
        <p>You retain ownership of all content you upload to MakeMovies. By uploading content, you grant MakeMovies a non-exclusive, worldwide, royalty-free license to host, display, and distribute your content within the Platform. Other users may fork your projects as part of the Platform&apos;s core functionality.</p>

        <h2 style={{ color: 'var(--text-primary)', marginTop: '2rem' }}>5. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul style={{ paddingLeft: '1.5rem' }}>
          <li>Upload content that infringes on intellectual property rights</li>
          <li>Upload illegal, harmful, or explicit content without appropriate classification</li>
          <li>Harass, threaten, or abuse other users</li>
          <li>Attempt to gain unauthorized access to the Platform or other accounts</li>
          <li>Use automated tools to scrape or overload the Platform</li>
          <li>Impersonate other users or entities</li>
        </ul>

        <h2 style={{ color: 'var(--text-primary)', marginTop: '2rem' }}>6. DMCA &amp; Copyright</h2>
        <p>We respect intellectual property rights. If you believe your copyrighted work has been used without authorization, please contact us at <strong>dmca@makemovies.ai</strong> with: (a) identification of the copyrighted work, (b) identification of the infringing material and its location on the Platform, (c) your contact information, (d) a statement of good faith belief, and (e) a statement under penalty of perjury that the information is accurate.</p>

        <h2 style={{ color: 'var(--text-primary)', marginTop: '2rem' }}>7. Termination</h2>
        <p>We may suspend or terminate your account at any time for violations of these Terms. You may delete your account at any time by contacting support.</p>

        <h2 style={{ color: 'var(--text-primary)', marginTop: '2rem' }}>8. Limitation of Liability</h2>
        <p>MakeMovies is provided &quot;as is&quot; without warranties of any kind. We are not liable for any damages arising from your use of the Platform, including loss of data or content.</p>

        <h2 style={{ color: 'var(--text-primary)', marginTop: '2rem' }}>9. Changes to Terms</h2>
        <p>We may update these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the updated Terms.</p>

        <h2 style={{ color: 'var(--text-primary)', marginTop: '2rem' }}>10. Contact</h2>
        <p>For questions about these Terms, contact us at <strong>legal@makemovies.ai</strong>.</p>

        <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
          <Link href="/privacy" style={{ color: 'var(--accent)' }}>Privacy Policy</Link>
          <span style={{ margin: '0 0.5rem', color: 'var(--text-tertiary)' }}>&middot;</span>
          <Link href="/" style={{ color: 'var(--accent)' }}>Back to home</Link>
        </div>
      </article>
    </main>
  );
}
