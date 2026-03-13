'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MediaAssetStatus } from '@/types';

type AssetStatusUpdate = {
  status: MediaAssetStatus;
  errorMessage: string | null;
};

/**
 * Subscribe to realtime status changes for a media asset.
 * Returns live status + error so VideoPlayer can react immediately
 * when a server-side worker updates the asset.
 *
 * Pass assetId=undefined to disable (no subscription created).
 */
export function useMediaAssetStatus(assetId: string | undefined | null): AssetStatusUpdate | null {
  const [update, setUpdate] = useState<AssetStatusUpdate | null>(null);

  useEffect(() => {
    if (!assetId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`media-asset-${assetId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'media_assets',
          filter: `id=eq.${assetId}`,
        },
        (payload) => {
          const { status, error_message } = payload.new as {
            status: MediaAssetStatus;
            error_message: string | null;
          };
          setUpdate({ status, errorMessage: error_message });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [assetId]);

  return update;
}
