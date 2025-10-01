import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Eye, FileImage, File, Calendar, User, Plus, Edit, FolderPlus, Folder, Video, FileText, Image as ImageIcon, Map, Play, MoreVertical, Upload, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FileUploadModal } from "@/components/FileUploadModal";
import { useAuth } from "@/contexts/AuthContext";

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
  // Debug logging to see what data is being passed to FileGallery
  console.log('[FileGallery] Received data:', {
    completedFiles,
    jobId,
    isLoading,
    completedFilesLength: completedFiles?.length,
    totalFiles: completedFiles?.reduce((acc, group) => acc + group.files.length, 0)
  });

  // Early return for loading state - must be before any hooks
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

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string>('');
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<FolderData | null>(null);
  const [viewMode, setViewMode] = useState<'folders' | 'orders'>('folders');
  const [parentFolderPath, setParentFolderPath] = useState<string | null>(null);
  const [currentFolderPath, setCurrentFolderPath] = useState<string | null>(null);
  const [showFolderContent, setShowFolderContent] = useState(false);
  const [selectedFolderData, setSelectedFolderData] = useState<FolderData | null>(null);
  // Partner upload functionality
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedUploadFolder, setSelectedUploadFolder] = useState<string>('');
  // Folder visibility state
  const [folderVisibility, setFolderVisibility] = useState<Record<string, boolean>>({});
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userData: user } = useAuth();

  // Fetch folders for this job
  const { data: foldersData, isLoading: isFoldersLoading } = useQuery<FolderData[]>({
    queryKey: ['/api/jobs', jobId, 'folders'],
    enabled: !!jobId,
  });

  // Mutation for creating folders
  const createFolderMutation = useMutation({
    mutationFn: async ({ partnerFolderName }: { partnerFolderName: string }) => {
      const folderPath = parentFolderPath ? `${parentFolderPath}/${partnerFolderName}` : partnerFolderName;
      return apiRequest(`/api/jobs/${jobId}/folders`, 'POST', { partnerFolderName: folderPath });
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
      setParentFolderPath(null);
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

  // Mutation for deleting folders
  const deleteFolderMutation = useMutation({
    mutationFn: async ({ folderPath }: { folderPath: string }) => {
      return apiRequest(`/api/jobs/${jobId}/folders`, 'DELETE', { folderPath });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'folders'] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/completed-files`] });
      toast({
        title: "Folder deleted successfully",
        description: "The folder and its contents have been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete folder",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation for updating folder visibility
  const updateFolderVisibilityMutation = useMutation({
    mutationFn: async ({ folderPath, isVisible }: { folderPath: string; isVisible: boolean }) => {
      return apiRequest(`/api/jobs/${jobId}/folders/visibility`, 'PATCH', { folderPath, isVisible });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'folders'] });
      toast({
        title: "Folder visibility updated",
        description: "The folder visibility has been changed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update folder visibility",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Helper functions
  const handleCreateFolder = (parentPath?: string) => {
    setParentFolderPath(parentPath || null);
    setNewFolderName('');
    setShowCreateFolderModal(true);
  };

  const handleEnterFolder = (folderPath: string) => {
    const folder = foldersData?.find(f => f.folderPath === folderPath);
    if (folder) {
      setSelectedFolderData(folder);
      setShowFolderContent(true);
    } else {
      setCurrentFolderPath(folderPath);
    }
  };

  const handleBackToParent = () => {
    if (showFolderContent) {
      setShowFolderContent(false);
      setSelectedFolderData(null);
    } else if (currentFolderPath) {
      const parentPath = currentFolderPath.split('/').slice(0, -1).join('/');
      setCurrentFolderPath(parentPath || null);
    }
  };

  const getBreadcrumbs = () => {
    if (showFolderContent && selectedFolderData) {
      return ['All Folders', selectedFolderData.partnerFolderName || selectedFolderData.editorFolderName];
    }
    if (!currentFolderPath) return ['All Folders'];
    return ['All Folders', ...currentFolderPath.split('/')];
  };

  const getFoldersToShow = () => {
    if (!Array.isArray(foldersData)) return [];
    
    if (!currentFolderPath) {
      // Show root level folders only
      return foldersData.filter(folder => !folder.folderPath.includes('/'));
    } else {
      // Show subfolders of current path
      return foldersData.filter(folder => 
        folder.folderPath.startsWith(currentFolderPath + '/') &&
        folder.folderPath.split('/').length === currentFolderPath.split('/').length + 1
      );
    }
  };

  const handleRenameFolder = (folder: FolderData) => {
    setSelectedFolder(folder);
    setNewFolderName(folder.partnerFolderName || folder.editorFolderName);
    setShowRenameFolderModal(true);
  };

  const handleDeleteFolder = (folderPath: string, folderName: string) => {
    if (confirm(`Are you sure you want to delete the folder "${folderName}"? This will permanently remove all files in this folder.`)) {
      deleteFolderMutation.mutate({ folderPath });
    }
  };

  const organizeFoldersByType = () => {
    if (!foldersData || !Array.isArray(foldersData)) return { Photos: [], 'Floor Plans': [], Videos: [], 'Virtual Tours': [], Other: [] };
    
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

  if (!completedFiles || (completedFiles.length === 0 && (!foldersData || !Array.isArray(foldersData) || foldersData.length === 0))) {
    return (
      <div className="text-center py-12">
        <FileImage className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No completed files yet</h3>
        <p className="text-gray-500 mb-6">
          Completed files from editors will appear here once uploaded.
        </p>
        <Button 
          onClick={() => handleCreateFolder()} 
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

  const isVideo = (mimeType: string) => {
    return mimeType.startsWith('video/');
  };

  const getFileTypeIcon = (mimeType: string, size = 12) => {
    if (isImage(mimeType)) return <ImageIcon className={`h-${size/4} w-${size/4} text-blue-500`} />;
    if (isVideo(mimeType)) return <Video className={`h-${size/4} w-${size/4} text-purple-500`} />;
    if (mimeType.includes('pdf')) return <FileText className={`h-${size/4} w-${size/4} text-red-500`} />;
    if (mimeType.includes('floor') || mimeType.includes('plan')) return <Map className={`h-${size/4} w-${size/4} text-green-500`} />;
    return <File className={`h-${size/4} w-${size/4} text-gray-500`} />;
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

  const renderFileCard = (file: CompletedFile) => {
    console.log('[FileGallery] Rendering file card for:', file.fileName, 'URL:', file.downloadUrl);
    return (
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
        ) : isVideo(file.mimeType) ? (
          <div 
            className="relative aspect-square bg-gray-900"
            onClick={() => window.open(file.downloadUrl, '_blank')}
          >
            <video
              src={file.downloadUrl}
              className="w-full h-full object-cover"
              muted
              preload="metadata"
            />
            <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
              <Play className="h-12 w-12 text-white drop-shadow-lg" />
            </div>
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="text-xs">
                <Video className="h-3 w-3 mr-1" />
                Video
              </Badge>
            </div>
          </div>
        ) : (
          <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center space-y-2">
            {getFileTypeIcon(file.mimeType, 48)}
            <span className="text-xs text-gray-500 font-medium">
              {file.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
            </span>
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
  };

  const organizedFolders = organizeFoldersByType();
  const foldersToShow = getFoldersToShow();

  // Initialize folder visibility state
  React.useEffect(() => {
    if (foldersData && Array.isArray(foldersData)) {
      const initialVisibility: Record<string, boolean> = {};
      foldersData.forEach(folder => {
        // Default to visible (true) for all folders
        initialVisibility[folder.folderPath] = true;
      });
      setFolderVisibility(initialVisibility);
    }
  }, [foldersData]);

  const handleToggleVisibility = (folderPath: string, currentVisibility: boolean) => {
    const newVisibility = !currentVisibility;
    setFolderVisibility(prev => ({ ...prev, [folderPath]: newVisibility }));
    updateFolderVisibilityMutation.mutate({ folderPath, isVisible: newVisibility });
  };

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
        
        <div className="flex space-x-2">
          <Button 
            onClick={() => handleCreateFolder(currentFolderPath || undefined)}
            variant="outline"
            size="sm"
            data-testid="button-add-folder"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Content
          </Button>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      {viewMode === 'folders' && (
        <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
          {getBreadcrumbs().map((crumb, index) => (
            <div key={index} className="flex items-center space-x-2">
              {index === 0 ? (
                <button
                  onClick={() => {
                    setCurrentFolderPath(null);
                    setShowFolderContent(false);
                    setSelectedFolderData(null);
                  }}
                  className="flex items-center space-x-1 hover:text-blue-600 transition-colors"
                  data-testid="breadcrumb-root"
                >
                  <Folder className="h-4 w-4" />
                  <span>{crumb}</span>
                </button>
              ) : (
                <>
                  <span className="text-gray-400">/</span>
                  <button
                    onClick={() => {
                      if (showFolderContent && index === getBreadcrumbs().length - 1) {
                        // Already at the folder content, do nothing
                        return;
                      } else if (showFolderContent) {
                        // Go back to folder list
                        setShowFolderContent(false);
                        setSelectedFolderData(null);
                      } else {
                        const path = getBreadcrumbs().slice(1, index + 1).join('/');
                        setCurrentFolderPath(path);
                      }
                    }}
                    className="hover:text-blue-600 transition-colors font-medium"
                    data-testid={`breadcrumb-${index}`}
                  >
                    {crumb}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {viewMode === 'folders' ? (
        showFolderContent && selectedFolderData ? (
          // Folder Content View
          <div className="space-y-6">
            {/* Folder Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Folder className="h-6 w-6 text-blue-600" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedFolderData.partnerFolderName || selectedFolderData.editorFolderName}
                  </h2>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>{selectedFolderData.fileCount} {selectedFolderData.fileCount === 1 ? 'file' : 'files'}</span>
                    {selectedFolderData.orderNumber && (
                      <Badge variant="outline" className="text-xs">
                        {selectedFolderData.orderNumber}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button 
                  onClick={() => setShowUploadModal(true)}
                  className="bg-rpp-red-main hover:bg-rpp-red-dark text-white"
                  size="sm"
                  data-testid="button-upload-to-folder"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
                <Button 
                  onClick={() => handleCreateFolder(selectedFolderData.folderPath)}
                  variant="outline"
                  size="sm"
                  data-testid="button-create-subfolder"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Subfolder
                </Button>
              </div>
            </div>

            {/* Subfolders Section */}
            {foldersData && foldersData.some(f => f.folderPath.startsWith(selectedFolderData.folderPath + '/')) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">Folders</h3>
                  <span className="text-xs text-gray-500">
                    {foldersData.filter(f => f.folderPath.startsWith(selectedFolderData.folderPath + '/')).length} folders
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {foldersData
                    .filter(f => f.folderPath.startsWith(selectedFolderData.folderPath + '/') && 
                                f.folderPath.split('/').length === selectedFolderData.folderPath.split('/').length + 1)
                    .map((subfolder) => (
                      <div
                        key={subfolder.folderPath}
                        className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border hover:bg-blue-100 transition-colors group"
                      >
                        <Folder className="h-5 w-5 text-blue-600" />
                        <div 
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => handleEnterFolder(subfolder.folderPath)}
                        >
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {subfolder.partnerFolderName?.split('/').pop() || subfolder.editorFolderName.split('/').pop()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {subfolder.fileCount} {subfolder.fileCount === 1 ? 'file' : 'files'}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(
                              subfolder.folderPath,
                              subfolder.partnerFolderName?.split('/').pop() || subfolder.editorFolderName.split('/').pop() || 'Unnamed Folder'
                            );
                          }}
                          data-testid={`button-delete-subfolder-${subfolder.folderPath}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  <Button
                    variant="outline"
                    className="h-full min-h-[70px] border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                    onClick={() => handleCreateFolder(selectedFolderData.folderPath)}
                  >
                    <div className="text-center">
                      <Plus className="h-5 w-5 mx-auto mb-1 text-gray-400" />
                      <span className="text-xs text-gray-500">New Folder</span>
                    </div>
                  </Button>
                </div>
              </div>
            )}

            {/* Files Section */}
            {(() => {
              const visibleFiles = selectedFolderData.files.filter(file => !file.fileName.startsWith('.') && file.downloadUrl);
              return (
                <div className="space-y-3">
                  {visibleFiles.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-700">Files</h3>
                        <span className="text-xs text-gray-500">
                          {visibleFiles.length} {visibleFiles.length === 1 ? 'file' : 'files'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {visibleFiles.map(renderFileCard)}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-gray-700">Upload files</h3>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center bg-gray-50">
                        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-lg font-medium text-gray-700 mb-2">
                          Drop your image(s) here, or browse
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                          JPG, PNG types. Max. 50MB each
                        </p>
                        <Button
                          onClick={() => setShowUploadModal(true)}
                          className="bg-rpp-red-main hover:bg-rpp-red-dark text-white"
                        >
                          Browse Files
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          // Folder List View
          <div className="space-y-6">
            {foldersToShow.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                <Folder className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {currentFolderPath ? 'No subfolders yet' : 'No folders yet'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {currentFolderPath 
                    ? 'Create subfolders to organize files within this folder.'
                    : 'Create folders to organize your completed files from editors.'
                  }
                </p>
                <Button 
                  onClick={() => handleCreateFolder(currentFolderPath || undefined)} 
                  className="mb-4"
                  data-testid="button-add-folder-empty"
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Create {currentFolderPath ? 'Subfolder' : 'First Folder'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {foldersToShow.map((folder) => (
                  <Card 
                    key={folder.folderPath} 
                    className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div 
                          className="flex items-center space-x-3 flex-1 cursor-pointer"
                          onClick={() => handleEnterFolder(folder.folderPath)}
                          data-testid={`folder-card-${folder.folderPath}`}
                        >
                          <Folder className="h-6 w-6 text-blue-600" />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-medium text-gray-900">
                              {folder.partnerFolderName || folder.editorFolderName}
                            </h3>
                            {folder.partnerFolderName && folder.editorFolderName !== folder.partnerFolderName && (
                              <p className="text-sm text-gray-500 truncate">
                                Originally: {folder.editorFolderName}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          {folder.orderNumber && (
                            <Badge variant="outline" className="text-xs">
                              {folder.orderNumber}
                            </Badge>
                          )}
                          
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <ImageIcon className="h-4 w-4" />
                            <span>{folder.fileCount} {folder.fileCount === 1 ? 'file' : 'files'}</span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-600">Visible on delivery:</span>
                            <Switch
                              checked={folderVisibility[folder.folderPath] ?? true}
                              onCheckedChange={(checked) => handleToggleVisibility(folder.folderPath, folderVisibility[folder.folderPath] ?? true)}
                              data-testid={`switch-visibility-${folder.folderPath}`}
                            />
                          </div>
                          
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateFolder(folder.folderPath);
                              }}
                              data-testid={`button-add-subfolder-${folder.folderPath}`}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                  }}
                                  data-testid={`button-folder-menu-${folder.folderPath}`}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // TODO: Implement download all functionality
                                  }}
                                  data-testid={`menu-download-all-${folder.folderPath}`}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download All
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRenameFolder(folder);
                                  }}
                                  data-testid={`menu-rename-section-${folder.folderPath}`}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Rename section
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // TODO: Implement collapse functionality
                                  }}
                                  data-testid={`menu-collapse-section-${folder.folderPath}`}
                                >
                                  <Folder className="h-4 w-4 mr-2" />
                                  Collapse section
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteFolder(
                                      folder.folderPath,
                                      folder.partnerFolderName || folder.editorFolderName
                                    );
                                  }}
                                  className="text-red-600"
                                  data-testid={`menu-delete-section-${folder.folderPath}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete section
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )
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
                {group.files
                  .filter(file => !file.fileName.startsWith('.') && file.downloadUrl)
                  .map(renderFileCard)}
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
            <DialogTitle>Create New {parentFolderPath ? 'Subfolder' : 'Folder'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-folder-name">Folder Name</Label>
              <Input
                id="new-folder-name"
                placeholder={parentFolderPath 
                  ? "Enter subfolder name (e.g., 'High Res', 'Web Ready')"
                  : "Enter folder name (e.g., 'High Resolution Photos', 'Web Ready Images')"
                }
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                data-testid="input-new-folder-name"
              />
              {parentFolderPath && (
                <p className="text-sm text-blue-600">
                  Creating subfolder in: {parentFolderPath}
                </p>
              )}
              <p className="text-sm text-gray-600">
                This will create a new {parentFolderPath ? 'subfolder' : 'folder'} for organizing uploaded files.
              </p>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowCreateFolderModal(false);
                setNewFolderName('');
                setParentFolderPath(null);
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
                  Create {parentFolderPath ? 'Subfolder' : 'Folder'}
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

      {/* Partner File Upload Modal */}
      {showUploadModal && user && (
        <FileUploadModal
          isOpen={showUploadModal}
          onClose={() => {
            setShowUploadModal(false);
            setSelectedUploadFolder('');
          }}
          serviceName="Job Files"
          serviceId="general"
          userId={user.uid}
          jobId={jobId}
          uploadType="client"
          onFilesUpload={(serviceId, files, orderNumber) => {
            // Refresh the files and folders after upload
            queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'folders'] });
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/completed-files`] });
            toast({
              title: "Files uploaded successfully",
              description: `${files.length} file(s) uploaded to the job.`,
            });
          }}
        />
      )}
    </div>
  );
}