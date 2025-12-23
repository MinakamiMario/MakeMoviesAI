import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <p className={styles.logo}>MakeMovies</p>
        <h1 className={styles.tagline}>Finish films together.</h1>
        <p className={styles.subtitle}>One vision. Many hands. Nothing gets lost.</p>
        <div className={styles.actions}>
          <Link href="/login" className={styles.primaryBtn}>
            Get started
          </Link>
          <Link href="/projects" className={styles.secondaryBtn}>
            Browse projects
          </Link>
        </div>
      </div>
    </main>
  );
}
