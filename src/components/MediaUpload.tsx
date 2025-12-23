'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './MediaUpload.module.css';

type Props = {
  onUpload: (url: string) => void;
  currentUrl?: string;
};

export default function MediaUpload({ onUpload, currentUrl }: Props) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const supabase = createClient();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error } = await supabase.storage
      .from('media')
      .upload(fileName, file);

    if (error) {
      console.error('Upload error:', error);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    setPreview(publicUrl);
    onUpload(publicUrl);
    setUploading(false);
  };

  const isVideo = preview?.match(/\.(mp4|webm|mov)$/i);

  return (
    <div className={styles.container}>
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
