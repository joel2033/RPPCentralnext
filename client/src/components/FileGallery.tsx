import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Eye, FileImage, File, Calendar, User, Plus, Edit, FolderPlus, Folder, Video, FileText, Image as ImageIcon, Map, Play, MoreVertical, Upload, Trash2, ChevronLeft, ChevronRight, X } from "lucide-react";
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
  folderToken?: string; // Token for standalone folders (created via "Add Content")
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

  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string>('');
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [galleryImages, setGalleryImages] = useState<Array<{ url: string; name: string }>>([]);
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
  // New content section creation
  const [showNewContentSection, setShowNewContentSection] = useState(false);
  const [newContentSectionName, setNewContentSectionName] = useState('');
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userData: user } = useAuth();

  // Fetch folders for this job
  const { data: foldersData, isLoading: isFoldersLoading, refetch: refetchFolders } = useQuery<FolderData[]>({
    queryKey: ['/api/jobs', jobId, 'folders'],
    enabled: !!jobId,
    staleTime: 0, // Always consider data stale to force refetch
    gcTime: 0, // Don't cache the data (gcTime replaces cacheTime in v5)
    refetchOnMount: 'always', // Always refetch when component mounts
  });

  // Debug: Log folders data when it changes
  console.log('[FileGallery] Folders data:', foldersData);

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

  // Mutation for setting cover photo
  const setCoverPhotoMutation = useMutation({
    mutationFn: async ({ imageUrl }: { imageUrl: string }) => {
      return apiRequest(`/api/jobs/${jobId}/cover-photo`, 'PATCH', { imageUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/card', jobId] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Cover photo updated",
        description: "The job cover photo has been set successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to set cover photo",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // useEffect for keyboard navigation - Must be before any early returns
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedImage) return;
      
      if (e.key === 'ArrowRight') {
        navigateImage('next');
      } else if (e.key === 'ArrowLeft') {
        navigateImage('prev');
      } else if (e.key === 'Escape') {
        setSelectedImage(null);
      }
    };

    if (selectedImage) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedImage, currentImageIndex, galleryImages]);

  // Initialize folder visibility state - Must be before any early returns
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

  // Early return for loading state - must be AFTER all hooks
  if (isLoading || isFoldersLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-primary"></div>
            <p className="text-sm text-gray-500">Loading files...</p>
          </div>
        </div>
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

  const handleDeleteFolder = (folderPath: string, folderName: string, orderNumber?: string) => {
    // Prevent deletion if folder has an order attached
    if (orderNumber) {
      toast({
        title: "Cannot delete folder",
        description: `This folder is attached to ${orderNumber} and cannot be deleted.`,
        variant: "destructive",
      });
      return;
    }

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

  const handleImageClick = (url: string, name: string, folderFiles?: any[]) => {
    // Build gallery from folder files if provided
    if (folderFiles) {
      const imageFiles = folderFiles
        .filter(file => !file.fileName.startsWith('.') && file.downloadUrl && isImage(file.mimeType))
        .map(file => ({ url: file.downloadUrl, name: file.originalName }));
      
      setGalleryImages(imageFiles);
      const clickedIndex = imageFiles.findIndex(img => img.url === url);
      setCurrentImageIndex(clickedIndex >= 0 ? clickedIndex : 0);
    } else {
      setGalleryImages([{ url, name }]);
      setCurrentImageIndex(0);
    }
    
    setSelectedImage(url);
    setSelectedImageName(name);
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (galleryImages.length === 0) return;
    
    let newIndex = currentImageIndex;
    if (direction === 'next') {
      newIndex = (currentImageIndex + 1) % galleryImages.length;
    } else {
      newIndex = currentImageIndex - 1 < 0 ? galleryImages.length - 1 : currentImageIndex - 1;
    }
    
    setCurrentImageIndex(newIndex);
    setSelectedImage(galleryImages[newIndex].url);
    setSelectedImageName(galleryImages[newIndex].name);
  };

  const handleDownload = (url: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
  };

  const renderFileCard = (file: CompletedFile, folderFiles?: any[]) => {
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
            onClick={() => handleImageClick(file.downloadUrl, file.originalName, folderFiles)}
          >
            <img
              src={file.downloadUrl}
              alt={file.originalName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 group-focus-within:bg-opacity-40 transition-all duration-200 flex items-center justify-center">
              <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            {/* Image menu overlay */}
            <div className="absolute top-2 right-2 z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 bg-white/90 hover:bg-white focus-visible:bg-white text-gray-700 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#f2572c]"
                    data-testid={`button-file-menu-${file.id}`}
                    aria-label="File options menu"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      setCoverPhotoMutation.mutate({ imageUrl: file.downloadUrl });
                    }}
                    data-testid={`menuitem-set-cover-${file.id}`}
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Set as Cover Photo
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(file.downloadUrl, file.originalName);
                    }}
                    data-testid={`menuitem-download-file-${file.id}`}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      toast({
                        title: "Feature coming soon",
                        description: "Rename functionality will be available in a future update.",
                      });
                    }}
                    data-testid={`menuitem-rename-file-${file.id}`}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Rename File
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      toast({
                        title: "Feature coming soon",
                        description: "Delete functionality will be available in a future update.",
                      });
                    }}
                    className="text-red-600 focus:text-red-600"
                    data-testid={`menuitem-delete-file-${file.id}`}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete File
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                  handleImageClick(file.downloadUrl, file.originalName, folderFiles);
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

  const handleToggleVisibility = (folderPath: string, currentVisibility: boolean) => {
    const newVisibility = !currentVisibility;
    setFolderVisibility(prev => ({ ...prev, [folderPath]: newVisibility }));
    updateFolderVisibilityMutation.mutate({ folderPath, isVisible: newVisibility });
  };

  return (
    <div className="space-y-6">
      {/* Header with view toggle and add folder button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Folders</h3>
        
        <div className="flex space-x-2">
          <Button 
            onClick={() => setShowNewContentSection(true)}
            variant="outline"
            size="sm"
            data-testid="button-add-folder"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Content
          </Button>
        </div>
      </div>

      {/* New Content Section Form */}
      {showNewContentSection && (
        <Card className="border-2 border-blue-500 bg-blue-50">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">Create New Content Section</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowNewContentSection(false);
                    setNewContentSectionName('');
                  }}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-content-name">Section Name</Label>
                <Input
                  id="new-content-name"
                  placeholder="Enter section name (e.g., 'Photos', 'Videos', 'Floor Plans')"
                  value={newContentSectionName}
                  onChange={(e) => setNewContentSectionName(e.target.value)}
                  data-testid="input-new-content-section-name"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowNewContentSection(false);
                    setNewContentSectionName('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (newContentSectionName.trim()) {
                      createFolderMutation.mutate({
                        partnerFolderName: newContentSectionName.trim(),
                      });
                      setShowNewContentSection(false);
                      setNewContentSectionName('');
                    }
                  }}
                  disabled={!newContentSectionName.trim() || createFolderMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  data-testid="button-create-content-section"
                >
                  {createFolderMutation.isPending ? 'Creating...' : 'Create Section'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Breadcrumb Navigation */}
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

      {showFolderContent && selectedFolderData ? (
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
                              subfolder.partnerFolderName?.split('/').pop() || subfolder.editorFolderName.split('/').pop() || 'Unnamed Folder',
                              subfolder.orderNumber
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

              const handleDragEnter = (e: React.DragEvent) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              };

              const handleDragLeave = (e: React.DragEvent) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
              };

              const handleDragOver = (e: React.DragEvent) => {
                e.preventDefault();
                e.stopPropagation();
              };

              const handleDrop = (e: React.DragEvent) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                
                const files = Array.from(e.dataTransfer.files).filter(file => 
                  file.type.startsWith('image/') || 
                  file.name.toLowerCase().endsWith('.dng') ||
                  file.type === 'image/x-adobe-dng'
                );
                
                if (files.length > 0) {
                  setShowUploadModal(true);
                }
              };

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
                        {visibleFiles.map(file => renderFileCard(file, selectedFolderData.files))}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-gray-700">Upload files</h3>
                      <div 
                        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                          isDragging 
                            ? 'border-rpp-red-main bg-red-50' 
                            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                        }`}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                      >
                        <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragging ? 'text-rpp-red-main' : 'text-gray-400'}`} />
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
                                      folder.partnerFolderName || folder.editorFolderName,
                                      folder.orderNumber
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
        )}

      {/* Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-full w-screen h-screen p-0 bg-black border-0 shadow-none m-0">
          {/* Dark Overlay Background */}
          <div className="absolute inset-0 bg-black" onClick={() => setSelectedImage(null)} />
          
          <div className="relative h-full flex flex-col items-center justify-center p-8 z-10">
            {/* Close Button */}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setSelectedImage(null)}
              className="absolute top-6 right-6 z-30 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white rounded-full h-10 w-10"
              data-testid="button-close-gallery"
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Top Controls */}
            <div className="absolute top-6 left-6 flex items-center space-x-3 z-20">
              {galleryImages.length > 1 && (
                <div className="bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium">
                  {currentImageIndex + 1} / {galleryImages.length}
                </div>
              )}
              <Button
                size="sm"
                onClick={() => selectedImage && handleDownload(selectedImage, selectedImageName)}
                className="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white border-0 rounded-full"
                data-testid="button-modal-download"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            {/* Main Image Container - Floating Effect */}
            <div className="relative flex-1 flex items-center justify-center w-full max-h-[calc(100%-180px)] mb-4">
              {/* Previous Arrow - Small */}
              {galleryImages.length > 1 && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateImage('prev');
                  }}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white rounded-full h-10 w-10 transition-all"
                  data-testid="button-prev-image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}

              {/* Floating Image */}
              <div className="relative max-w-full max-h-full">
                <img
                  src={selectedImage || ''}
                  alt={selectedImageName}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl shadow-black/50"
                  onClick={(e) => e.stopPropagation()}
                />
                {/* Image Name Overlay */}
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm max-w-md truncate">
                  {selectedImageName}
                </div>
              </div>

              {/* Next Arrow - Small */}
              {galleryImages.length > 1 && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateImage('next');
                  }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white rounded-full h-10 w-10 transition-all"
                  data-testid="button-next-image"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              )}
            </div>

            {/* Thumbnail Carousel */}
            {galleryImages.length > 1 && (
              <div className="w-full max-w-5xl px-4">
                <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                  {galleryImages.map((img, index) => (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex(index);
                        setSelectedImage(img.url);
                        setSelectedImageName(img.name);
                      }}
                      className={`flex-shrink-0 relative group transition-all ${
                        index === currentImageIndex 
                          ? 'ring-2 ring-white scale-110' 
                          : 'opacity-60 hover:opacity-100 hover:scale-105'
                      }`}
                      data-testid={`thumbnail-${index}`}
                    >
                      <img
                        src={img.url}
                        alt={img.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                      {index === currentImageIndex && (
                        <div className="absolute inset-0 bg-white/20 rounded-lg" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
          folderToken={selectedFolderData?.folderToken} // Pass folder token for standalone folders
          folderPath={selectedFolderData?.folderPath} // Pass folder path
          onFilesUpload={async (serviceId, files, orderNumber) => {
            // Immediately refetch folders and files to show new uploads
            const [foldersResponse] = await Promise.all([
              queryClient.refetchQueries({ queryKey: ['/api/jobs', jobId, 'folders'] }),
              queryClient.refetchQueries({ queryKey: [`/api/jobs/${jobId}/completed-files`] })
            ]);
            
            // If we were uploading to a specific folder, open it to show the new files
            if (selectedFolderData) {
              // Refetch to get the latest folder data with new files
              const updatedFolders = queryClient.getQueryData<FolderData[]>(['/api/jobs', jobId, 'folders']);
              const updatedFolder = updatedFolders?.find(f => f.folderPath === selectedFolderData.folderPath);
              if (updatedFolder) {
                setSelectedFolderData(updatedFolder);
              }
            }
            
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