import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
// Removed unused Checkbox import - folders are now mandatory
import { X, Upload as UploadIcon, FileImage, Plus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { uploadFileToFirebase, uploadCompletedFileToFirebase, UploadProgress, reserveOrderNumber } from '@/lib/firebase-storage';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceName: string;
  serviceId: string;
  userId: string;
  jobId: string;
  onFilesUpload: (serviceId: string, files: { file: File; url: string; path: string }[], orderNumber: string) => void;
  uploadType?: 'client' | 'completed'; // New prop to determine upload type
  orderNumber?: string; // For completed files, we already know the order number
  folderToken?: string; // For standalone folders created via "Add Content"
  folderPath?: string; // The folder path for context
}

interface FileUploadItem {
  file: File;
  progress: number;
  status: 'waiting' | 'uploading' | 'completed' | 'error';
  url?: string;
  path?: string;
  error?: string;
}

export function FileUploadModal({ 
  isOpen, 
  onClose, 
  serviceName, 
  serviceId,
  userId,
  jobId,
  onFilesUpload,
  uploadType = 'client',
  orderNumber: providedOrderNumber,
  folderToken,
  folderPath
}: FileUploadModalProps) {
  const [uploadItems, setUploadItems] = useState<FileUploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [urlUpload, setUrlUpload] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isUrlConfirmed, setIsUrlConfirmed] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(providedOrderNumber || null);
  const [reservationExpiry, setReservationExpiry] = useState<Date | null>(null);
  // Folder functionality - mandatory for completed uploads
  const [useFolder, setUseFolder] = useState(uploadType === 'completed');
  const [folderName, setFolderName] = useState('');

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/') || 
      file.name.toLowerCase().endsWith('.dng') ||
      file.type === 'image/x-adobe-dng'
    );
    addFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const addFiles = (files: File[]) => {
    const newItems: FileUploadItem[] = files.map(file => {
      console.log(`File ${file.name}: size ${(file.size / 1024 / 1024).toFixed(2)}MB, type: ${file.type}`);
      
      // Check file size (warn if over 50MB)
      if (file.size > 50 * 1024 * 1024) {
        console.warn(`Large file detected: ${file.name} is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      }
      
      return {
        file,
        progress: 0,
        status: 'waiting' as const
      };
    });
    setUploadItems(prev => [...prev, ...newItems]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addFiles(files);
    }
  };

  const removeFile = (index: number) => {
    setUploadItems(prev => prev.filter((_, i) => i !== index));
  };

  const startUpload = async () => {
    console.log('[DEBUG] FileUploadModal starting upload with props:', { jobId, uploadType, orderNumber: providedOrderNumber });
    setIsUploading(true);
    const completedUploads: { file: File; url: string; path: string }[] = [];
    
    try {
      // Reserve order number first if not already reserved (only for client uploads)
      let currentOrderNumber = orderNumber;
      if (uploadType === 'client' && !currentOrderNumber) {
        const reservation = await reserveOrderNumber(userId, jobId);
        currentOrderNumber = reservation.orderNumber;
        setOrderNumber(reservation.orderNumber);
        setReservationExpiry(new Date(reservation.expiresAt));
        console.log(`Reserved order number ${reservation.orderNumber} until ${reservation.expiresAt}`);
      }

      // Check if we have a valid order number (only required for client uploads)
      if (uploadType === 'client' && !currentOrderNumber) {
        throw new Error('Failed to reserve order number');
      }
      
      // For completed uploads, order number is optional - server will find assigned order automatically
      if (uploadType === 'completed') {
        console.log(`[DEBUG] Completed upload - using order number: ${currentOrderNumber || 'auto-detect'}`);
      }
      
      for (let i = 0; i < uploadItems.length; i++) {
        const item = uploadItems[i];
        
        setUploadItems(prev => prev.map((uploadItem, index) => 
          index === i ? { ...uploadItem, status: 'uploading' } : uploadItem
        ));

        try {
          console.log(`Starting Firebase upload for ${item.file.name} (${(item.file.size / 1024 / 1024).toFixed(2)}MB)...`);
          
          // Add a timeout wrapper and choose upload function based on type
          const uploadPromise = uploadType === 'completed' 
            ? uploadCompletedFileToFirebase(
                item.file,
                jobId,
                currentOrderNumber,
                (progress: UploadProgress) => {
                  console.log(`Progress for ${item.file.name}:`, progress);
                  setUploadItems(prev => prev.map((uploadItem, index) => 
                    index === i ? { 
                      ...uploadItem, 
                      progress: progress.progress,
                      status: progress.status === 'completed' ? 'completed' : 'uploading',
                      url: progress.url
                    } : uploadItem
                  ));
                },
                // Pass folder data if folder is being used
                useFolder && folderName ? {
                  folderPath: folderName,
                  editorFolderName: folderName
                } : undefined
              )
            : uploadFileToFirebase(
                item.file,
                userId,
                jobId,
                currentOrderNumber,
                (progress: UploadProgress) => {
                  console.log(`Progress for ${item.file.name}:`, progress);
                  setUploadItems(prev => prev.map((uploadItem, index) => 
                    index === i ? { 
                      ...uploadItem, 
                      progress: progress.progress,
                      status: progress.status === 'completed' ? 'completed' : 'uploading',
                      url: progress.url
                    } : uploadItem
                  ));
                },
                folderToken, // Pass folder token for standalone folders
                folderPath // Pass folder path
              );
          
          // Set timeout for large files (5 minutes for files over 10MB)
          const timeoutMs = item.file.size > 10 * 1024 * 1024 ? 300000 : 120000;
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Upload timeout after ${timeoutMs/1000}s`)), timeoutMs)
          );
          
          const result = await Promise.race([uploadPromise, timeoutPromise]) as { url: string; path: string };
          console.log(`Upload completed for ${item.file.name}:`, result);
          
          completedUploads.push({
            file: item.file,
            url: result.url,
            path: result.path
          });
          
        } catch (error) {
          console.error(`Upload failed for ${item.file.name} (${(item.file.size / 1024 / 1024).toFixed(2)}MB):`, error);
          
          let errorMessage = 'Upload failed';
          if (error instanceof Error) {
            if (error.message.includes('retry-limit-exceeded')) {
              errorMessage = `Upload timeout - file too large (${(item.file.size / 1024 / 1024).toFixed(2)}MB)`;
            } else if (error.message.includes('timeout')) {
              errorMessage = `Upload timeout after ${(item.file.size / 1024 / 1024).toFixed(2)}MB`;
            } else {
              errorMessage = error.message;
            }
          }
          
          setUploadItems(prev => prev.map((uploadItem, index) => 
            index === i ? { 
              ...uploadItem, 
              status: 'error',
              error: errorMessage
            } : uploadItem
          ));
        }
      }
      
      // Call the callback with completed uploads
      if (completedUploads.length > 0 && currentOrderNumber) {
        onFilesUpload(serviceId, completedUploads, currentOrderNumber);
      }
      
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddUrl = () => {
    if (urlUpload && isUrlConfirmed) {
      // Handle URL uploads - for now just show it's added
      // In a real implementation, you'd download and upload the file
      setUrlUpload('');
      setIsUrlConfirmed(false);
    }
  };

  const handleClose = () => {
    setUploadItems([]);
    setUrlUpload('');
    setIsUrlConfirmed(false);
    setIsUploading(false);
    setOrderNumber(null);
    setReservationExpiry(null);
    onClose();
  };

  const canSubmit = uploadItems.length > 0 && uploadItems.every(item => item.status === 'completed') && 
    (uploadType !== 'completed' || (useFolder && folderName.trim().length > 0));

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-rpp-grey-dark">
            {uploadType === 'completed' ? `Upload Completed Files for ${serviceName}` : `Upload Files for ${serviceName}`}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {uploadType === 'completed' 
              ? 'Upload your completed edited files ready for client delivery.'
              : 'Include any input files that your supplier may require to carry out this service.'
            }
          </p>

          {/* Folder Options - Mandatory for completed uploads */}
          {uploadType === 'completed' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="space-y-2">
                <label htmlFor="folder-name" className="text-sm font-medium text-blue-900">
                  Folder Name *
                </label>
                <Input
                  id="folder-name"
                  placeholder="Enter folder name (e.g., 'High Resolution', 'Web Ready')"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="text-sm"
                  data-testid="input-folder-name"
                  required
                />
                <p className="text-xs text-blue-700">
                  All files must be organized in a folder for proper client delivery
                </p>
              </div>
            </div>
          )}

          {/* Upload Section Header */}
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Uploading files 0 of {uploadItems.length}</h4>
            <div className="flex space-x-2">
              <input
                type="file"
                multiple
                accept="image/*,.dng,.DNG"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload-modal"
              />
              <label htmlFor="file-upload-modal">
                <Button variant="outline" size="sm" asChild>
                  <span><Plus className="w-4 h-4 mr-1" />Add</span>
                </Button>
              </label>
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </div>

          {/* Drag and Drop Box */}
          {uploadItems.length === 0 && (
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver 
                  ? 'border-rpp-red-main bg-red-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              data-testid="drag-drop-area"
            >
              <UploadIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-2">
                Drag and drop files here
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Supports images and DNG files
              </p>
              <label htmlFor="file-upload-modal">
                <Button variant="outline" asChild>
                  <span>Browse Files</span>
                </Button>
              </label>
            </div>
          )}

          {/* File List */}
          <div className={`space-y-2 max-h-48 overflow-y-auto ${
            uploadItems.length === 0 ? 'hidden' : ''
          }`}>
            {uploadItems.map((item, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{item.file.name}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">
                        {item.status === 'completed' ? '100%' : `${Math.round(item.progress)}%`}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <Progress 
                    value={item.status === 'completed' ? 100 : item.progress} 
                    className="h-2"
                  />
                  {item.status === 'error' && (
                    <p className="text-xs text-red-500 mt-1">{item.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 14 Day Notice */}
          <p className="text-xs text-gray-500">
            Files uploaded will be automatically removed after 14 days.
          </p>

          {/* OR Divider */}
          <div className="flex items-center my-4">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="px-4 text-sm text-gray-500">OR</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          {/* URL Upload Section */}
          <div>
            <h4 className="text-sm font-medium mb-3">URL Upload</h4>
            <div className="space-y-3">
              <Input
                placeholder="Paste your URL here"
                value={urlUpload}
                onChange={(e) => setUrlUpload(e.target.value)}
                className="text-sm"
              />
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="url-confirm"
                  checked={isUrlConfirmed}
                  onCheckedChange={(checked) => setIsUrlConfirmed(checked as boolean)}
                />
                <label htmlFor="url-confirm" className="text-xs text-gray-600 leading-tight">
                  I confirm the link I am providing has been set to viewable and contains the input files required for this service.
                </label>
              </div>
              <Button
                onClick={handleAddUrl}
                disabled={!urlUpload || !isUrlConfirmed}
                variant="outline"
                size="sm"
              >
                Add
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          {uploadItems.length > 0 && (
            <div className="flex justify-center pt-4">
              {!isUploading && uploadItems.some(item => item.status === 'waiting') && (
                <Button
                  onClick={startUpload}
                  className="bg-rpp-red-main hover:bg-rpp-red-dark text-white"
                  disabled={uploadItems.length === 0}
                >
                  Start Upload
                </Button>
              )}
              {canSubmit && (
                <Button
                  onClick={handleClose}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Upload Complete
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}