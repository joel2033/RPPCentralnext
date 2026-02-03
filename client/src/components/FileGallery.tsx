import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Eye, FileImage, File, Calendar, User, Plus, Edit, FolderPlus, Folder, Video, FileText, Image as ImageIcon, Map, Play, MoreVertical, Upload, Trash2, ChevronLeft, ChevronRight, X, Loader2, GripVertical, Check } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FileUploadModal } from "@/components/FileUploadModal";
import { VideoThumbnail } from "@/components/VideoThumbnail";
import { useAuth } from "@/contexts/AuthContext";
import { useMasterView } from "@/contexts/MasterViewContext";
import { auth } from "@/lib/firebase";
import { useRealtimeEditorUploads } from "@/hooks/useFirestoreRealtime";
import { OrderDetailsModal, OrderDetails } from "@/components/modals/OrderDetailsModal";
import { RequestRevisionModal, RevisionRequestData } from "@/components/modals/RequestRevisionModal";

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
  uniqueKey: string;
  folderPath: string;
  editorFolderName: string;
  partnerFolderName?: string;
  orderId?: string | null;
  orderNumber?: string;
  fileCount: number;
  files: CompletedFile[];
  folderToken?: string; // Token for standalone folders (created via "Add Content")
  isVisible?: boolean;
  displayOrder?: number;
}

interface FileGalleryProps {
  completedFiles: CompletedFilesGroup[];
  jobId: string;
  isLoading?: boolean;
}

// SortableFolderItem component - must be outside main component to avoid hooks errors
interface SortableFolderItemProps {
  folder: FolderData;
  isReadOnly: boolean;
  folderVisibility: Record<string, boolean>;
  downloadingFolder: string | null;
  onEnterFolder: (folder: FolderData) => void;
  onToggleVisibility: (folder: FolderData, isVisible: boolean) => void;
  onCreateSubfolder: (folderPath: string) => void;
  onDownloadAll: (folder: FolderData) => void;
  onSelectAllImages: (folder: FolderData) => void;
  areAllImagesSelected: (folder: FolderData) => boolean;
  onRenameFolder: (folder: FolderData) => void;
  onDeleteFolder: (folder: FolderData) => void;
  getFolderKey: (folder: FolderData) => string;
  getFolderTestId: (prefix: string, folder: FolderData) => string;
  formatOrderNumber: (orderNumber: string) => string;
  pendingFolderKey: string | null;
  onOrderClick: (orderId: string | null | undefined) => void;
}

