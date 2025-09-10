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
    
    if (onProgress) {
      onProgress({
        fileName: file.name,
        progress: 0,
        status: 'uploading'
      });
    }

    // Create FormData for file upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', filePath);

    // Upload to Replit Object Storage
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
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
    const response = await fetch('/api/upload', {
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