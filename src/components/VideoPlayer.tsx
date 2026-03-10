'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import styles from './VideoPlayer.module.css';

type PlaybackState = 'loading' | 'ready' | 'error' | 'processing';

type Props = {
  /** Direct MP4 URL or HLS manifest URL (.m3u8) */
  src: string | null;
  /** Poster image shown before playback */
  poster?: string;
  /** Accessible label for the video */
  alt?: string;
  /** Show native browser controls (default: true) */
  controls?: boolean;
  /** CSS class for the wrapper */
  className?: string;
  /** Processing status message when src is null */
  processingMessage?: string;
};

function isHlsUrl(url: string): boolean {
  return url.endsWith('.m3u8') || url.includes('.m3u8?');
}

export default function VideoPlayer({
  src,
  poster,
  alt = 'Video',
  controls = true,
  className,
  processingMessage = 'Video is being processed...',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [state, setState] = useState<PlaybackState>(src ? 'loading' : 'processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) {
      setState(src ? 'loading' : 'processing');
      return;
    }

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHlsUrl(src)) {
      // HLS playback
      if (Hls.isSupported()) {
        const hls = new Hls({
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
        });
        hlsRef.current = hls;

        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setState('ready');
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            setState('error');
            setErrorMessage('Playback error. Try refreshing.');
            hls.destroy();
            hlsRef.current = null;
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = src;
        video.addEventListener('loadedmetadata', () => setState('ready'), { once: true });
        video.addEventListener('error', () => {
          setState('error');
          setErrorMessage('Playback error. Try refreshing.');
        }, { once: true });
      } else {
        setState('error');
        setErrorMessage('HLS playback not supported in this browser.');
      }
    } else {
      // Progressive MP4 playback
      video.src = src;
      video.addEventListener('loadedmetadata', () => setState('ready'), { once: true });
      video.addEventListener('error', () => {
        setState('error');
        setErrorMessage('Could not load video.');
      }, { once: true });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src]);

  if (state === 'processing') {
    return (
      <div className={`${styles.wrapper} ${className || ''}`}>
        <div className={styles.placeholder}>
          <div className={styles.spinner} />
          <span className={styles.processingText}>{processingMessage}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.wrapper} ${className || ''}`}>
      {state === 'error' && (
        <div className={styles.placeholder}>
          <span className={styles.errorText}>{errorMessage}</span>
        </div>
      )}
      <video
        ref={videoRef}
        controls={controls}
        poster={poster}
        playsInline
        preload="metadata"
        aria-label={alt}
        className={`${styles.video} ${state === 'error' ? styles.hidden : ''}`}
      />
    </div>
  );
}
