import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Eye, FileImage, File, Calendar, User, Plus, Edit, FolderPlus, Folder } from "lucide-react";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CompletedFile {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  downloadUrl: string;
  uploadedAt: string;
  notes?: string;
  folderPath?: string;
  editorFolderName?: string;
  partnerFolderName?: string;
}

interface CompletedFilesGroup {
  orderId: string;
  orderNumber: string;
  files: CompletedFile[];
}

interface FolderData {
  folderPath: string;
  editorFolderName: string;
  partnerFolderName?: string;
  orderNumber?: string;
  fileCount: number;
  files: CompletedFile[];
}

interface FileGalleryProps {
  completedFiles: CompletedFilesGroup[];
  jobId: string;
  isLoading?: boolean;
}

export default function FileGallery({ completedFiles, jobId, isLoading }: FileGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string>('');
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<FolderData | null>(null);
  const [viewMode, setViewMode] = useState<'folders' | 'orders'>('folders');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch folders for this job
  const { data: foldersData, isLoading: isFoldersLoading } = useQuery<FolderData[]>({
    queryKey: ['/api/jobs', jobId, 'folders'],
    enabled: !!jobId,
  });

  // Mutation for creating folders
  const createFolderMutation = useMutation({
    mutationFn: async ({ partnerFolderName }: { partnerFolderName: string }) => {
      return apiRequest(`/api/jobs/${jobId}/folders`, 'POST', { partnerFolderName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'folders'] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/completed-files`] });
      toast({
        title: "Folder created successfully",
        description: "The folder is ready for file uploads.",
      });
      setShowCreateFolderModal(false);
      setNewFolderName('');
    },
    onError: (error) => {
      toast({
        title: "Failed to create folder",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation for renaming folders
  const renameFolderMutation = useMutation({
    mutationFn: async ({ folderPath, newPartnerFolderName }: { folderPath: string; newPartnerFolderName: string }) => {
      return apiRequest(`/api/jobs/${jobId}/folders/rename`, 'PATCH', { folderPath, newPartnerFolderName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'folders'] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/completed-files`] });
      toast({
        title: "Folder renamed successfully",
        description: "The folder name has been updated.",
      });
      setShowRenameFolderModal(false);
      setSelectedFolder(null);
      setNewFolderName('');
    },
    onError: (error) => {
      toast({
        title: "Failed to rename folder",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

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

  // Helper functions
  const handleCreateFolder = () => {
    setShowCreateFolderModal(true);
  };

  const handleRenameFolder = (folder: FolderData) => {
    setSelectedFolder(folder);
    setNewFolderName(folder.partnerFolderName || folder.editorFolderName);
    setShowRenameFolderModal(true);
  };

  const organizeFoldersByType = () => {
    if (!foldersData) return { Photos: [], 'Floor Plans': [], Videos: [], 'Virtual Tours': [], Other: [] };
    
    const organized = {
      Photos: [] as FolderData[],
      'Floor Plans': [] as FolderData[],
      Videos: [] as FolderData[],
      'Virtual Tours': [] as FolderData[],
      Other: [] as FolderData[]
    };

    foldersData.forEach(folder => {
      const folderName = folder.partnerFolderName || folder.editorFolderName;
      if (folderName.toLowerCase().includes('photo') || folderName.toLowerCase().includes('image')) {
        organized.Photos.push(folder);
      } else if (folderName.toLowerCase().includes('floor') || folderName.toLowerCase().includes('plan')) {
        organized['Floor Plans'].push(folder);
      } else if (folderName.toLowerCase().includes('video')) {
        organized.Videos.push(folder);
      } else if (folderName.toLowerCase().includes('virtual') || folderName.toLowerCase().includes('tour')) {
        organized['Virtual Tours'].push(folder);
      } else {
        organized.Other.push(folder);
      }
    });

    return organized;
  };

  if (!completedFiles || (completedFiles.length === 0 && (!foldersData || foldersData.length === 0))) {
    return (
      <div className="text-center py-12">
        <FileImage className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No completed files yet</h3>
        <p className="text-gray-500 mb-6">
          Completed files from editors will appear here once uploaded.
        </p>
        <Button 
          onClick={handleCreateFolder} 
          className="mb-4"
          data-testid="button-add-folder-empty"
        >
          <FolderPlus className="h-4 w-4 mr-2" />
          Create First Folder
        </Button>
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

  const renderFileCard = (file: CompletedFile) => (
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
  );

  const organizedFolders = organizeFoldersByType();

  return (
    <div className="space-y-6">
      {/* Header with view toggle and add folder button */}
      <div className="flex items-center justify-between">
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'folders' | 'orders')}>
          <TabsList>
            <TabsTrigger value="folders" data-testid="tab-folders">
              <Folder className="h-4 w-4 mr-2" />
              Folders
            </TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-orders">
              <FileImage className="h-4 w-4 mr-2" />
              By Order
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <Button 
          onClick={handleCreateFolder}
          variant="outline"
          size="sm"
          data-testid="button-add-folder"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Folder
        </Button>
      </div>

      {viewMode === 'folders' ? (
        <Tabs defaultValue="Photos" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="Photos">Photos</TabsTrigger>
            <TabsTrigger value="Floor Plans">Floor Plans</TabsTrigger>
            <TabsTrigger value="Videos">Videos</TabsTrigger>
            <TabsTrigger value="Virtual Tours">Virtual Tours</TabsTrigger>
            <TabsTrigger value="Other">Other</TabsTrigger>
          </TabsList>
          
          {Object.entries(organizedFolders).map(([category, folders]) => (
            <TabsContent key={category} value={category} className="mt-6">
              {folders.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <Folder className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-500 text-sm">No {category.toLowerCase()} folders yet</p>
                  <Button 
                    onClick={handleCreateFolder} 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    data-testid={`button-add-${category.toLowerCase().replace(' ', '-')}-folder`}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add {category} Folder
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {folders.map((folder) => (
                    <div key={folder.folderPath} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Folder className="h-5 w-5 text-blue-600" />
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">
                              {folder.partnerFolderName || folder.editorFolderName}
                              {folder.orderNumber && (
                                <span className="ml-2 text-sm font-normal text-blue-600">
                                  - Order {folder.orderNumber}
                                </span>
                              )}
                            </h3>
                            {folder.partnerFolderName && folder.editorFolderName !== folder.partnerFolderName && (
                              <p className="text-sm text-gray-500">
                                Originally: {folder.editorFolderName}
                              </p>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {folder.fileCount} {folder.fileCount === 1 ? 'file' : 'files'}
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRenameFolder(folder)}
                          data-testid={`button-rename-folder-${folder.folderPath}`}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Rename
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {folder.files.map(renderFileCard)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
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
                {group.files.map(renderFileCard)}
              </div>
            </div>
          ))}
        </div>
      )}

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

      {/* Create Folder Modal */}
      <Dialog open={showCreateFolderModal} onOpenChange={setShowCreateFolderModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-folder-name">Folder Name</Label>
              <Input
                id="new-folder-name"
                placeholder="Enter folder name (e.g., 'High Resolution Photos', 'Web Ready Images')"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                data-testid="input-new-folder-name"
              />
              <p className="text-sm text-gray-600">
                This will create a new folder for organizing uploaded files.
              </p>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowCreateFolderModal(false);
                setNewFolderName('');
              }}
              data-testid="button-cancel-create-folder"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (newFolderName.trim()) {
                  createFolderMutation.mutate({
                    partnerFolderName: newFolderName.trim(),
                  });
                }
              }}
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
              data-testid="button-confirm-create-folder"
            >
              {createFolderMutation.isPending ? (
                <>Creating...</>
              ) : (
                <>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Create Folder
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Modal */}
      <Dialog open={showRenameFolderModal} onOpenChange={setShowRenameFolderModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-folder-name">New Folder Name</Label>
              <Input
                id="rename-folder-name"
                placeholder="Enter new folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                data-testid="input-rename-folder-name"
              />
              {selectedFolder && (
                <p className="text-sm text-gray-600">
                  Currently: {selectedFolder.partnerFolderName || selectedFolder.editorFolderName}
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowRenameFolderModal(false);
                setSelectedFolder(null);
                setNewFolderName('');
              }}
              data-testid="button-cancel-rename-folder"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedFolder && newFolderName.trim()) {
                  renameFolderMutation.mutate({
                    folderPath: selectedFolder.folderPath,
                    newPartnerFolderName: newFolderName.trim(),
                  });
                }
              }}
              disabled={!newFolderName.trim() || renameFolderMutation.isPending}
              data-testid="button-confirm-rename-folder"
            >
              {renameFolderMutation.isPending ? (
                <>Renaming...</>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Rename Folder
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}