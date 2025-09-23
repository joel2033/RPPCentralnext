import React, { useState } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Eye, FileImage, File, Calendar, User } from "lucide-react";
import { format } from "date-fns";

interface CompletedFile {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  downloadUrl: string;
  uploadedAt: string;
  notes?: string;
}

interface CompletedFilesGroup {
  orderId: string;
  orderNumber: string;
  files: CompletedFile[];
}

interface FileGalleryProps {
  completedFiles: CompletedFilesGroup[];
  isLoading?: boolean;
}

export default function FileGallery({ completedFiles, isLoading }: FileGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string>('');

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!completedFiles || completedFiles.length === 0) {
    return (
      <div className="text-center py-12">
        <FileImage className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No completed files yet</h3>
        <p className="text-gray-500">
          Completed files from editors will appear here once uploaded.
        </p>
      </div>
    );
  }

  const isImage = (mimeType: string) => {
    return mimeType.startsWith('image/');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleImageClick = (url: string, name: string) => {
    setSelectedImage(url);
    setSelectedImageName(name);
  };

  const handleDownload = (url: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
  };

  return (
    <div className="space-y-8">
      {completedFiles.map((group) => (
        <div key={group.orderId} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-medium text-gray-900">
                Order {group.orderNumber}
              </h3>
              <Badge variant="secondary" className="text-xs">
                {group.files.length} {group.files.length === 1 ? 'file' : 'files'}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {group.files.map((file) => (
              <Card 
                key={file.id} 
                className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
              >
                <CardContent className="p-0">
                  {isImage(file.mimeType) ? (
                    <div 
                      className="relative aspect-square"
                      onClick={() => handleImageClick(file.downloadUrl, file.originalName)}
                    >
                      <img
                        src={file.downloadUrl}
                        alt={file.originalName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center">
                        <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-square bg-gray-100 flex items-center justify-center">
                      <File className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  
                  <div className="p-3 space-y-2">
                    <h4 
                      className="text-sm font-medium text-gray-900 truncate" 
                      title={file.originalName}
                    >
                      {file.originalName}
                    </h4>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{formatFileSize(file.fileSize)}</span>
                      <span>{format(new Date(file.uploadedAt), 'MMM d')}</span>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isImage(file.mimeType)) {
                            handleImageClick(file.downloadUrl, file.originalName);
                          }
                        }}
                        data-testid={`button-view-${file.id}`}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(file.downloadUrl, file.originalName);
                        }}
                        data-testid={`button-download-${file.id}`}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    </div>

                    {file.notes && (
                      <p className="text-xs text-gray-500 italic truncate" title={file.notes}>
                        {file.notes}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] p-0">
          <div className="relative">
            <img
              src={selectedImage || ''}
              alt={selectedImageName}
              className="w-full h-auto max-h-[85vh] object-contain"
            />
            <div className="absolute top-4 right-4 flex space-x-2">
              <Button
                size="sm"
                onClick={() => selectedImage && handleDownload(selectedImage, selectedImageName)}
                className="bg-black/50 hover:bg-black/70 text-white"
                data-testid="button-modal-download"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
            <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded text-sm">
              {selectedImageName}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}