import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Upload as UploadIcon, FileImage } from 'lucide-react';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceName: string;
  serviceId: string;
  onFilesUpload: (serviceId: string, files: File[]) => void;
}

export function FileUploadModal({ 
  isOpen, 
  onClose, 
  serviceName, 
  serviceId, 
  onFilesUpload 
}: FileUploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      onFilesUpload(serviceId, selectedFiles);
      setSelectedFiles([]);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-rpp-grey-dark">
            Upload Files for {serviceName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver 
                ? 'border-rpp-red-main bg-red-50' 
                : 'border-rpp-grey-border hover:border-rpp-red-main'
            }`}
          >
            <UploadIcon className="w-12 h-12 text-rpp-grey-light mx-auto mb-4" />
            <p className="text-rpp-grey-dark font-medium mb-2">
              Drag and drop your files here, or click to browse
            </p>
            <p className="text-sm text-rpp-grey-light mb-4">
              Supported formats: JPG, PNG, RAW, TIFF (Max 100MB per file)
            </p>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload-modal"
            />
            <label htmlFor="file-upload-modal">
              <Button variant="outline" className="border-rpp-grey-border" asChild>
                <span>Choose Files</span>
              </Button>
            </label>
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div>
              <h4 className="font-medium text-rpp-grey-dark mb-3">
                Selected Files ({selectedFiles.length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border border-rpp-grey-border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <FileImage className="w-5 h-5 text-rpp-grey-light" />
                      <div>
                        <p className="text-sm font-medium text-rpp-grey-dark">{file.name}</p>
                        <p className="text-xs text-rpp-grey-light">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-rpp-grey-light hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={handleClose}
              className="border-rpp-grey-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0}
              className="bg-rpp-red-main hover:bg-rpp-red-dark text-white"
            >
              Upload {selectedFiles.length} {selectedFiles.length === 1 ? 'File' : 'Files'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}