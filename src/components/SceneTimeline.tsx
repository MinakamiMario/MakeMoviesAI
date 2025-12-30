'use client';

import Link from 'next/link';
import { Scene } from '@/types';
import styles from './SceneTimeline.module.css';

type Props = {
  scenes: Scene[];
  isDirector: boolean;
  projectId: string;
  showContributeButton: boolean;
};

export default function SceneTimeline({
  scenes,
  isDirector,
  projectId,
  showContributeButton,
}: Props) {
  return (
    <div className={styles.timeline}>
      <div className={styles.timelineHeader}>
        <h2>Timeline</h2>
        {isDirector && (
          <Link href={`/projects/${projectId}/add-scene`} className={styles.addBtn}>
            + Add scene
          </Link>
        )}
      </div>

      {scenes.length === 0 ? (
        <p className={styles.empty}>No scenes yet.</p>
      ) : (
        <div className={styles.scenes}>
          {scenes.map((scene, index) => (
            <div key={scene.id} className={styles.scene}>
              <span className={styles.sceneNumber}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className={styles.sceneContent}>
                {scene.media_url && (
                  <div className={styles.sceneMedia}>
                    {scene.media_url.match(/\.(mp4|webm|mov)$/i) ? (
                      <video src={scene.media_url} controls />
                    ) : (
                      <img src={scene.media_url} alt={scene.title} />
                    )}
                  </div>
                )}
                <h3>{scene.title}</h3>
                {scene.description && <p>{scene.description}</p>}
                {scene.profiles && (
                  <span className={styles.contributor}>
                    by @{scene.profiles.username}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showContributeButton && (
        <Link
          href={`/projects/${projectId}/contribute`}
          className={styles.contributeBtn}
        >
          + Submit a contribution
        </Link>
      )}
    </div>
  );
}
