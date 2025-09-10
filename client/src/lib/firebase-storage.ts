import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
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
    const filePath = `orders/${orderNumber}/${timestamp}_${sanitizedFileName}`;
    
    const storageRef = ref(storage, filePath);
    
    if (onProgress) {
      onProgress({
        fileName: file.name,
        progress: 0,
        status: 'uploading'
      });
    }

    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    if (onProgress) {
      onProgress({
        fileName: file.name,
        progress: 100,
        status: 'completed',
        url: downloadURL
      });
    }

    return {
      url: downloadURL,
      path: filePath
    };
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