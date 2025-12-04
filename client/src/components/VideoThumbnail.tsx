import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play } from 'lucide-react';
import { generateVideoThumbnail } from '@/lib/image-utils';

// Global cache for video thumbnails (persists across component instances)
const thumbnailCache = new Map<string, string>();

interface VideoThumbnailProps {
  videoUrl: string;
  alt?: string;
  className?: string;
  showPlayIcon?: boolean;
  onThumbnailGenerated?: (thumbnailUrl: string) => void;
}

/**
 * Component that displays a thumbnail generated from a video file.
 * Thumbnails are cached to avoid regenerating on re-renders.
 */
export function VideoThumbnail({
  videoUrl,
  alt = 'Video thumbnail',
  className = '',
  showPlayIcon = true,
  onThumbnailGenerated,
}: VideoThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const isGeneratingRef = useRef(false);

  // Check cache first
  const cachedThumbnail = useMemo(() => {
    return thumbnailCache.get(videoUrl) || null;
  }, [videoUrl]);

  useEffect(() => {
    // If we have a cached thumbnail, use it immediately
    if (cachedThumbnail) {
      setThumbnailUrl(cachedThumbnail);
      setIsLoading(false);
      setHasError(false);
      onThumbnailGenerated?.(cachedThumbnail);
      return;
    }

    // Prevent duplicate generation requests
    if (isGeneratingRef.current) {
      return;
    }

    // Generate thumbnail
    isGeneratingRef.current = true;
    setIsLoading(true);
    setHasError(false);

    let cancelled = false;

    generateVideoThumbnail(videoUrl, {
      seekTime: 1,
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.8,
    })
      .then((dataUrl) => {
        // Don't update state if component unmounted
        if (cancelled) return;

        // Cache the thumbnail
        thumbnailCache.set(videoUrl, dataUrl);
        setThumbnailUrl(dataUrl);
        setIsLoading(false);
        setHasError(false);
        onThumbnailGenerated?.(dataUrl);
        isGeneratingRef.current = false;
      })
      .catch((error) => {
        // Don't update state if component unmounted
        if (cancelled) return;

        console.warn('Failed to generate video thumbnail:', error);
        setThumbnailUrl(null);
        setIsLoading(false);
        setHasError(true);
        isGeneratingRef.current = false;
      });

    // Cleanup function
    return () => {
      cancelled = true;
      isGeneratingRef.current = false;
    };
  }, [videoUrl, cachedThumbnail, onThumbnailGenerated]);

  // Loading state - show placeholder with play icon
  if (isLoading) {
    return (
      <div className={`relative aspect-square bg-gray-900 flex items-center justify-center ${className}`}>
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-white rounded-full animate-spin" />
        </div>
        {showPlayIcon && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center opacity-50">
              <Play className="h-8 w-8 text-gray-700 ml-1 fill-current" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Error state - show fallback with play icon
  if (hasError || !thumbnailUrl) {
    return (
      <div className={`relative aspect-square bg-gray-900 flex items-center justify-center ${className}`}>
        <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
          {showPlayIcon && (
            <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center">
              <Play className="h-8 w-8 text-gray-700 ml-1 fill-current" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Success state - show thumbnail with optional play icon overlay
  return (
    <div className={`relative ${className}`}>
      <img
        src={thumbnailUrl}
        alt={alt}
        className="w-full h-full object-cover"
        loading="lazy"
      />
      {showPlayIcon && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 bg-white/80 rounded-full flex items-center justify-center shadow-lg opacity-80 hover:opacity-100 transition-opacity">
            <Play className="h-6 w-6 text-gray-900 ml-1 fill-current" />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Clear the thumbnail cache (useful for testing or memory management)
 */
export function clearThumbnailCache() {
  thumbnailCache.clear();
}

/**
 * Preload thumbnails for multiple videos
 */
export async function preloadVideoThumbnails(videoUrls: string[]): Promise<void> {
  const uncachedUrls = videoUrls.filter(url => !thumbnailCache.has(url));
  
  await Promise.allSettled(
    uncachedUrls.map(url =>
      generateVideoThumbnail(url)
        .then(thumbnail => {
          thumbnailCache.set(url, thumbnail);
        })
        .catch(error => {
          console.warn(`Failed to preload thumbnail for ${url}:`, error);
        })
    )
  );
}

