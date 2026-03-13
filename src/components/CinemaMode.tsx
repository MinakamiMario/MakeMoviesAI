'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import styles from './CinemaMode.module.css';

type CinemaScene = {
  id: string;
  title: string;
  media_url: string | null;
  contributor_username?: string | null;
};

type Props = {
  scenes: CinemaScene[];
  projectTitle: string;
  onClose: () => void;
};

export default function CinemaMode({ scenes, projectTitle, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);

  const playableScenes = scenes.filter(s => s.media_url);
  const currentScene = playableScenes[currentIndex];

  const isHlsUrl = (url: string) => url.endsWith('.m3u8') || url.includes('.m3u8?');

  const loadScene = useCallback((index: number) => {
    const video = videoRef.current;
    const scene = playableScenes[index];
    if (!video || !scene?.media_url) return;

    // Cleanup HLS
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHlsUrl(scene.media_url)) {
      if (Hls.isSupported()) {
        const hls = new Hls({ maxBufferLength: 30 });
        hlsRef.current = hls;
        hls.loadSource(scene.media_url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = scene.media_url;
        video.play().catch(() => {});
      }
    } else {
      video.src = scene.media_url;
      video.play().catch(() => {});
    }
  }, [playableScenes]);

  // Load first scene
  useEffect(() => {
    if (playableScenes.length > 0) {
      loadScene(0);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  // Auto-advance to next scene
  const handleEnded = useCallback(() => {
    if (currentIndex < playableScenes.length - 1) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      loadScene(next);
    } else {
      // Film ended
      setIsPlaying(false);
      setShowControls(true);
    }
  }, [currentIndex, playableScenes.length, loadScene]);

  // Progress tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setProgress(video.currentTime);
      setDuration(video.duration || 0);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [handleEnded]);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        const video = videoRef.current;
        if (video) {
          if (video.paused) video.play().catch(() => {});
          else video.pause();
        }
      } else if (e.key === 'ArrowRight') {
        if (currentIndex < playableScenes.length - 1) {
          const next = currentIndex + 1;
          setCurrentIndex(next);
          loadScene(next);
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentIndex > 0) {
          const prev = currentIndex - 1;
          setCurrentIndex(prev);
          loadScene(prev);
        }
      }
      resetControlsTimer();
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, playableScenes.length, loadScene, onClose, resetControlsTimer]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const goToScene = (index: number) => {
    setCurrentIndex(index);
    loadScene(index);
  };

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const overallProgress = playableScenes.length > 0
    ? ((currentIndex / playableScenes.length) * 100) + (progressPercent / playableScenes.length)
    : 0;

  if (playableScenes.length === 0) {
    return (
      <div className={styles.overlay}>
        <div className={styles.emptyState}>
          <p>No playable scenes yet.</p>
          <button onClick={onClose} className={styles.closeBtn}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.overlay}
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
    >
      {/* Video */}
      <video
        ref={videoRef}
        className={styles.video}
        playsInline
        onClick={togglePlay}
      />

      {/* Top bar */}
      <div className={`${styles.topBar} ${showControls ? styles.visible : ''}`}>
        <div className={styles.titleArea}>
          <span className={styles.filmTitle}>{projectTitle}</span>
          <span className={styles.sceneLabel}>
            Scene {currentIndex + 1} of {playableScenes.length}
            {currentScene?.title && ` \u2014 ${currentScene.title}`}
          </span>
        </div>
        <button onClick={onClose} className={styles.closeBtn} aria-label="Exit cinema mode">
          &#10005;
        </button>
      </div>

      {/* Bottom controls */}
      <div className={`${styles.bottomBar} ${showControls ? styles.visible : ''}`}>
        {/* Overall progress bar */}
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${overallProgress}%` }} />
          {/* Scene markers */}
          {playableScenes.map((_, i) => (
            <button
              key={i}
              className={`${styles.sceneMarker} ${i === currentIndex ? styles.activeMarker : ''}`}
              style={{ left: `${(i / playableScenes.length) * 100}%` }}
              onClick={() => goToScene(i)}
              aria-label={`Go to scene ${i + 1}`}
            />
          ))}
        </div>

        <div className={styles.controls}>
          <button
            onClick={() => goToScene(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className={styles.controlBtn}
            aria-label="Previous scene"
          >
            &#9664;&#9664;
          </button>

          <button onClick={togglePlay} className={styles.playBtn} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '\u23F8' : '\u25B6'}
          </button>

          <button
            onClick={() => goToScene(Math.min(playableScenes.length - 1, currentIndex + 1))}
            disabled={currentIndex >= playableScenes.length - 1}
            className={styles.controlBtn}
            aria-label="Next scene"
          >
            &#9654;&#9654;
          </button>

          {currentScene?.contributor_username && (
            <span className={styles.contributorLabel}>
              by @{currentScene.contributor_username}
            </span>
          )}
        </div>
      </div>

      {/* Play overlay on pause */}
      {!isPlaying && (
        <div className={styles.playOverlay} onClick={togglePlay}>
          <span className={styles.bigPlay}>&#9654;</span>
        </div>
      )}
    </div>
  );
}
