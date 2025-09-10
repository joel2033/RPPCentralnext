import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  url?: string;
  error?: string;
}

export const uploadFileToFirebase = async (
  file: File,
  orderNumber: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ url: string; path: string }> => {
  try {
    // Create unique file path: orders/{orderNumber}/{timestamp}_{filename}
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const sanitizedOrderNumber = orderNumber.replace(/[^a-zA-Z0-9-]/g, '');
    const filePath = `orders/${sanitizedOrderNumber}/${timestamp}_${sanitizedFileName}`;
    
    const storageRef = ref(storage, filePath);
    
    console.log(`Starting Firebase upload for ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)...`);
    
    if (onProgress) {
      onProgress({
        fileName: file.name,
        progress: 0,
        status: 'uploading'
      });
    }

    // Use uploadBytesResumable for progress tracking
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        (snapshot) => {
          // Progress tracking
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Progress for ${file.name}:`, {
            fileName: file.name,
            progress: Math.round(progress),
            status: 'uploading' as const
          });
          
          if (onProgress) {
            onProgress({
              fileName: file.name,
              progress: Math.round(progress),
              status: 'uploading'
            });
          }
        },
        (error) => {
          // Handle upload error
          console.error(`Upload failed for ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB):`, error);
          if (onProgress) {
            onProgress({
              fileName: file.name,
              progress: 0,
              status: 'error',
              error: error.message
            });
          }
          reject(error);
        },
        async () => {
          // Upload completed successfully
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log(`Upload completed for ${file.name}: ${downloadURL}`);
            
            if (onProgress) {
              onProgress({
                fileName: file.name,
                progress: 100,
                status: 'completed',
                url: downloadURL
              });
            }
            
            resolve({
              url: downloadURL,
              path: filePath
            });
          } catch (urlError) {
            console.error('Error getting download URL:', urlError);
            reject(urlError);
          }
        }
      );
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    if (onProgress) {
      onProgress({
        fileName: file.name,
        progress: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Upload failed'
      });
    }
    throw error;
  }
};

export const deleteFileFromFirebase = async (filePath: string): Promise<void> => {
  try {
    const storageRef = ref(storage, filePath);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};

export const generateOrderNumber = (): string => {
  // Generate sequential order number - this will be replaced by backend logic
  return `#${Date.now().toString().slice(-5)}`;
};