'use client';

import { useState } from 'react';
import styles from './ShareCreditButton.module.css';

type Props = {
  projectId: string;
  projectTitle: string;
};

export default function ShareCreditButton({ projectId, projectTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const projectUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/projects/${projectId}`
      : `/projects/${projectId}`;

  const tweetText = `I contributed to "${projectTitle}" on MakeMovies \ud83c\udfac\n${projectUrl}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(projectUrl);
    } catch {
      const input = document.createElement('input');
      input.value = projectUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setOpen(false);
  };

  return (
    <div className={styles.wrapper}>
      <button
        className={styles.shareBtn}
        onClick={() => setOpen(!open)}
        type="button"
        aria-label="Share your credit"
      >
        Share
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.dropdown}>
            <button
              className={styles.dropdownItem}
              onClick={handleCopy}
              type="button"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.dropdownItem}
              onClick={() => setOpen(false)}
            >
              Share on X
            </a>
          </div>
        </>
      )}
    </div>
  );
}
