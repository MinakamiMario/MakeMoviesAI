'use client';

import { useState, useRef, useEffect } from 'react';
import { Scene } from '@/types';
import styles from './HorizontalTimeline.module.css';

type Props = {
  scenes: Scene[];
  onSceneClick?: (sceneIndex: number) => void;
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
  return `${s}s`;
}

export default function HorizontalTimeline({ scenes, onSceneClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const totalDuration = scenes.reduce((sum, s) => sum + (s.duration || 0), 0);
  const hasDurations = totalDuration > 0;

  // Calculate width percentages
  const sceneWidths = scenes.map((scene) => {
    if (!hasDurations) return 100 / scenes.length;
    const dur = scene.duration || 0;
    // Minimum 5% so short clips are still visible
    return Math.max(5, (dur / totalDuration) * 100);
  });

  // Normalize so they sum to 100
  const widthSum = sceneWidths.reduce((a, b) => a + b, 0);
  const normalizedWidths = sceneWidths.map((w) => (w / widthSum) * 100);

  // Horizontal scroll with mouse drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    containerRef.current.scrollLeft = scrollLeft - (x - startX);
  };

  const handleMouseUp = () => setIsDragging(false);

  // Running time offset for each scene
  const timeOffsets: number[] = [];
  let runningTime = 0;
  scenes.forEach((s) => {
    timeOffsets.push(runningTime);
    runningTime += s.duration || 0;
  });

  return (
    <div className={styles.wrapper}>
      {/* Total duration label */}
      {hasDurations && (
        <div className={styles.totalDuration}>
          Total: {formatDuration(totalDuration)}
        </div>
      )}

      {/* Horizontal scrollable timeline */}
      <div
        ref={containerRef}
        className={styles.container}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className={styles.track}
          style={{ minWidth: scenes.length > 6 ? `${scenes.length * 120}px` : '100%' }}
        >
          {scenes.map((scene, index) => {
            const isHovered = hoveredIndex === index;
            const hasMedia = !!scene.media_url;

            return (
              <div
                key={scene.id}
                className={`${styles.segment} ${isHovered ? styles.segmentHovered : ''} ${hasMedia ? styles.segmentPlayable : ''}`}
                style={{ width: `${normalizedWidths[index]}%` }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => onSceneClick?.(index)}
              >
                {/* Duration bar (proportional fill) */}
                <div className={styles.bar}>
                  <div
                    className={styles.barFill}
                    style={{
                      opacity: hasMedia ? 1 : 0.3,
                    }}
                  />
                </div>

                {/* Scene info */}
                <div className={styles.segmentInfo}>
                  <span className={styles.sceneNum}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={styles.sceneTitle} title={scene.title}>
                    {scene.title}
                  </span>
                  {scene.duration ? (
                    <span className={styles.sceneDuration}>
                      {formatDuration(scene.duration)}
                    </span>
                  ) : (
                    <span className={styles.sceneDuration}>--</span>
                  )}
                </div>

                {/* Hover tooltip */}
                {isHovered && (
                  <div className={styles.tooltip}>
                    <strong>{scene.title}</strong>
                    {scene.duration && (
                      <span>{formatDuration(scene.duration)}</span>
                    )}
                    {scene.profiles && (
                      <span className={styles.tooltipAuthor}>
                        @{scene.profiles.username}
                      </span>
                    )}
                    {hasDurations && (
                      <span className={styles.tooltipTime}>
                        {formatDuration(timeOffsets[index])} — {formatDuration(timeOffsets[index] + (scene.duration || 0))}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Time ruler */}
      {hasDurations && (
        <div className={styles.ruler}>
          <span className={styles.rulerMark}>0:00</span>
          {totalDuration > 30 && (
            <span className={styles.rulerMark} style={{ left: '25%' }}>
              {formatDuration(totalDuration * 0.25)}
            </span>
          )}
          <span className={styles.rulerMark} style={{ left: '50%' }}>
            {formatDuration(totalDuration * 0.5)}
          </span>
          {totalDuration > 30 && (
            <span className={styles.rulerMark} style={{ left: '75%' }}>
              {formatDuration(totalDuration * 0.75)}
            </span>
          )}
          <span className={styles.rulerMark} style={{ left: '100%' }}>
            {formatDuration(totalDuration)}
          </span>
        </div>
      )}
    </div>
  );
}
