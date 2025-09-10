import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Upload as UploadIcon, FileImage, Plus } from 'lucide-react';
import { uploadFileToFirebase, UploadProgress } from '@/lib/firebase-storage';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceName: string;
  serviceId: string;
  orderNumber?: string;
  onFilesUpload: (serviceId: string, files: { file: File; url: string; path: string }[]) => void;
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
  orderNumber = '#temp', 
  onFilesUpload 
}: FileUploadModalProps) {
  const [uploadItems, setUploadItems] = useState<FileUploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [urlUpload, setUrlUpload] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isUrlConfirmed, setIsUrlConfirmed] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
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
    const newItems: FileUploadItem[] = files.map(file => ({
      file,
      progress: 0,
      status: 'waiting' as const
    }));
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
    setIsUploading(true);
    const completedUploads: { file: File; url: string; path: string }[] = [];
    
    try {
      for (let i = 0; i < uploadItems.length; i++) {
        const item = uploadItems[i];
        
        setUploadItems(prev => prev.map((uploadItem, index) => 
          index === i ? { ...uploadItem, status: 'uploading' } : uploadItem
        ));

        try {
          const result = await uploadFileToFirebase(
            item.file,
            orderNumber,
            (progress: UploadProgress) => {
              setUploadItems(prev => prev.map((uploadItem, index) => 
                index === i ? { 
                  ...uploadItem, 
                  progress: progress.progress,
                  status: progress.status === 'completed' ? 'completed' : 'uploading',
                  url: progress.url
                } : uploadItem
              ));
            }
          );
          
          completedUploads.push({
            file: item.file,
            url: result.url,
            path: result.path
          });
          
        } catch (error) {
          setUploadItems(prev => prev.map((uploadItem, index) => 
            index === i ? { 
              ...uploadItem, 
              status: 'error',
              error: error instanceof Error ? error.message : 'Upload failed'
            } : uploadItem
          ));
        }
      }
      
      // Call the callback with completed uploads
      if (completedUploads.length > 0) {
        onFilesUpload(serviceId, completedUploads);
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
    onClose();
  };

  const canSubmit = uploadItems.length > 0 && uploadItems.every(item => item.status === 'completed');

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-rpp-grey-dark">
            Upload Files for {serviceName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Include any input files that your supplier may require to carry out this service.
          </p>

          {/* Upload Section Header */}
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Uploading files 0 of {uploadItems.length}</h4>
            <div className="flex space-x-2">
              <input
                type="file"
                multiple
                accept="image/*"
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

          {/* File List */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
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