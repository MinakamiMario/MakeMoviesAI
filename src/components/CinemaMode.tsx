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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CinemaMode({ scenes, projectTitle, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
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

    // Reset progress for new scene
    setProgress(0);
    setDuration(0);

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

  // Seek within current scene
  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video || !isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(time, video.duration));
  }, []);

  const skipForward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    // If near end of scene (< 2s left), go to next scene
    if (video.duration - video.currentTime < 2 && currentIndex < playableScenes.length - 1) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      loadScene(next);
    } else {
      seekTo(video.currentTime + 10);
    }
    resetControlsTimer();
  }, [currentIndex, playableScenes.length, loadScene, seekTo, resetControlsTimer]);

  const skipBackward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    // If near start of scene (< 2s in), go to previous scene
    if (video.currentTime < 2 && currentIndex > 0) {
      const prev = currentIndex - 1;
      setCurrentIndex(prev);
      loadScene(prev);
    } else {
      seekTo(video.currentTime - 10);
    }
    resetControlsTimer();
  }, [currentIndex, loadScene, seekTo, resetControlsTimer]);

  // Click on progress bar to seek
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressRef.current;
    const video = videoRef.current;
    if (!bar || !video || !isFinite(video.duration)) return;

    const rect = bar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = clickX / rect.width;
    video.currentTime = ratio * video.duration;
    resetControlsTimer();
  }, [resetControlsTimer]);

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
        e.preventDefault();
        skipForward();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        skipBackward();
      } else if (e.key === 'l') {
        // YouTube-style: L = skip forward 10s
        skipForward();
      } else if (e.key === 'j') {
        // YouTube-style: J = skip backward 10s
        skipBackward();
      } else if (e.key === 'n' || e.key === 'N') {
        // N = next scene
        if (currentIndex < playableScenes.length - 1) {
          const next = currentIndex + 1;
          setCurrentIndex(next);
          loadScene(next);
        }
      } else if (e.key === 'p' || e.key === 'P') {
        // P = previous scene
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
  }, [currentIndex, playableScenes.length, loadScene, onClose, resetControlsTimer, skipForward, skipBackward]);

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
        {/* Scene progress bar (clickable to seek) */}
        <div
          ref={progressRef}
          className={styles.progressTrack}
          onClick={handleProgressClick}
        >
          <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
        </div>

        {/* Time display */}
        <div className={styles.timeRow}>
          <span className={styles.time}>{formatTime(progress)}</span>
          <span className={styles.time}>{duration > 0 ? formatTime(duration) : '--:--'}</span>
        </div>

        <div className={styles.controls}>
          {/* Previous scene */}
          <button
            onClick={() => goToScene(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className={styles.controlBtn}
            aria-label="Previous scene"
            title="Previous scene (P)"
          >
            &#9664;&#9664;
          </button>

          {/* Skip backward 10s */}
          <button
            onClick={skipBackward}
            className={styles.controlBtn}
            aria-label="Rewind 10 seconds"
            title="Rewind 10s (J / &larr;)"
          >
            <span className={styles.skipIcon}>10</span>
            <span className={styles.skipArrow}>&#8630;</span>
          </button>

          {/* Play/Pause */}
          <button onClick={togglePlay} className={styles.playBtn} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '\u23F8' : '\u25B6'}
          </button>

          {/* Skip forward 10s */}
          <button
            onClick={skipForward}
            className={styles.controlBtn}
            aria-label="Forward 10 seconds"
            title="Forward 10s (L / &rarr;)"
          >
            <span className={styles.skipIcon}>10</span>
            <span className={styles.skipArrow}>&#8631;</span>
          </button>

          {/* Next scene */}
          <button
            onClick={() => goToScene(Math.min(playableScenes.length - 1, currentIndex + 1))}
            disabled={currentIndex >= playableScenes.length - 1}
            className={styles.controlBtn}
            aria-label="Next scene"
            title="Next scene (N)"
          >
            &#9654;&#9654;
          </button>
        </div>

        {/* Scene indicators */}
        {playableScenes.length > 1 && (
          <div className={styles.sceneIndicators}>
            {playableScenes.map((s, i) => (
              <button
                key={s.id}
                className={`${styles.sceneDot} ${i === currentIndex ? styles.activeDot : ''} ${i < currentIndex ? styles.playedDot : ''}`}
                onClick={() => goToScene(i)}
                aria-label={`Scene ${i + 1}: ${s.title}`}
                title={`Scene ${i + 1}: ${s.title}`}
              />
            ))}
          </div>
        )}

        {currentScene?.contributor_username && (
          <span className={styles.contributorLabel}>
            by @{currentScene.contributor_username}
          </span>
        )}
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
