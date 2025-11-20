import { auth } from '@/lib/firebase';

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  url?: string;
  error?: string;
}

// Helper function to get authentication token
const getAuthToken = async (): Promise<string> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return await user.getIdToken();
};

export const uploadFileToFirebase = async (
  file: File,
  userId: string,
  jobId: string,
  orderNumber: string,
  onProgress?: (progress: UploadProgress) => void,
  folderToken?: string,
  folderPath?: string,
  uploadType?: 'client' | 'completed'
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
    formData.append('userId', userId);
    formData.append('jobId', jobId);

    // Only append orderNumber if it's provided (not needed for standalone folders with folderToken)
    if (orderNumber) {
      formData.append('orderNumber', orderNumber);
    }

    // Add folder token and path if provided (for standalone folders)
    if (folderToken) {
      formData.append('folderToken', folderToken);
    }
    if (folderPath) {
      formData.append('folderPath', folderPath);
    }

    // Add uploadType to distinguish between client (for editing) and completed (deliverables)
    if (uploadType) {
      formData.append('uploadType', uploadType);
    }

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

// Order reservation functions
export const reserveOrderNumber = async (userId: string, jobId: string): Promise<{
  orderNumber: string;
  expiresAt: string;
  userId: string;
  jobId: string;
}> => {
  const response = await fetch('/api/orders/reserve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, jobId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to reserve order number: ${response.status}`);
  }

  return response.json();
};

export const getReservation = async (orderNumber: string): Promise<{
  orderNumber: string;
  expiresAt: string;
  userId: string;
  jobId: string;
  status: string;
}> => {
  const response = await fetch(`/api/orders/reservation/${orderNumber}`);

  if (!response.ok) {
    throw new Error(`Failed to get reservation: ${response.status}`);
  }

  return response.json();
};

export const confirmReservation = async (orderNumber: string): Promise<{ success: boolean; orderNumber: string }> => {
  const response = await fetch('/api/orders/confirm-reservation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderNumber }),
  });

  if (!response.ok) {
    throw new Error(`Failed to confirm reservation: ${response.status}`);
  }

  return response.json();
};

export const generateOrderNumber = (): string => {
  // This is deprecated - use reserveOrderNumber instead
  return `#${Date.now().toString().slice(-5)}`;
};

// Upload completed files (for editor deliverables)
export const uploadCompletedFileToFirebase = async (
  file: File,
  jobId: string,
  orderNumber?: string,
  onProgress?: (progress: UploadProgress) => void,
  folderData?: { folderPath: string; editorFolderName: string }
): Promise<{ url: string; path: string }> => {
  try {
    console.log(`Starting completed file upload for ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)...`);
    
    if (onProgress) {
      onProgress({
        fileName: file.name,
        progress: 0,
        status: 'uploading'
      });
    }

    // Create FormData for server upload (editorId now comes from authentication)
    const formData = new FormData();
    formData.append('file', file);
    formData.append('jobId', jobId);
    if (orderNumber) {
      formData.append('orderNumber', orderNumber);
    }
    // Add folder data if provided
    if (folderData) {
      formData.append('folderPath', folderData.folderPath);
      formData.append('editorFolderName', folderData.editorFolderName);
    }

    // Upload via server to separate endpoint for completed files (with authentication)
    const response = await fetch('/api/upload-completed-files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getAuthToken()}`
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log(`Completed file upload successful for ${file.name}: ${result.url}`);
    
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
    console.error('Error uploading completed file:', error);
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