const SortableFolderItem = ({
  folder,
  isReadOnly,
  folderVisibility,
  downloadingFolder,
  onEnterFolder,
  onToggleVisibility,
  onCreateSubfolder,
  onDownloadAll,
  onSelectAllImages,
  areAllImagesSelected,
  onRenameFolder,
  onDeleteFolder,
  getFolderKey,
  getFolderTestId,
  formatOrderNumber,
  pendingFolderKey,
  onOrderClick,
}: SortableFolderItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: folder.uniqueKey, disabled: isReadOnly });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card 
        className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div 
              className="flex items-center space-x-3 flex-1 cursor-pointer"
              onClick={() => onEnterFolder(folder)}
              data-testid={getFolderTestId('folder-card', folder)}
            >
              {!isReadOnly && (
                <div
                  {...attributes}
                  {...listeners}
                  className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
                  onClick={(e) => e.stopPropagation()}
                >
                  <GripVertical className="h-5 w-5 text-gray-400" />
                </div>
              )}
              <Folder className="h-6 w-6 text-blue-600" />
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-medium text-gray-900">
                  {folder.partnerFolderName || folder.editorFolderName || 'Unnamed Folder'}
                </h3>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {(folder.orderId || folder.orderNumber) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOrderClick(folder.orderId);
                  }}
                  className="text-sm font-semibold text-rpp-red-main hover:text-rpp-orange hover:underline cursor-pointer transition-colors"
                >
                  {folder.orderNumber ? formatOrderNumber(folder.orderNumber) : `Order: ${folder.orderId}`}
                </button>
              )}
              
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <ImageIcon className="h-4 w-4" />
                <span>{folder.fileCount} {folder.fileCount === 1 ? 'file' : 'files'}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-600">Visible on delivery:</span>
                <Switch
                  checked={folderVisibility[getFolderKey(folder)] ?? (folder.isVisible ?? true)}
                  onCheckedChange={(checked) => onToggleVisibility(folder, checked)}
                  data-testid={getFolderTestId('switch-visibility', folder)}
                  disabled={pendingFolderKey === getFolderKey(folder)}
                />
              </div>
              
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateSubfolder(folder.folderPath);
                  }}
                  data-testid={getFolderTestId('button-add-subfolder', folder)}
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
                      data-testid={getFolderTestId('button-folder-menu', folder)}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAllImages(folder);
                      }}
                      data-testid={getFolderTestId('menu-select-all-images', folder)}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      {areAllImagesSelected(folder) ? 'Deselect All Images' : 'Select All Images'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownloadAll(folder);
                      }}
                      disabled={downloadingFolder === folder.uniqueKey}
                      data-testid={getFolderTestId('menu-download-all', folder)}
                    >
                      {downloadingFolder === folder.uniqueKey ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating zip...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Download All
                        </>
                      )}
                    </DropdownMenuItem>
                    {!isReadOnly && (
                      <>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onRenameFolder(folder);
                          }}
                          data-testid={getFolderTestId('menu-rename-section', folder)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Rename section
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Implement collapse functionality
                          }}
                          data-testid={getFolderTestId('menu-collapse-section', folder)}
                        >
                          <Folder className="h-4 w-4 mr-2" />
                          Collapse section
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onDeleteFolder(folder);
                          }}
                          className="text-red-600"
                          data-testid={getFolderTestId('menu-delete-section', folder)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete section
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

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
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedVideoName, setSelectedVideoName] = useState<string>('');
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number>(0);
  const [galleryVideos, setGalleryVideos] = useState<Array<{ url: string; name: string }>>([]);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<FolderData | null>(null);
  const [viewMode, setViewMode] = useState<'folders' | 'orders'>('folders');
  const [parentFolderPath, setParentFolderPath] = useState<string | null>(null);
  const [currentFolderPath, setCurrentFolderPath] = useState<string | null>(null);
  const [showFolderContent, setShowFolderContent] = useState(false);
  const [selectedFolderData, setSelectedFolderData] = useState<FolderData | null>(null);
  const [folderHierarchy, setFolderHierarchy] = useState<FolderData[]>([]);
  // Partner upload functionality
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedUploadFolder, setSelectedUploadFolder] = useState<string>('');
  // Folder visibility state
  const [folderVisibility, setFolderVisibility] = useState<Record<string, boolean>>({});
  // New content section creation
  const [showNewContentSection, setShowNewContentSection] = useState(false);
  const [newContentSectionName, setNewContentSectionName] = useState('');
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<{ folderPath: string; folderName: string; folderToken?: string } | null>(null);
  const [showDeleteFileConfirm, setShowDeleteFileConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<CompletedFile | null>(null);
  // Track deleted file IDs for instant UI updates
  const [deletedFileIds, setDeletedFileIds] = useState<Set<string>>(new Set());
  // Download state
  const [downloadingFolder, setDownloadingFolder] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState({
    isOpen: false,
    stage: 'idle' as 'idle' | 'creating' | 'downloading' | 'complete',
    progress: 0,
    filesProcessed: 0,
    totalFiles: 0,
    bytesReceived: 0,
    totalBytes: 0,
    folderName: ''
  });
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  // Track which folder is currently being updated (for UI loading state)
  const [pendingFolderKey, setPendingFolderKey] = useState<string | null>(null);
  
  // Order details modal state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [isLoadingOrderDetails, setIsLoadingOrderDetails] = useState(false);
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);
  
  // Multi-select state for image downloads
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [isDownloadingSelected, setIsDownloadingSelected] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userData: user } = useAuth();
  const { isReadOnly } = useMasterView();

  // Get job data to access internal ID for real-time listeners
  const { data: jobData } = useQuery({
    queryKey: ['/api/jobs/card', jobId],
    enabled: !!jobId,
    select: (data: any) => data?.id, // Only get the internal ID
  });

  // Real-time listener for editor uploads (requires internal job ID)
  const internalJobId = jobData;
  const { uploads: realtimeUploads, loading: isRealtimeLoading } = useRealtimeEditorUploads(internalJobId || null);

  // Fetch folders for this job (fallback to REST API, synced with real-time listeners)
  const { data: foldersData, isLoading: isFoldersLoading, refetch: refetchFolders } = useQuery<FolderData[]>({
    queryKey: ['/api/jobs', jobId, 'folders'],
    enabled: !!jobId,
    staleTime: 0, // Always consider data stale to force refetch
    gcTime: 0, // Don't cache the data (gcTime replaces cacheTime in v5)
    refetchOnMount: 'always', // Always refetch when component mounts
  });

  // Refetch function for completed files (to trigger parent refetch)
  const refetchCompletedFiles = () => {
    queryClient.invalidateQueries({ 
      queryKey: [`/api/jobs/${jobId}/completed-files`],
      exact: false 
    });
  };

  // Sync real-time uploads with folders query - trigger on any upload change
  const prevUploadIdsRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    if (!internalJobId || isRealtimeLoading) return;
    
    const currentUploadIds = new Set(realtimeUploads.map(upload => upload.id));
    const prevUploadIds = prevUploadIdsRef.current;
    
    // Check if there are any new uploads (files added)
    const hasNewUploads = Array.from(currentUploadIds).some(id => !prevUploadIds.has(id));
    
    // Check if uploads were removed
    const hasRemovedUploads = Array.from(prevUploadIds).some(id => !currentUploadIds.has(id));
    
    // If uploads changed (added or removed), immediately invalidate and refetch
    if (hasNewUploads || hasRemovedUploads || (prevUploadIds.size === 0 && currentUploadIds.size > 0)) {
      console.log('[FileGallery] Real-time uploads changed, refreshing folders:', {
        newUploads: hasNewUploads,
        removedUploads: hasRemovedUploads,
        currentCount: currentUploadIds.size,
        prevCount: prevUploadIds.size
      });
      
      // Immediately invalidate and refetch folders to show new files
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'folders'] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/completed-files`] });
      
      // Also trigger a refetch to ensure immediate update
      refetchFolders();
    }
    
    // Update the ref with current upload IDs
    prevUploadIdsRef.current = currentUploadIds;
  }, [realtimeUploads, internalJobId, isRealtimeLoading, jobId, queryClient, refetchFolders]);

  // Clear deleted file IDs when real-time listener confirms deletion
  React.useEffect(() => {
    if (deletedFileIds.size > 0 && realtimeUploads.length > 0) {
      // Check if any deleted file IDs are no longer in real-time uploads
      const realtimeUploadIds = new Set(realtimeUploads.map(upload => upload.id));

      // Remove file IDs that are confirmed deleted by real-time listener
      setDeletedFileIds(prev => {
        const next = new Set(prev);
        let hasChanges = false;
        prev.forEach(id => {
          if (!realtimeUploadIds.has(id)) {
            next.delete(id); // Real-time listener confirmed it's deleted
            hasChanges = true;
          }
        });
        // Only return new Set if there were actual changes to avoid infinite loops
        return hasChanges ? next : prev;
      });
    }
  }, [realtimeUploads, deletedFileIds]);

  // Update selectedFolderData when folders are refetched (to show new files in folder view)
  React.useEffect(() => {
    if (selectedFolderData && foldersData && Array.isArray(foldersData)) {
      // Find the updated folder data that matches the currently selected folder
      const updatedFolder = foldersData.find(f => {
        // Match by uniqueKey if available, otherwise match by folderPath
        if (selectedFolderData.uniqueKey && f.uniqueKey) {
          return f.uniqueKey === selectedFolderData.uniqueKey;
        }
        return f.folderPath === selectedFolderData.folderPath;
      });
      
      if (updatedFolder) {
        // Update selectedFolderData with the latest folder data (including new files)
        setSelectedFolderData(updatedFolder);
      }
    }
  }, [foldersData, selectedFolderData?.uniqueKey, selectedFolderData?.folderPath]);

  // Debug: Log folders data when it changes
  console.log('[FileGallery] Folders data:', foldersData);

  // Mutation for creating folders
  const createFolderMutation = useMutation({
    mutationFn: async ({ partnerFolderName }: { partnerFolderName: string }) => {
      const response = await apiRequest(`/api/jobs/${jobId}/folders`, 'POST', {
        partnerFolderName,
        parentFolderPath: parentFolderPath || undefined
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'folders'] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/completed-files`] });
      toast({
        title: "Folder created successfully",
        description: "The folder is ready for file uploads.",
      });
      setShowCreateFolderModal(false);
      setShowNewContentSection(false);
      setNewFolderName('');
      setParentFolderPath(null);
    },
    onError: (error: any) => {
      console.error('Error creating folder:', error);
      let errorMessage = 'Please try again.';
      if (error?.message) {
        // Clean up error message - remove status code prefix if present
        errorMessage = error.message.replace(/^\d+:\s*/, '');
        // Try to parse JSON error if present
        try {
          const jsonMatch = errorMessage.match(/\{.*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]);
            errorMessage = errorData.error || errorData.details || errorData.message || errorMessage;
          }
        } catch {
          // If parsing fails, use the message as-is
        }
      }
      toast({
        title: "Failed to create folder",
        description: errorMessage,
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
    mutationFn: async ({ folderPath, folderToken }: { folderPath: string; folderToken?: string }) => {
      return apiRequest(`/api/jobs/${jobId}/folders`, 'DELETE', { folderPath, folderToken });
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

  // Mutation for deleting individual files with optimistic updates
  const deleteFileMutation = useMutation({
    mutationFn: async ({ fileId, downloadUrl }: { fileId: string; downloadUrl: string }) => {
      return apiRequest(`/api/jobs/${jobId}/files/${fileId}`, 'DELETE');
    },
    onMutate: async ({ fileId, downloadUrl }) => {
      // IMMEDIATELY add to deleted set for instant UI update
      setDeletedFileIds(prev => new Set(prev).add(fileId));

      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['/api/jobs', jobId, 'folders'] });
      await queryClient.cancelQueries({ queryKey: [`/api/jobs/${jobId}/completed-files`] });

      // Snapshot the previous values
      const previousFolders = queryClient.getQueryData<FolderData[]>(['/api/jobs', jobId, 'folders']);
      const previousCompletedFiles = queryClient.getQueryData<{ completedFiles: CompletedFilesGroup[] }>([`/api/jobs/${jobId}/completed-files`]);

      // Optimistically update folders - remove file from all folders
      if (previousFolders) {
        const updatedFolders = previousFolders.map(folder => ({
          ...folder,
          files: folder.files.filter(file => file.id !== fileId),
          fileCount: folder.files.filter(file => file.id !== fileId).length
        })).filter(folder => folder.fileCount > 0 || folder.folderPath); // Keep folders even if empty
        queryClient.setQueryData<FolderData[]>(['/api/jobs', jobId, 'folders'], updatedFolders);
      }

      // Optimistically update completed files
      if (previousCompletedFiles) {
        const updatedCompletedFiles = previousCompletedFiles.completedFiles.map(group => ({
          ...group,
          files: group.files.filter(file => file.id !== fileId)
        })).filter(group => group.files.length > 0);
        queryClient.setQueryData<{ completedFiles: CompletedFilesGroup[] }>([`/api/jobs/${jobId}/completed-files`], {
          completedFiles: updatedCompletedFiles
        });
      }

      // Close image modal if it was showing the deleted file
      if (selectedImage && selectedImage === downloadUrl) {
        setSelectedImage(null);
      }

      // Show immediate feedback
      toast({
        title: "Deleting file...",
        description: "File will be removed shortly.",
      });

      return { previousFolders, previousCompletedFiles };
    },
    onSuccess: async (_, variables) => {
      // Don't invalidate immediately - let the real-time listener handle it
      // The deletedFileIds set keeps the UI updated while we wait for Firestore

      // After a short delay, invalidate queries to ensure consistency
      // This gives Firestore time to propagate the deletion
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'folders'], exact: false });
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/completed-files`], exact: false });
      }, 500);

      toast({
        title: "File deleted successfully",
        description: "The file has been permanently removed.",
      });

      setShowDeleteFileConfirm(false);
      setFileToDelete(null);
    },
    onError: (error, variables, context) => {
      // Remove from deleted set to restore the file in UI
      setDeletedFileIds(prev => {
        const next = new Set(prev);
        next.delete(variables.fileId);
        return next;
      });

      // Rollback on error
      if (context?.previousFolders) {
        queryClient.setQueryData(['/api/jobs', jobId, 'folders'], context.previousFolders);
      }
      if (context?.previousCompletedFiles) {
        queryClient.setQueryData([`/api/jobs/${jobId}/completed-files`], context.previousCompletedFiles);
      }
      
      toast({
        title: "Failed to delete file",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation for updating folder order
  const updateFolderOrderMutation = useMutation({
    mutationFn: async (folders: Array<{ uniqueKey: string; displayOrder: number }>) => {
      console.log('[FileGallery] Updating folder order:', folders);
      const result = await apiRequest(`/api/jobs/${jobId}/folders/order`, 'PATCH', { folders });
      console.log('[FileGallery] Folder order update response:', result);
      return result;
    },
    onSuccess: () => {
      // Invalidate and refetch to get updated order
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'folders'] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/completed-files`] });
      // Force a refetch to ensure we get the new order
      queryClient.refetchQueries({ queryKey: ['/api/jobs', jobId, 'folders'] });
      toast({
        title: "Folder order updated",
        description: "The folder order has been saved.",
      });
    },
    onError: (error) => {
      console.error('[FileGallery] Failed to update folder order:', error);
      toast({
        title: "Failed to update folder order",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation for updating folder visibility
  type UpdateFolderVisibilityVariables = {
    folderPath: string;
    folderToken?: string;
    orderId?: string | null;
    isVisible: boolean;
    uniqueKey: string;
  };

  const updateFolderVisibilityMutation = useMutation({
    mutationFn: async ({ folderPath, folderToken, orderId, isVisible, uniqueKey }: UpdateFolderVisibilityVariables) => {
      console.log('[FileGallery] Calling API to update folder visibility:', {
        folderPath,
        folderToken,
        orderId,
        isVisible,
        uniqueKey,
        url: `/api/jobs/${jobId}/folders/visibility`
      });
      const result = await apiRequest(`/api/jobs/${jobId}/folders/visibility`, 'PATCH', { folderPath, folderToken, orderId, isVisible, uniqueKey });
      console.log('[FileGallery] API response:', result);
      return result;
    },
    onMutate: async ({ uniqueKey, isVisible }) => {
      console.log('[FileGallery] Optimistic update:', { uniqueKey, isVisible });
      let previousValue: boolean | undefined;
      setFolderVisibility(prev => {
        previousValue = prev[uniqueKey];
        return {
          ...prev,
          [uniqueKey]: isVisible
        };
      });
      return { key: uniqueKey, previousValue };
    },
    onSuccess: (data) => {
      console.log('[FileGallery] Visibility update successful:', data);
      setPendingFolderKey(null);
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'folders'] });
      toast({
        title: "Folder visibility updated",
        description: "The folder visibility has been changed.",
      });
    },
    onError: (error, variables, context) => {
      console.error('[FileGallery] Visibility update failed:', error, variables, context);
      setPendingFolderKey(null);
      if (context?.key) {
        setFolderVisibility(prev => ({
          ...prev,
          [context.key]: context.previousValue ?? !variables.isVisible
        }));
      }
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
      // Invalidate all queries that might show the cover photo
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/card', jobId] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      // Invalidate all delivery page queries (both public and preview mode)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/delivery/');
        }
      });
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
      setFolderVisibility(() => {
        const next: Record<string, boolean> = {};
        foldersData.forEach(folder => {
          const key = getFolderKey(folder);
          if (!key) return;
          next[key] = folder.isVisible ?? true;
        });
        return next;
      });
    }
  }, [foldersData]);

  // Drag and drop sensors - Must be before any early returns
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatOrderNumber = (orderNumber: string) =>
    orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`;

  const getFolderKey = (folder: FolderData) => {
    // If uniqueKey is provided and already includes jobId format, use it
    if (folder.uniqueKey && folder.uniqueKey.includes('::')) {
      // Check if it already has jobId prefix (format: jobId::token::... or jobId::order::...)
      if (folder.uniqueKey.match(/^[^:]+::(token|order|instance|path)::/)) {
        return folder.uniqueKey;
      }
      // If it's missing jobId prefix, rebuild it using folder properties
      // uniqueKey might be in format like "Photos::order:T59NHR9f_AyVu6PtcoPpT"
      // We'll rebuild using the folder's actual properties
    }
    // Build key matching backend format (always include jobId)
    if (folder.folderToken) return `${jobId}::token::${folder.folderToken}`;
    if (folder.orderId && folder.folderPath) return `${jobId}::order::${folder.orderId}::${folder.folderPath}`;
    if (folder.folderPath) return `${jobId}::path::${folder.folderPath}`;
    return '';
  };

  const getFolderTestId = (prefix: string, folder: FolderData) => {
    const key = getFolderKey(folder) || 'folder';
    return `${prefix}-${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  };

  const buildFolderHierarchy = (folderPath: string, allFolders?: FolderData[], targetUniqueKey?: string): FolderData[] => {
    if (!allFolders || allFolders.length === 0) return [];

    const hierarchy: FolderData[] = [];
    const pathSegments = folderPath.split('/');

    // Build cumulative paths and find each folder in the chain
    // For path like "completed/job123/folders/abc/def", we check:
    // - completed/job123/folders/abc (parent)
    // - completed/job123/folders/abc/def (current)
    for (let i = 1; i <= pathSegments.length; i++) {
      const currentPath = pathSegments.slice(0, i).join('/');
      const matches = allFolders.filter(f => f.folderPath === currentPath);
      if (matches.length === 0) {
        continue;
      }

      let folder = matches[0];
      if (targetUniqueKey && currentPath === folderPath) {
        const exactMatch = matches.find(f => f.uniqueKey === targetUniqueKey);
        if (exactMatch) {
          folder = exactMatch;
        }
      }

      hierarchy.push(folder);
    }

    return hierarchy;
  };

  const handleCreateFolder = (parentPath?: string) => {
    setParentFolderPath(parentPath || null);
    setNewFolderName('');
    setShowCreateFolderModal(true);
  };

  const handleEnterFolder = (folder: FolderData | string) => {
    if (typeof folder === 'string') {
      setCurrentFolderPath(folder);
      return;
    }

    const hierarchy = buildFolderHierarchy(folder.folderPath, foldersData, folder.uniqueKey);
    setFolderHierarchy(hierarchy);
    setSelectedFolderData(folder);
    setShowFolderContent(true);
  };

  const handleBackToParent = () => {
    if (showFolderContent && folderHierarchy.length > 0) {
      if (folderHierarchy.length === 1) {
        // Back to root - exit folder content view
        setShowFolderContent(false);
        setSelectedFolderData(null);
        setFolderHierarchy([]);
      } else {
        // Back to parent folder - remove last item from hierarchy
        const newHierarchy = folderHierarchy.slice(0, -1);
        const parentFolder = newHierarchy[newHierarchy.length - 1];
        setFolderHierarchy(newHierarchy);
        setSelectedFolderData(parentFolder);
      }
    } else if (showFolderContent) {
      // Fallback for folders without hierarchy
      setShowFolderContent(false);
      setSelectedFolderData(null);
      setFolderHierarchy([]);
    } else if (currentFolderPath) {
      const parentPath = currentFolderPath.split('/').slice(0, -1).join('/');
      setCurrentFolderPath(parentPath || null);
    }
  };

  const getBreadcrumbs = () => {
    if (showFolderContent && folderHierarchy.length > 0) {
      // Show full hierarchy: All Folders / Parent / Subfolder / ...
      return [
        'All Folders',
        ...folderHierarchy.map(f => f.partnerFolderName || f.editorFolderName)
      ];
    }
    if (!currentFolderPath) return ['All Folders'];
    return ['All Folders', ...currentFolderPath.split('/')];
  };

  const getFoldersToShow = () => {
    if (!Array.isArray(foldersData)) return [];

    // Helper function to filter deleted files from a folder
    const filterDeletedFiles = (folder: FolderData): FolderData => {
      const filteredFiles = folder.files.filter(file => !deletedFileIds.has(file.id));
      return {
        ...folder,
        files: filteredFiles,
        fileCount: filteredFiles.length
      };
    };

    if (!currentFolderPath) {
      const filtered = foldersData.filter(folder => {
        const segments = folder.folderPath.split('/').filter(Boolean);

        const isPartnerRoot =
          segments.length === 2 &&
          segments[0] === 'folders';

        const isCompletedPartnerRoot =
          segments.length === 4 &&
          segments[0] === 'completed' &&
          segments[2] === 'folders';

        const isEditorRoot =
          segments.length >= 3 &&
          segments[0] === 'completed' &&
          segments[2] !== 'folders' &&
          (segments.length === 3 || segments.length === 4);

        const isLegacyEditorRoot =
          segments.length === 1 &&
          !folder.folderPath.includes('/');

        return isPartnerRoot || isCompletedPartnerRoot || isEditorRoot || isLegacyEditorRoot;
      });

      // Filter deleted files from each folder
      return filtered.map(filterDeletedFiles);
    } else {
      // Show subfolders of current path
      const subfolders = foldersData.filter(folder =>
        folder.folderPath.startsWith(currentFolderPath + '/') &&
        folder.folderPath.split('/').length === currentFolderPath.split('/').length + 1
      );
      // Filter deleted files from each subfolder
      return subfolders.map(filterDeletedFiles);
    }
  };

  const handleRenameFolder = (folder: FolderData) => {
    setSelectedFolder(folder);
    setNewFolderName(folder.partnerFolderName || folder.editorFolderName);
    setShowRenameFolderModal(true);
  };

  const handleDeleteFolder = (folder: FolderData) => {
    // Prevent deletion if folder has an order attached
    if (folder.orderNumber) {
      toast({
        title: "Cannot delete folder",
        description: `This folder is attached to ${folder.orderNumber} and cannot be deleted.`,
        variant: "destructive",
      });
      return;
    }

    // Show confirmation modal - store both folderPath and folderToken for deletion
    setFolderToDelete({ folderPath: folder.folderPath, folderName: folder.partnerFolderName || folder.editorFolderName, folderToken: folder.folderToken });
    setShowDeleteConfirm(true);
  };

  const confirmDeleteFolder = () => {
    if (folderToDelete) {
      deleteFolderMutation.mutate({ folderPath: folderToDelete.folderPath, folderToken: folderToDelete.folderToken });
      setShowDeleteConfirm(false);
      setFolderToDelete(null);
    }
  };

  // Order details modal handlers
  const handleOrderClick = async (orderId: string | null | undefined) => {
    if (!orderId) return;
    
    setSelectedOrderId(orderId);
    setIsOrderDetailsOpen(true);
    setIsLoadingOrderDetails(true);
    setOrderDetails(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const token = await user.getIdToken();
      const response = await fetch(`/api/orders/${orderId}/details`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch order details");
      }

      const data = await response.json();
      setOrderDetails(data);
    } catch (error: any) {
      console.error("Error fetching order details:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load order details",
        variant: "destructive",
      });
      setIsOrderDetailsOpen(false);
    } finally {
      setIsLoadingOrderDetails(false);
    }
  };

  const handleRequestRevision = () => {
    setIsOrderDetailsOpen(false);
    setIsRevisionModalOpen(true);
  };

  const handleRevisionSubmit = async (data: RevisionRequestData) => {
    if (!selectedOrderId) return;
    
    setIsSubmittingRevision(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const token = await user.getIdToken();
      const response = await fetch(`/api/orders/${selectedOrderId}/revisions/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit revision request");
      }

      toast({
        title: "Revision Requested",
        description: "Your revision request has been submitted successfully.",
      });

      // Refresh folders/orders data
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'folders'] });
      
      setIsRevisionModalOpen(false);
      setSelectedOrderId(null);
      setOrderDetails(null);
    } catch (error: any) {
      console.error("Error submitting revision:", error);
      throw error;
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  const handleCloseOrderDetails = () => {
    setIsOrderDetailsOpen(false);
    setSelectedOrderId(null);
    setOrderDetails(null);
  };

  const handleCloseRevisionModal = () => {
    setIsRevisionModalOpen(false);
  };

  const handleDownloadAll = async (folder: FolderData) => {
    // Check if folder has files
    if (folder.fileCount === 0) {
      toast({
        title: "Empty folder",
        description: "This folder has no files to download.",
        variant: "destructive",
      });
      return;
    }

    setDownloadingFolder(folder.uniqueKey);

    // Open progress dialog
    setDownloadProgress({
      isOpen: true,
      stage: 'creating',
      progress: 0,
      filesProcessed: 0,
      totalFiles: 0,
      bytesReceived: 0,
      totalBytes: 0,
      folderName: folder.partnerFolderName || folder.editorFolderName || 'folder'
    });

    try {
      // Step 1: Listen to SSE for zip creation progress
      const token = await auth.currentUser?.getIdToken();
      const eventSource = new EventSource(
        `/api/jobs/${jobId}/folders/download/progress?folderPath=${encodeURIComponent(folder.folderPath)}&token=${token}`
      );

      await new Promise((resolve, reject) => {
        eventSource.onmessage = (e) => {
          const data = JSON.parse(e.data);

          if (data.stage === 'error') {
            eventSource.close();
            reject(new Error(data.message));
          } else if (data.stage === 'complete') {
            eventSource.close();
            setDownloadProgress(prev => ({ ...prev, totalBytes: data.totalBytes }));
            resolve(data);
          } else if (data.stage === 'creating') {
            setDownloadProgress(prev => ({
              ...prev,
              progress: data.progress,
              filesProcessed: data.filesProcessed,
              totalFiles: data.totalFiles
            }));
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          reject(new Error('Connection lost'));
        };
      });

      // Step 2: Download with ReadableStream for download progress
      setDownloadProgress(prev => ({ ...prev, stage: 'downloading', progress: 0 }));

      const response = await fetch(
        `/api/jobs/${jobId}/folders/download?folderPath=${encodeURIComponent(folder.folderPath)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Download failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Unable to read response');

      const contentLength = +(response.headers.get('Content-Length') || '0');
      let receivedLength = 0;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        const downloadProgressPercent = contentLength > 0 ? (receivedLength / contentLength) * 100 : 0;
        setDownloadProgress(prev => ({
          ...prev,
          progress: downloadProgressPercent,
          bytesReceived: receivedLength
        }));
      }

      // Create blob and trigger download
      const blob = new Blob(chunks as BlobPart[]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folder.partnerFolderName || folder.editorFolderName || 'folder'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Close dialog and show success
      setDownloadProgress({
        isOpen: false,
        stage: 'idle',
        progress: 0,
        filesProcessed: 0,
        totalFiles: 0,
        bytesReceived: 0,
        totalBytes: 0,
        folderName: ''
      });

      toast({
        title: "Download complete",
        description: "Your files have been downloaded as a zip file.",
      });

    } catch (error) {
      console.error('Download error:', error);
      setDownloadProgress({
        isOpen: false,
        stage: 'idle',
        progress: 0,
        filesProcessed: 0,
        totalFiles: 0,
        bytesReceived: 0,
        totalBytes: 0,
        folderName: ''
      });
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadingFolder(null);
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
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-white hover:bg-rpp-red-dark h-10 px-4 py-2 mb-4 bg-[#f05a2a]"
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

  // Multi-select helper functions
  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const selectAllImagesInFolder = (folder: FolderData) => {
    const imageFileIds = folder.files
      .filter(file => !file.fileName.startsWith('.') && file.downloadUrl && isImage(file.mimeType))
      .map(file => file.id);
    
    setSelectedFileIds(prev => {
      const newSet = new Set(prev);
      // Check if all images in folder are already selected
      const allSelected = imageFileIds.every(id => newSet.has(id));
      if (allSelected) {
        // Deselect all images in this folder
        imageFileIds.forEach(id => newSet.delete(id));
      } else {
        // Select all images in this folder
        imageFileIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  };

  const clearFileSelection = () => {
    setSelectedFileIds(new Set());
  };

  const areAllImagesSelectedInFolder = (folder: FolderData): boolean => {
    const imageFileIds = folder.files
      .filter(file => !file.fileName.startsWith('.') && file.downloadUrl && isImage(file.mimeType))
      .map(file => file.id);
    
    if (imageFileIds.length === 0) return false;
    return imageFileIds.every(id => selectedFileIds.has(id));
  };

  const getSelectedFilesData = (): CompletedFile[] => {
    // Collect all files from all folders that match selected IDs
    const allFiles: CompletedFile[] = [];
    foldersData?.forEach(folder => {
      folder.files.forEach(file => {
        if (selectedFileIds.has(file.id)) {
          allFiles.push(file);
        }
      });
    });
    return allFiles;
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

  const handleVideoClick = (url: string, name: string, folderFiles?: any[]) => {
    // Build gallery from folder files if provided
    if (folderFiles) {
      const videoFiles = folderFiles
        .filter(file => !file.fileName.startsWith('.') && file.downloadUrl && isVideo(file.mimeType))
        .map(file => ({ url: file.downloadUrl, name: file.originalName }));
      
      setGalleryVideos(videoFiles);
      const clickedIndex = videoFiles.findIndex(vid => vid.url === url);
      setCurrentVideoIndex(clickedIndex >= 0 ? clickedIndex : 0);
    } else {
      setGalleryVideos([{ url, name }]);
      setCurrentVideoIndex(0);
    }
    
    setSelectedVideo(url);
    setSelectedVideoName(name);
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

  const navigateVideo = (direction: 'prev' | 'next') => {
    if (galleryVideos.length === 0) return;
    
    let newIndex = currentVideoIndex;
    if (direction === 'next') {
      newIndex = (currentVideoIndex + 1) % galleryVideos.length;
    } else {
      newIndex = currentVideoIndex - 1 < 0 ? galleryVideos.length - 1 : currentVideoIndex - 1;
    }
    
    setCurrentVideoIndex(newIndex);
    setSelectedVideo(galleryVideos[newIndex].url);
    setSelectedVideoName(galleryVideos[newIndex].name);
  };

  const handleDownload = (url: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
  };

  const handleDownloadSelected = async () => {
    const selectedFiles = getSelectedFilesData();
    
    if (selectedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select at least one image to download.",
        variant: "destructive",
      });
      return;
    }

    // Single file: download directly
    if (selectedFiles.length === 1) {
      const file = selectedFiles[0];
      handleDownload(file.downloadUrl, file.originalName);
      toast({
        title: "Downloading...",
        description: `Downloading ${file.originalName}`,
      });
      clearFileSelection();
      return;
    }

    // Multiple files: zip and download
    setIsDownloadingSelected(true);
    
    // Show download progress
    setDownloadProgress({
      isOpen: true,
      stage: 'creating',
      progress: 0,
      filesProcessed: 0,
      totalFiles: selectedFiles.length,
      bytesReceived: 0,
      totalBytes: 0,
      folderName: 'selected images'
    });

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const fileIds = selectedFiles.map(f => f.id);
      
      // Call the backend endpoint to create zip
      const response = await fetch(`/api/jobs/${jobId}/files/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ fileIds }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create download');
      }

      // Update progress to downloading stage
      setDownloadProgress(prev => ({ 
        ...prev, 
        stage: 'downloading', 
        progress: 0 
      }));

      // Get the blob and trigger download
      const contentLength = +(response.headers.get('Content-Length') || '0');
      const reader = response.body?.getReader();
      
      if (!reader) {
        throw new Error('Unable to read response');
      }

      let receivedLength = 0;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        const downloadProgressPercent = contentLength > 0 ? (receivedLength / contentLength) * 100 : 0;
        setDownloadProgress(prev => ({
          ...prev,
          progress: downloadProgressPercent,
          bytesReceived: receivedLength,
          totalBytes: contentLength
        }));
      }

      // Create blob and trigger download
      const blob = new Blob(chunks);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'selected-images.zip';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Close dialog and show success
      setDownloadProgress({
        isOpen: false,
        stage: 'idle',
        progress: 0,
        filesProcessed: 0,
        totalFiles: 0,
        bytesReceived: 0,
        totalBytes: 0,
        folderName: ''
      });

      toast({
        title: "Download complete",
        description: `${selectedFiles.length} images downloaded as a zip file.`,
      });

      // Clear selection after successful download
      clearFileSelection();

    } catch (error) {
      console.error('[FileGallery] Download error:', error);
      setDownloadProgress({
        isOpen: false,
        stage: 'idle',
        progress: 0,
        filesProcessed: 0,
        totalFiles: 0,
        bytesReceived: 0,
        totalBytes: 0,
        folderName: ''
      });
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingSelected(false);
    }
  };

  const renderFileCard = (file: CompletedFile, folderFiles?: any[]) => {
    console.log('[FileGallery] Rendering file card for:', file.fileName, 'URL:', file.downloadUrl);
    const isFileSelected = selectedFileIds.has(file.id);
    const isImageFile = isImage(file.mimeType);
    
    return (
      <Card 
        key={file.id} 
        className={`overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group ${
          isFileSelected ? 'ring-2 ring-[#f2572c] ring-offset-2' : ''
        }`}
      >
      <CardContent className="p-0">
        {isImageFile ? (
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
            <div className={`absolute inset-0 transition-all duration-200 flex items-center justify-center ${
              isFileSelected 
                ? 'bg-black bg-opacity-30' 
                : 'bg-black bg-opacity-0 group-hover:bg-opacity-40 group-focus-within:bg-opacity-40'
            }`}>
              {!isFileSelected && (
                <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
            {/* Selection checkbox overlay - top left */}
            <div 
              className={`absolute top-2 left-2 z-10 ${
                isFileSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              } transition-opacity`}
              onClick={(e) => {
                e.stopPropagation();
                toggleFileSelection(file.id);
              }}
            >
              <div 
                className={`h-6 w-6 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${
                  isFileSelected 
                    ? 'bg-[#f2572c] border-[#f2572c] text-white' 
                    : 'bg-white/90 border-gray-300 hover:border-[#f2572c]'
                }`}
                data-testid={`checkbox-select-${file.id}`}
              >
                {isFileSelected && <Check className="h-4 w-4" />}
              </div>
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
                  {!isReadOnly && (
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
                  )}
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
                  {!isReadOnly && (
                    <>
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
                          setFileToDelete(file);
                          setShowDeleteFileConfirm(true);
                        }}
                        className="text-red-600 focus:text-red-600"
                        data-testid={`menuitem-delete-file-${file.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete File
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ) : isVideo(file.mimeType) ? (
          <div 
            className="relative aspect-square cursor-pointer group"
            onClick={() => handleVideoClick(file.downloadUrl, file.originalName, folderFiles)}
          >
            <VideoThumbnail
              videoUrl={file.downloadUrl}
              alt={file.originalName}
              className="w-full h-full"
              showPlayIcon={true}
            />
            <div className="absolute top-2 right-2 z-10">
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

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = foldersToShow.findIndex((folder) => folder.uniqueKey === active.id);
    const newIndex = foldersToShow.findIndex((folder) => folder.uniqueKey === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      console.warn('[FileGallery] Could not find folder indices:', { activeId: active.id, overId: over.id, oldIndex, newIndex, foldersToShow: foldersToShow.map(f => f.uniqueKey) });
      return;
    }

    const reorderedFolders = arrayMove(foldersToShow, oldIndex, newIndex);
    
    // Update displayOrder for the reordered folders (only the ones being displayed)
    const foldersWithOrder = reorderedFolders.map((folder, index) => ({
      uniqueKey: folder.uniqueKey,
      displayOrder: index + 1,
    }));

    console.log('[FileGallery] Updating folder order:', {
      oldIndex,
      newIndex,
      reorderedCount: reorderedFolders.length,
      foldersWithOrder: foldersWithOrder.map(f => ({ uniqueKey: f.uniqueKey, displayOrder: f.displayOrder }))
    });

    // Optimistic UI update: reorder folders in the React Query cache immediately
    if (Array.isArray(foldersData)) {
      const rootKeys = new Set(reorderedFolders.map(f => f.uniqueKey));

      const nonRootFolders = foldersData.filter(folder => !rootKeys.has(folder.uniqueKey));

      const reorderedFull = [
        ...reorderedFolders.map(folder => {
          const match = foldersWithOrder.find(f => f.uniqueKey === folder.uniqueKey);
          return match ? { ...folder, displayOrder: match.displayOrder } : folder;
        }),
        ...nonRootFolders,
      ];

      queryClient.setQueryData<FolderData[]>(['/api/jobs', jobId, 'folders'], reorderedFull);
    }

    // Persist the new order to the backend
    updateFolderOrderMutation.mutate(foldersWithOrder);
  };


  const handleToggleVisibility = (folder: FolderData, isVisible: boolean) => {
    const key = getFolderKey(folder);
    console.log('[FileGallery] Toggling visibility:', {
      folder: folder.editorFolderName,
      folderPath: folder.folderPath,
      folderToken: folder.folderToken,
      orderId: folder.orderId,
      uniqueKey: folder.uniqueKey,
      computedKey: key,
      isVisible
    });
    if (!key) {
      console.error('[FileGallery] No key found for folder:', folder);
      return;
    }
    setPendingFolderKey(key);
    updateFolderVisibilityMutation.mutate({
      folderPath: folder.folderPath,
      folderToken: folder.folderToken,
      orderId: folder.orderId ?? null,
      isVisible,
      uniqueKey: key
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with view toggle and add folder button */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-normal text-foreground">Folders</h3>
        
        {!isReadOnly && (
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
        )}
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
                    setFolderHierarchy([]);
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
                      } else if (showFolderContent && folderHierarchy.length > 0) {
                        // Navigate to a parent folder in the hierarchy
                        const targetFolderIndex = index - 1; // Subtract 1 because "All Folders" is at index 0
                        const targetFolder = folderHierarchy[targetFolderIndex];
                        const newHierarchy = folderHierarchy.slice(0, targetFolderIndex + 1);
                        setFolderHierarchy(newHierarchy);
                        setSelectedFolderData(targetFolder);
                      } else if (showFolderContent) {
                        // Go back to folder list
                        setShowFolderContent(false);
                        setSelectedFolderData(null);
                        setFolderHierarchy([]);
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

      {showFolderContent && selectedFolderData ? (() => {
          // Filter out deleted files for instant UI update
          const filteredFiles = selectedFolderData.files.filter(file => !deletedFileIds.has(file.id));
          const filteredFolderData = {
            ...selectedFolderData,
            files: filteredFiles,
            fileCount: filteredFiles.length
          };

          return (
          // Folder Content View
          <div className="space-y-6">
            {/* Folder Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Folder className="h-6 w-6 text-blue-600" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {filteredFolderData.partnerFolderName || filteredFolderData.editorFolderName}
                  </h2>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>{filteredFolderData.fileCount} {filteredFolderData.fileCount === 1 ? 'file' : 'files'}</span>
                    {(selectedFolderData.orderId || selectedFolderData.orderNumber) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOrderClick(selectedFolderData.orderId);
                        }}
                        className="text-sm font-semibold text-rpp-red-main hover:text-rpp-orange hover:underline cursor-pointer transition-colors"
                      >
                        {selectedFolderData.orderNumber ? formatOrderNumber(selectedFolderData.orderNumber) : `Order: ${selectedFolderData.orderId}`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {!isReadOnly && (
                <div className="flex space-x-2">
                  <Button
                    onClick={() => setShowUploadModal(true)}
                    className="hover:!bg-rpp-red-dark !text-white hover:shadow-lg transition-all !opacity-100 disabled:!opacity-60 disabled:cursor-not-allowed bg-[#f05a2a]"
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
              )}
            </div>

            {/* Subfolders Section */}
            {foldersData && foldersData.some(f => f.folderPath.startsWith(filteredFolderData.folderPath + '/')) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">Folders</h3>
                  <span className="text-xs text-gray-500">
                    {foldersData.filter(f => f.folderPath.startsWith(filteredFolderData.folderPath + '/')).length} folders
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {foldersData
                    .filter(f => f.folderPath.startsWith(filteredFolderData.folderPath + '/') && 
                                f.folderPath.split('/').length === filteredFolderData.folderPath.split('/').length + 1)
                    .map((subfolder) => (
                      <div
                        key={subfolder.uniqueKey}
                        className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border hover:bg-blue-100 transition-colors group"
                      >
                        <Folder className="h-5 w-5 text-blue-600" />
                        <div 
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => handleEnterFolder(subfolder)}
                        >
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {subfolder.partnerFolderName || subfolder.editorFolderName || 'Folder'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {subfolder.fileCount} {subfolder.fileCount === 1 ? 'file' : 'files'}
                          </p>
                        </div>
                        {!isReadOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFolder(subfolder);
                            }}
                            data-testid={getFolderTestId('button-delete-subfolder', subfolder)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  {!isReadOnly && (
                    <Button
                      variant="outline"
                      className="h-full min-h-[70px] border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                      onClick={() => handleCreateFolder(filteredFolderData.folderPath)}
                    >
                      <div className="text-center">
                        <Plus className="h-5 w-5 mx-auto mb-1 text-gray-400" />
                        <span className="text-xs text-gray-500">New Folder</span>
                      </div>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Files Section */}
            {(() => {
              const visibleFiles = filteredFolderData.files.filter(file => 
                !file.fileName.startsWith('.') && 
                file.downloadUrl
              );

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
                  ) : !isReadOnly ? (
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
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No files in this folder</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          );
        })() : (
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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={foldersToShow.map(f => f.uniqueKey)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {foldersToShow.map((folder) => (
                      <SortableFolderItem
                        key={folder.uniqueKey}
                        folder={folder}
                        isReadOnly={isReadOnly}
                        folderVisibility={folderVisibility}
                        downloadingFolder={downloadingFolder}
                        onEnterFolder={handleEnterFolder}
                        onToggleVisibility={handleToggleVisibility}
                        onCreateSubfolder={handleCreateFolder}
                        onDownloadAll={handleDownloadAll}
                        onSelectAllImages={selectAllImagesInFolder}
                        areAllImagesSelected={areAllImagesSelectedInFolder}
                        onRenameFolder={handleRenameFolder}
                        onDeleteFolder={handleDeleteFolder}
                        getFolderKey={getFolderKey}
                        getFolderTestId={getFolderTestId}
                        formatOrderNumber={formatOrderNumber}
                        pendingFolderKey={pendingFolderKey}
                        onOrderClick={handleOrderClick}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        )}

      {/* Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-full w-screen h-screen p-0 bg-black border-0 shadow-none m-0 [&>button]:hidden">
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
                <div className="flex items-center justify-center gap-3 overflow-x-auto py-3 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                  {galleryImages.map((img, index) => (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex(index);
                        setSelectedImage(img.url);
                        setSelectedImageName(img.name);
                      }}
                      className={`flex-shrink-0 relative group transition-all duration-200 ease-out outline-none focus:outline-none focus:ring-0 border-0 ${
                        index === currentImageIndex 
                          ? 'scale-125 z-10' 
                          : 'opacity-60 hover:opacity-100 hover:scale-105'
                      }`}
                      data-testid={`thumbnail-${index}`}
                    >
                      <img
                        src={img.url}
                        alt={img.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Modal */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-full w-screen h-screen p-0 bg-black border-0 shadow-none m-0 [&>button]:hidden">
          {/* Dark Overlay Background */}
          <div className="absolute inset-0 bg-black" onClick={() => setSelectedVideo(null)} />
          
          <div className="relative h-full flex flex-col items-center justify-center p-8 z-10">
            {/* Close Button */}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setSelectedVideo(null)}
              className="absolute top-6 right-6 z-30 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white rounded-full h-10 w-10"
              data-testid="button-close-video"
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Top Controls */}
            <div className="absolute top-6 left-6 flex items-center space-x-3 z-20">
              {galleryVideos.length > 1 && (
                <div className="bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium">
                  {currentVideoIndex + 1} / {galleryVideos.length}
                </div>
              )}
              <Button
                size="sm"
                onClick={() => selectedVideo && handleDownload(selectedVideo, selectedVideoName)}
                className="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white border-0 rounded-full"
                data-testid="button-modal-download-video"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            {/* Main Video Container - Floating Effect */}
            <div className="relative flex-1 flex items-center justify-center w-full max-h-[calc(100%-180px)] mb-4">
              {/* Previous Arrow - Small */}
              {galleryVideos.length > 1 && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateVideo('prev');
                  }}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white rounded-full h-10 w-10 transition-all"
                  data-testid="button-prev-video"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}

              {/* Floating Video */}
              <div className="relative max-w-full max-h-full">
                <video
                  src={selectedVideo || ''}
                  controls
                  className="max-w-full max-h-[70vh] rounded-lg shadow-2xl shadow-black/50"
                  onClick={(e) => e.stopPropagation()}
                  autoPlay
                />
              </div>

              {/* Next Arrow - Small */}
              {galleryVideos.length > 1 && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateVideo('next');
                  }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white rounded-full h-10 w-10 transition-all"
                  data-testid="button-next-video"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              )}
            </div>

            {/* Thumbnail Carousel */}
            {galleryVideos.length > 1 && (
              <div className="w-full max-w-5xl px-4">
                <div className="flex items-center justify-center gap-3 overflow-x-auto py-3 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                  {galleryVideos.map((vid, index) => (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentVideoIndex(index);
                        setSelectedVideo(vid.url);
                        setSelectedVideoName(vid.name);
                      }}
                      className={`flex-shrink-0 relative group transition-all duration-200 ease-out outline-none focus:outline-none focus:ring-0 border-0 ${
                        index === currentVideoIndex 
                          ? 'scale-125 z-10' 
                          : 'opacity-60 hover:opacity-100 hover:scale-105'
                      }`}
                      data-testid={`video-thumbnail-${index}`}
                    >
                      <VideoThumbnail
                        videoUrl={vid.url}
                        alt={vid.name}
                        className="w-20 h-20 rounded-lg"
                        showPlayIcon={false}
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <Play className="h-6 w-6 text-white drop-shadow-lg" />
                      </div>
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

      {/* Partner File Upload Modal - Hidden for read-only users */}
      {showUploadModal && user && !isReadOnly && (
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
          uploadType="completed"
          folderToken={selectedFolderData?.folderToken} // Pass folder token for standalone folders
          folderPath={selectedFolderData?.folderPath} // Pass folder path
          hideFolderInput={!!selectedFolderData?.folderPath} // Hide folder input when uploading to existing folder
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
              const updatedFolder = updatedFolders?.find(f => f.uniqueKey === selectedFolderData.uniqueKey);
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

      {/* Download Progress Dialog */}
      <Dialog open={downloadProgress.isOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              {downloadProgress.stage === 'creating' && 'Creating Zip Folder...'}
              {downloadProgress.stage === 'downloading' && 'Downloading...'}
            </DialogTitle>
            <DialogDescription>
              {downloadProgress.stage === 'creating' && `Preparing ${downloadProgress.folderName} for download...`}
              {downloadProgress.stage === 'downloading' && `Downloading ${downloadProgress.folderName}...`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {downloadProgress.stage === 'creating' && (
              <>
                <Progress value={downloadProgress.progress} className="w-full" />
                <p className="text-sm text-gray-600 text-center">
                  Processing {downloadProgress.filesProcessed} / {downloadProgress.totalFiles} files
                </p>
              </>
            )}

            {downloadProgress.stage === 'downloading' && (
              <>
                <Progress value={downloadProgress.progress} className="w-full" />
                <p className="text-sm text-gray-600 text-center">
                  {formatBytes(downloadProgress.bytesReceived)} / {formatBytes(downloadProgress.totalBytes)}
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the folder "{folderToDelete?.folderName}" and all files in it.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteConfirm(false);
              setFolderToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteFolder}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete Folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete File Confirmation Dialog */}
      <AlertDialog open={showDeleteFileConfirm} onOpenChange={setShowDeleteFileConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the file "{fileToDelete?.originalName}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteFileConfirm(false);
              setFileToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (fileToDelete) {
                  deleteFileMutation.mutate({ 
                    fileId: fileToDelete.id,
                    downloadUrl: fileToDelete.downloadUrl 
                  });
                }
              }}
              disabled={deleteFileMutation.isPending}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              data-testid="button-confirm-delete-file"
            >
              {deleteFileMutation.isPending ? 'Deleting...' : 'Delete File'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Multi-select Floating Action Bar */}
      {selectedFileIds.size > 0 && (
        <Card className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 shadow-2xl animate-in slide-in-from-bottom-4">
          <div className="p-4 flex items-center gap-4">
            <Badge variant="secondary" className="border" data-testid="badge-selection-count">
              {selectedFileIds.size} {selectedFileIds.size === 1 ? 'image' : 'images'} selected
            </Badge>
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleDownloadSelected}
                disabled={isDownloadingSelected}
                className="bg-[#f2572c] hover:bg-[#d94a24] text-white rounded-lg"
                data-testid="button-download-selected"
              >
                {isDownloadingSelected ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {isDownloadingSelected ? 'Downloading...' : 'Download Selected'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFileSelection}
                className="rounded-lg"
                data-testid="button-clear-selection"
              >
                Clear
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Order Details Modal */}
      <OrderDetailsModal
        isOpen={isOrderDetailsOpen}
        onClose={handleCloseOrderDetails}
        order={orderDetails}
        onRequestRevision={handleRequestRevision}
        isLoading={isLoadingOrderDetails}
      />

      {/* Request Revision Modal */}
      {orderDetails && (
        <RequestRevisionModal
          isOpen={isRevisionModalOpen}
          onClose={handleCloseRevisionModal}
          orderNumber={orderDetails.orderNumber}
          services={orderDetails.services.map(s => ({ id: s.id, name: s.name }))}
          onSubmit={handleRevisionSubmit}
          isSubmitting={isSubmittingRevision}
        />
      )}
    </div>
  );
}