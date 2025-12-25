'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './MediaUpload.module.css';

type Props = {
  projectId: string;
  onUpload: (url: string, assetId?: string) => void;
  currentUrl?: string;
};

export default function MediaUpload({ projectId, onUpload, currentUrl }: Props) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('You must be logged in to upload');
      setUploading(false);
      return;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const storagePath = `${projectId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(storagePath, file);

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(storagePath);

    const { data: asset, error: assetError } = await supabase
      .from('media_assets')
      .insert({
        project_id: projectId,
        storage_path: storagePath,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user.id,
      })
      .select('id')
      .single();

    if (assetError) {
      console.error('Failed to register asset:', assetError);
    }

    setPreview(publicUrl);
    onUpload(publicUrl, asset?.id);
    setUploading(false);
  };

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
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              onUpload('');
            }}
            className={styles.removeBtn}
          >
            Remove
          </button>
        </div>
      ) : (
        <label className={styles.uploadLabel}>
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handleUpload}
            disabled={uploading}
            className={styles.input}
          />
          {uploading ? 'Uploading...' : '+ Add image or video'}
        </label>
      )}
    </div>
  );
}
