/**
 * Utility functions for image processing and thumbnail generation
 */

export interface ThumbnailOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Generate a thumbnail from an image file
 * @param file - Original image file
 * @param options - Thumbnail generation options
 * @returns Promise resolving to thumbnail blob and dimensions
 */
export async function generateThumbnail(
  file: File,
  options: ThumbnailOptions = {}
): Promise<{ blob: Blob; width: number; height: number }> {
  const {
    maxWidth = 400,
    maxHeight = 400,
    quality = 0.8,
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    // Create object URL from file and set as image source
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      // Revoke URL after image loads to prevent memory leaks
      URL.revokeObjectURL(url);
      
      try {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;
          
          if (width > height) {
            width = maxWidth;
            height = Math.round(width / aspectRatio);
          } else {
            height = maxHeight;
            width = Math.round(height * aspectRatio);
          }
        }

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Draw resized image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, width, height });
            } else {
              reject(new Error('Failed to create thumbnail blob'));
            }
          },
          'image/jpeg',
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Upload both original and thumbnail versions of an image to Firebase Storage
 * @param file - Original image file
 * @param basePath - Base path in Firebase Storage (e.g., 'cover-images')
 * @param fileName - File name without extension
 * @returns Promise resolving to both URLs
 */
export async function uploadImageWithThumbnail(
  file: File,
  basePath: string,
  fileName: string
): Promise<{ originalUrl: string; thumbnailUrl: string }> {
  const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
  const storage = getStorage();

  // Generate thumbnail
  const { blob: thumbnailBlob } = await generateThumbnail(file, {
    maxWidth: 400,
    maxHeight: 400,
    quality: 0.8,
  });

  // Upload original
  const originalRef = ref(storage, `${basePath}/${fileName}`);
  await uploadBytes(originalRef, file);
  const originalUrl = await getDownloadURL(originalRef);

  // Upload thumbnail
  const thumbnailRef = ref(storage, `${basePath}/thumbnails/${fileName}`);
  await uploadBytes(thumbnailRef, thumbnailBlob);
  const thumbnailUrl = await getDownloadURL(thumbnailRef);

  return { originalUrl, thumbnailUrl };
}

export interface VideoThumbnailOptions {
  seekTime?: number; // Time in seconds to seek to (default: 1)
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Generate a thumbnail from a video URL by capturing a frame
 * @param videoUrl - URL of the video file
 * @param options - Thumbnail generation options
 * @returns Promise resolving to thumbnail data URL
 */
export async function generateVideoThumbnail(
  videoUrl: string,
  options: VideoThumbnailOptions = {}
): Promise<string> {
  const {
    seekTime = 1,
    maxWidth = 400,
    maxHeight = 400,
    quality = 0.8,
  } = options;

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    // Set video attributes
    video.crossOrigin = 'anonymous'; // Handle CORS
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    // Hide video element
    video.style.display = 'none';
    document.body.appendChild(video);

    // Cleanup function
    const cleanup = () => {
      if (video.parentNode) {
        document.body.removeChild(video);
      }
      video.src = '';
      video.load();
    };

    // Timeout fallback
    const timeout = setTimeout(() => {
      cleanup();
      // Remove event listeners to prevent them from firing after timeout
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
      reject(new Error('Video thumbnail generation timeout'));
    }, 10000); // 10 second timeout

    // Wrap resolve/reject to clear timeout and cleanup
    const wrappedResolve = (value: string) => {
      clearTimeout(timeout);
      cleanup();
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
      resolve(value);
    };

    const wrappedReject = (reason?: any) => {
      clearTimeout(timeout);
      cleanup();
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
      reject(reason);
    };

    // Handle video loaded metadata
    const handleLoadedMetadata = () => {
      try {
        // Seek to the specified time, or first frame if video is shorter
        const seekTo = Math.min(seekTime, video.duration || seekTime);
        video.currentTime = seekTo;
      } catch (error) {
        wrappedReject(new Error('Failed to seek video'));
      }
    };

    // Handle video seeked (frame ready)
    const handleSeeked = () => {
      try {
        // Get video dimensions
        let { videoWidth, videoHeight } = video;
        
        // Calculate thumbnail dimensions while maintaining aspect ratio
        if (videoWidth > maxWidth || videoHeight > maxHeight) {
          const aspectRatio = videoWidth / videoHeight;
          
          if (videoWidth > videoHeight) {
            videoWidth = maxWidth;
            videoHeight = Math.round(videoWidth / aspectRatio);
          } else {
            videoHeight = maxHeight;
            videoWidth = Math.round(videoHeight * aspectRatio);
          }
        }

        // Set canvas dimensions
        canvas.width = videoWidth;
        canvas.height = videoHeight;

        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

        // Convert to data URL
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        wrappedResolve(dataUrl);
      } catch (error) {
        wrappedReject(new Error('Failed to capture video frame'));
      }
    };

    // Handle errors
    const handleError = (error: Event) => {
      const errorMessage = video.error?.message || 'Failed to load video';
      wrappedReject(new Error(`Video thumbnail error: ${errorMessage}`));
    };

    // Set up event listeners
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);

    // Set video source and start loading
    video.src = videoUrl;
    video.load();
  });
}
