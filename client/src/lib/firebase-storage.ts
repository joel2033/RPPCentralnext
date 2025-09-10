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
    console.log(`Starting server-side Firebase upload for ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)...`);
    
    if (onProgress) {
      onProgress({
        fileName: file.name,
        progress: 0,
        status: 'uploading'
      });
    }

    // Create FormData for server upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('orderNumber', orderNumber);

    // Upload via server to avoid CORS issues
    const response = await fetch('/api/upload-firebase', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log(`Upload completed for ${file.name}: ${result.url}`);
    
    if (onProgress) {
      onProgress({
        fileName: file.name,
        progress: 100,
        status: 'completed',
        url: result.url
      });
    }

    return {
      url: result.url,
      path: result.path
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
    const response = await fetch('/api/delete-firebase', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath }),
    });
    
    if (!response.ok) {
      throw new Error(`Delete failed: ${response.status}`);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};

export const generateOrderNumber = (): string => {
  // Generate sequential order number - this will be replaced by backend logic
  return `#${Date.now().toString().slice(-5)}`;
};