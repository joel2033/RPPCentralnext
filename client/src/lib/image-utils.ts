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
