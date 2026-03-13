import Link from 'next/link';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.row}>
        <span className={styles.brand}>MAKEMOVIES</span>
        <span className={styles.sep}>&middot;</span>
        <span className={styles.year}>{new Date().getFullYear()}</span>
      </div>
      <div className={styles.links}>
        <Link href="/terms" className={styles.link}>Terms</Link>
        <span className={styles.sep}>&middot;</span>
        <Link href="/privacy" className={styles.link}>Privacy</Link>
        <span className={styles.sep}>&middot;</span>
        <a href="mailto:support@makemovies.ai" className={styles.link}>Contact</a>
      </div>
    </footer>
  );
}
