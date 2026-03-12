import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <span className={styles.brand}>MAKEMOVIES</span>
      <span className={styles.sep}>·</span>
      <span className={styles.year}>{new Date().getFullYear()}</span>
    </footer>
  );
}
