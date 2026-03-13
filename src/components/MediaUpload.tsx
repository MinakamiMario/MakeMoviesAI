'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './MediaUpload.module.css';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const MAX_DURATION = 30 * 60; // 30 minutes in seconds
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

type Props = {
  projectId: string;
  onUpload: (url: string, assetId?: string) => void;
  currentUrl?: string;
  /** Only accept video files (default: false = accept video + images) */
  videoOnly?: boolean;
};

type VideoMeta = {
  duration: number;
  width: number;
  height: number;
};

/** Extract video metadata using browser HTMLVideoElement */
function extractVideoMetadata(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        duration: Math.round(video.duration),
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read video metadata. File may be corrupted.'));
    };

    // Timeout after 10 seconds
    setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error('Video metadata extraction timed out.'));
    }, 10000);
  });
}

export default function MediaUpload({ projectId, onUpload, currentUrl, videoOnly = false }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<string | null>(null);
  const supabase = createClient();

  const allowedTypes = videoOnly
    ? ALLOWED_VIDEO_TYPES
    : [...ALLOWED_VIDEO_TYPES, ...ALLOWED_IMAGE_TYPES];

  const acceptAttr = videoOnly
    ? '.mp4,.webm,.mov'
    : 'image/*,video/*';

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setVideoInfo(null);
    setProgress(0);

    // --- Client-side validation ---

    // File size check
    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(0)}MB). Maximum is 500MB.`);
      return;
    }

    // File type check
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);

    if (!isVideo && !isImage) {
      setError(`Unsupported file type: ${file.type}. Use MP4, WebM, MOV, JPEG, PNG, or WebP.`);
      return;
    }

    if (videoOnly && !isVideo) {
      setError('Only video files are accepted here (MP4, WebM, MOV).');
      return;
    }

    // Video-specific validation
    let meta: VideoMeta | null = null;
    if (isVideo) {
      try {
        meta = await extractVideoMetadata(file);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not read video file.');
        return;
      }

      if (meta.duration > MAX_DURATION) {
        const mins = Math.round(meta.duration / 60);
        setError(`Video too long (${mins} min). Maximum is 30 minutes.`);
        return;
      }

      if (meta.width === 0 || meta.height === 0) {
        setError('Could not determine video dimensions. File may be corrupted.');
        return;
      }

      const mins = Math.floor(meta.duration / 60);
      const secs = meta.duration % 60;
      setVideoInfo(`${meta.width}×${meta.height} · ${mins}:${String(secs).padStart(2, '0')}`);
    }

    // --- Upload ---
    setUploading(true);
    setProgress(10); // Start progress indicator

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('You must be logged in to upload');
      setUploading(false);
      return;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const storagePath = `${projectId}/${fileName}`;

    setProgress(20);

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(storagePath, file);

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    setProgress(70);

    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(storagePath);

    // Create media_assets record with metadata
    const insertData: Record<string, unknown> = {
      project_id: projectId,
      storage_path: storagePath,
      file_type: file.type,
      file_size: file.size,
      uploaded_by: user.id,
      status: 'ready', // Browser-validated, ready for playback
    };

    if (meta) {
      insertData.duration = meta.duration;
      insertData.width = meta.width;
      insertData.height = meta.height;
      insertData.metadata = {
        original_filename: file.name,
        browser_validated: true,
        validated_at: new Date().toISOString(),
      };
    }

    setProgress(85);

    const { data: asset, error: assetError } = await supabase
      .from('media_assets')
      .insert(insertData)
      .select('id')
      .single();

    if (assetError) {
      console.error('Failed to register asset:', assetError);
    }

    // Also update the processing_job that was auto-created by trigger
    if (asset?.id) {
      await supabase
        .from('processing_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          result: { validated_by: 'browser', metadata: meta },
        })
        .eq('media_asset_id', asset.id)
        .eq('job_type', 'validate');
    }

    setProgress(100);
    setPreview(publicUrl);
    onUpload(publicUrl, asset?.id);
    setUploading(false);
  }, [projectId, onUpload, supabase, videoOnly]);

  const isVideo = preview?.match(/\.(mp4|webm|mov)$/i);

  return (
    <div className={styles.container}>
      {error && <p className={styles.error}>{error}</p>}
      {preview ? (
        <div className={styles.preview}>
          {isVideo ? (
            <video src={preview} controls className={styles.media} />
          ) : (
            <img src={preview} alt="Preview" className={styles.media} />
          )}
          {videoInfo && <span className={styles.videoInfo}>{videoInfo}</span>}
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              setVideoInfo(null);
              onUpload('');
            }}
            className={styles.removeBtn}
          >
            Remove
          </button>
        </div>
      ) : (
        <>
          <label className={styles.uploadLabel}>
            <input
              type="file"
              accept={acceptAttr}
              onChange={handleUpload}
              disabled={uploading}
              className={styles.input}
            />
            {uploading ? (
              <div className={styles.uploadProgress}>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                </div>
                <span className={styles.progressText}>Uploading... {progress}%</span>
              </div>
            ) : (
              videoOnly ? '+ Add video (MP4, WebM, MOV)' : '+ Add image or video'
            )}
          </label>
          <p className={styles.hint}>Max 500MB · Videos up to 30 min</p>
        </>
      )}
    </div>
  );
}
