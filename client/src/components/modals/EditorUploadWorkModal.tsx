import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Upload, 
  Folder, 
  FolderPlus, 
  ChevronRight, 
  ChevronDown,
  X, 
  Check, 
  FileImage, 
  Video, 
  FileText, 
  AlertCircle,
  Loader2,
  Plus,
  RefreshCw
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadCompletedFileToFirebase, UploadProgress } from "@/lib/firebase-storage";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";

// Types
interface EditorJob {
  id: string;
  jobId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  address: string;
  services: Array<{
    id: string;
    name: string;
    quantity: number;
    instructions: string;
  }>;
  status: 'pending' | 'processing' | 'in_progress' | 'in_revision' | 'human_check' | 'completed' | 'cancelled';
  dueDate: string;
  createdAt: string;
  originalFiles: Array<{
    id: string;
    fileName: string;
    originalName: string;
    fileSize: number;
    mimeType: string;
    firebaseUrl: string;
    downloadUrl: string;
  }>;
  existingUploads: Array<any>;
  revisionNotes?: string;
}

interface FolderData {
  uniqueKey: string;
  folderPath: string;
  editorFolderName: string;
  partnerFolderName?: string;
  orderId?: string | null;
  orderNumber?: string;
  fileCount: number;
  files: Array<any>;
  folderToken?: string;
  isVisible?: boolean;
  displayOrder?: number;
}

interface FileUploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  targetFolder: string;
  url?: string;
  error?: string;
}

interface EditorUploadWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedJob?: EditorJob | null;
  jobs: EditorJob[];
  onUploadComplete: (jobId: string, uploads: any[]) => void;
}

// Get folder depth from path
function getFolderDepth(path: string): number {
  return path.split('/').filter(Boolean).length;
}

// Format folder display name - handles tokens and paths
function formatFolderDisplayName(name: string | undefined, folderPath?: string): string {
  // Helper to check if a string looks like a token (random alphanumeric, typically 10+ chars)
  const looksLikeToken = (str: string) => {
    if (!str) return false;
    const isAlphanumericOnly = /^[a-zA-Z0-9_-]+$/.test(str);
    const hasNoSpaces = !str.includes(' ');
    const isLongEnough = str.length >= 10;
    const hasNoCommonWords = !/photo|image|video|floor|plan|virtual|tour|edit|raw|file|folder/i.test(str);
    return isAlphanumericOnly && hasNoSpaces && isLongEnough && hasNoCommonWords;
  };

  // If name is provided and doesn't look like a path or token, use it
  if (name && !name.includes('/') && !looksLikeToken(name)) {
    return name;
  }

  // If name looks like a token, try to find a better name from the path
  if (folderPath) {
    const segments = folderPath.split('/').filter(s => s && !looksLikeToken(s));
    if (segments.length > 0) {
      return segments[segments.length - 1];
    }
  }

  // If name looks like a token, return generic name
  if (name && looksLikeToken(name)) {
    return "Folder";
  }

  return name || "Folder";
}

export function EditorUploadWorkModal({
  isOpen,
  onClose,
  selectedJob: initialSelectedJob,
  jobs,
  onUploadComplete
}: EditorUploadWorkModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [uploadFiles, setUploadFiles] = useState<FileUploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [parentFolderPath, setParentFolderPath] = useState<string>("");
  const [previewFolder, setPreviewFolder] = useState<string | null>(null);
  
  // Filter jobs to only show processing and in_revision
  const uploadableJobs = useMemo(() => {
    return jobs.filter(job => 
      job.status === 'processing' || job.status === 'in_revision'
    );
  }, [jobs]);
  
  // Get selected job data
  const selectedJob = useMemo(() => {
    return uploadableJobs.find(job => job.jobId === selectedJobId) || null;
  }, [uploadableJobs, selectedJobId]);
  
  // Initialize with initial selected job
  useEffect(() => {
    if (initialSelectedJob && isOpen) {
      setSelectedJobId(initialSelectedJob.jobId);
    }
  }, [initialSelectedJob, isOpen]);
  
  // Fetch folders for selected job
  const { data: foldersData = [], isLoading: isFoldersLoading, refetch: refetchFolders } = useQuery<FolderData[]>({
    queryKey: ['/api/editor/jobs', selectedJobId, 'folders'],
    queryFn: async () => {
      if (!selectedJobId) return [];
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');
      const token = await user.getIdToken();
      
      const response = await fetch(`/api/editor/jobs/${selectedJobId}/folders`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        // If 404, return empty array (no folders yet)
        if (response.status === 404) return [];
        throw new Error('Failed to fetch folders');
      }
      
      return response.json();
    },
    enabled: !!selectedJobId && isOpen,
    staleTime: 0,
  });
  
  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async ({ folderName, parentPath, orderId }: { folderName: string; parentPath: string; orderId: string }) => {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');
      const token = await user.getIdToken();
      
      const fullPath = parentPath ? `${parentPath}/${folderName}` : folderName;
      
      const response = await fetch(`/api/editor/jobs/${selectedJobId}/folders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          editorFolderName: folderName,
          folderPath: fullPath,
          parentFolderPath: parentPath || undefined,
          orderId: orderId // Associate folder with the specific order
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create folder');
      }
      
      return response.json();
    },
    onSuccess: () => {
      refetchFolders();
      setShowCreateFolder(false);
      setNewFolderName("");
      setParentFolderPath("");
      toast({
        title: "Folder created",
        description: "New folder has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create folder.",
        variant: "destructive"
      });
    }
  });
  
  // Handle folder toggle
  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };
  
  // Handle folder selection for upload (single select)
  const selectFolder = (folderPath: string) => {
    setSelectedFolder(prev => prev === folderPath ? null : folderPath);
  };
  
  // Handle file drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/') || 
      file.type.startsWith('video/') ||
      file.name.toLowerCase().endsWith('.dng') ||
      file.name.toLowerCase().endsWith('.psd')
    );
    
    addFiles(files);
  };
  
  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addFiles(files);
    }
  };
  
  // Add files to upload list
  const addFiles = (files: File[]) => {
    const targetFolder = selectedFolder || "";
    
    const newItems: FileUploadItem[] = files.map((file, index) => ({
      id: `upload_${Date.now()}_${index}`,
      file,
      progress: 0,
      status: 'pending' as const,
      targetFolder: targetFolder
    }));
    
    setUploadFiles(prev => [...prev, ...newItems]);
  };
  
  // Remove file from list
  const removeFile = (fileId: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId));
  };
  
  // Start upload process
  const handleStartUpload = async () => {
    if (!selectedJob || uploadFiles.length === 0) return;
    
    // Check that a folder is selected
    if (!selectedFolder) {
      toast({
        title: "Folder Required",
        description: "Please select a folder before uploading files.",
        variant: "destructive"
      });
      return;
    }
    
    // Check all files have a target folder
    const filesWithoutFolder = uploadFiles.filter(f => !f.targetFolder);
    if (filesWithoutFolder.length > 0) {
      toast({
        title: "Folder Required",
        description: "Please select a folder before adding files.",
        variant: "destructive"
      });
      return;
    }
    
    setIsUploading(true);
    const completedUploads: any[] = [];
    
    // Get the folderToken from the selected folder to associate uploads with existing folder
    const selectedFolderData = foldersData.find(f => f.folderPath === selectedFolder);
    const folderToken = selectedFolderData?.folderToken;
    
    for (const uploadFile of uploadFiles) {
      try {
        // Update status to uploading
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { ...f, status: 'uploading' as const } : f
        ));
        
        // Upload file
        const result = await uploadCompletedFileToFirebase(
          uploadFile.file,
          selectedJob.jobId,
          selectedJob.orderNumber,
          (progress: UploadProgress) => {
            setUploadFiles(prev => prev.map(f => 
              f.id === uploadFile.id ? { 
                ...f, 
                progress: progress.progress,
                status: progress.status === 'completed' ? 'completed' : 'uploading',
                url: progress.url
              } : f
            ));
          },
          {
            folderPath: uploadFile.targetFolder,
            editorFolderName: uploadFile.targetFolder.split('/').pop() || uploadFile.targetFolder,
            folderToken: folderToken
          }
        );
        
        completedUploads.push({
          file: uploadFile.file,
          url: result.url,
          path: result.path,
          folderPath: uploadFile.targetFolder
        });
        
        // Update status to completed
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { ...f, status: 'completed' as const, url: result.url } : f
        ));
        
      } catch (error: any) {
        console.error(`Upload failed for ${uploadFile.file.name}:`, error);
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { 
            ...f, 
            status: 'error' as const, 
            error: error.message || 'Upload failed' 
          } : f
        ));
      }
    }
    
    setIsUploading(false);
    
    if (completedUploads.length > 0) {
      // Notify parent of completed uploads
      onUploadComplete(selectedJob.jobId, completedUploads);
      
      // Refresh folders to show new file counts
      refetchFolders();
      
      toast({
        title: "Upload Complete",
        description: `${completedUploads.length} file(s) uploaded successfully.`,
      });
    }
  };
  
  // Handle modal close
  const handleClose = () => {
    setUploadFiles([]);
    setSelectedJobId("");
    setSelectedFolder(null);
    setExpandedFolders(new Set());
    setShowCreateFolder(false);
    setNewFolderName("");
    setParentFolderPath("");
    setPreviewFolder(null);
    onClose();
  };
  
  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Get file icon based on type
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <FileImage className="w-4 h-4 text-semantic-blue" />;
    if (type.startsWith('video/')) return <Video className="w-4 h-4 text-semantic-purple" />;
    return <FileText className="w-4 h-4 text-rpp-grey" />;
  };
  
  // Render folder tree item
  const renderFolderItem = (folder: FolderData, depth: number = 0) => {
    const hasChildren = foldersData.some(f => 
      f.folderPath.startsWith(folder.folderPath + '/') && 
      getFolderDepth(f.folderPath) === getFolderDepth(folder.folderPath) + 1
    );
    const isExpanded = expandedFolders.has(folder.folderPath);
    const isSelected = selectedFolder === folder.folderPath;
    const isPreviewed = previewFolder === folder.folderPath;
    
    const childFolders = foldersData.filter(f => 
      f.folderPath.startsWith(folder.folderPath + '/') && 
      getFolderDepth(f.folderPath) === getFolderDepth(folder.folderPath) + 1
    );
    
    return (
      <div key={folder.uniqueKey}>
        <div 
          className={`flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer hover:bg-rpp-grey-lightest ${isSelected ? 'bg-semantic-blue-light' : ''} ${isPreviewed ? 'ring-2 ring-rpp-orange ring-inset' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {/* Expand/Collapse button */}
          <button
            onClick={() => toggleFolder(folder.folderPath)}
            className="w-5 h-5 flex items-center justify-center text-rpp-grey-light hover:text-rpp-grey-dark"
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
            ) : <span className="w-4" />}
          </button>
          
          {/* Radio-style selection indicator */}
          <button
            onClick={() => selectFolder(folder.folderPath)}
            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
              isSelected 
                ? 'border-semantic-blue bg-semantic-blue' 
                : 'border-rpp-grey-lighter hover:border-rpp-grey'
            }`}
            title="Select folder for upload"
          >
            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
          </button>
          
          {/* Folder icon and name - clickable to show preview */}
          <button
            onClick={() => setPreviewFolder(isPreviewed ? null : folder.folderPath)}
            className="flex items-center gap-2 flex-1 min-w-0 text-left hover:text-rpp-orange transition-colors"
            title="Click to preview folder contents"
          >
            <Folder className={`w-4 h-4 flex-shrink-0 ${isPreviewed ? 'text-rpp-orange' : isSelected ? 'text-semantic-blue' : 'text-rpp-grey'}`} />
            <span className={`text-sm truncate ${isPreviewed ? 'text-rpp-orange font-medium' : isSelected ? 'text-semantic-blue font-medium' : 'text-rpp-grey-darkest'}`}>
              {formatFolderDisplayName(folder.editorFolderName || folder.partnerFolderName, folder.folderPath)}
            </span>
          </button>
          
          {/* File count badge */}
          <Badge variant="secondary" className="text-xs flex-shrink-0">
            {folder.fileCount} files
          </Badge>
          
          {/* Add subfolder button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setParentFolderPath(folder.folderPath);
              setShowCreateFolder(true);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rpp-grey-lighter rounded flex-shrink-0"
            title="Add subfolder"
          >
            <FolderPlus className="w-4 h-4 text-rpp-grey" />
          </button>
        </div>
        
        {/* Child folders */}
        {isExpanded && childFolders.map(child => renderFolderItem(child, depth + 1))}
      </div>
    );
  };
  
  // Get root folders
  // Root folders are either:
  // 1. Paths without any slash (e.g., "MyFolder")
  // 2. Paths in format "folders/TOKEN" (exactly one slash after "folders/")
  const rootFolders = useMemo(() => {
    return foldersData.filter(f => {
      const path = f.folderPath;
      // No slash = root folder
      if (!path.includes('/')) return true;
      // "folders/TOKEN" format = root folder (one component after "folders/")
      if (path.startsWith('folders/') && !path.substring(8).includes('/')) return true;
      return false;
    });
  }, [foldersData]);
  
  // Get the folder data for the preview folder
  const previewFolderData = useMemo(() => {
    if (!previewFolder) return null;
    return foldersData.find(f => f.folderPath === previewFolder) || null;
  }, [previewFolder, foldersData]);
  
  // Check if all uploads are complete
  const allUploadsComplete = uploadFiles.length > 0 && uploadFiles.every(f => f.status === 'completed');
  const hasErrors = uploadFiles.some(f => f.status === 'error');
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-rpp-grey-lighter">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Upload className="w-5 h-5 text-rpp-orange" />
            Upload Completed Work
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col lg:flex-row h-[calc(90vh-140px)]">
          {/* Left Panel - Job Selection & Folder Tree */}
          <div className="w-full lg:w-1/3 border-r border-rpp-grey-lighter p-4 flex flex-col">
            {/* Job Selection */}
            <div className="mb-4">
              <label className="text-sm font-medium text-rpp-grey-darkest mb-2 block">
                Select Job
              </label>
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a job..." />
                </SelectTrigger>
                <SelectContent>
                  {uploadableJobs.map((job) => (
                    <SelectItem key={job.jobId} value={job.jobId}>
                      <div className="flex items-center gap-2">
                        <span>{job.orderNumber}</span>
                        {job.status === 'in_revision' && (
                          <Badge className="bg-rpp-orange text-white text-xs">
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Revision
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedJob && (
                <div className="mt-3 p-3 bg-rpp-grey-lightest rounded-lg text-sm">
                  <p className="font-medium text-rpp-grey-darkest">{selectedJob.customerName}</p>
                  <p className="text-rpp-grey truncate">{selectedJob.address}</p>
                  {selectedJob.status === 'in_revision' && selectedJob.revisionNotes && (
                    <div className="mt-2 p-2 bg-rpp-orange-subtle text-rpp-orange rounded text-xs">
                      <strong>Revision Notes:</strong> {selectedJob.revisionNotes}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Folder Tree */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-rpp-grey-darkest">
                  Folders
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setParentFolderPath("");
                    setShowCreateFolder(true);
                  }}
                  disabled={!selectedJobId}
                  className="h-7 text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  New Folder
                </Button>
              </div>
              
              {/* Create Folder Form */}
              {showCreateFolder && (
                <div className="mb-3 p-3 bg-rpp-grey-lightest rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Folder name..."
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  {parentFolderPath && (
                    <p className="text-xs text-rpp-grey">
                      Creating in: <span className="font-medium">{parentFolderPath}</span>
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => createFolderMutation.mutate({ 
                        folderName: newFolderName, 
                        parentPath: parentFolderPath,
                        orderId: selectedJob?.orderId || ''
                      })}
                      disabled={!newFolderName.trim() || createFolderMutation.isPending || !selectedJob}
                      className="h-7 text-xs bg-rpp-orange hover:bg-rpp-orange/90"
                    >
                      {createFolderMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        "Create"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowCreateFolder(false);
                        setNewFolderName("");
                        setParentFolderPath("");
                      }}
                      className="h-7 text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              
              <ScrollArea className={`${previewFolderData ? 'h-32' : 'flex-1'}`}>
                {isFoldersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-rpp-grey-light" />
                  </div>
                ) : foldersData.length === 0 ? (
                  <div className="text-center py-8 text-sm text-rpp-grey-light">
                    {selectedJobId ? (
                      <>
                        <Folder className="w-8 h-8 mx-auto mb-2 text-rpp-grey-lighter" />
                        <p>No folders yet</p>
                        <p className="text-xs mt-1">Create a folder to organize your uploads</p>
                      </>
                    ) : (
                      <p>Select a job to view folders</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1 group">
                    {rootFolders.map(folder => renderFolderItem(folder, 0))}
                  </div>
                )}
              </ScrollArea>
              
              {/* Folder Preview Section */}
              {previewFolderData && (
                <div className="mt-3 border-t border-rpp-grey-lighter pt-3 flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Folder className="w-4 h-4 text-rpp-orange" />
                      <span className="text-sm font-medium text-rpp-grey-darkest truncate">
                        {formatFolderDisplayName(previewFolderData.editorFolderName || previewFolderData.partnerFolderName, previewFolderData.folderPath)}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {previewFolderData.fileCount} files
                      </Badge>
                    </div>
                    <button
                      onClick={() => setPreviewFolder(null)}
                      className="p-1 hover:bg-rpp-grey-lighter rounded text-rpp-grey-light hover:text-rpp-grey-dark"
                      title="Close preview"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <ScrollArea className="flex-1">
                    {previewFolderData.files && previewFolderData.files.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2 pb-2">
                        {previewFolderData.files.map((file: any, index: number) => {
                          const isImage = file.mimeType?.startsWith('image/');
                          const isVideo = file.mimeType?.startsWith('video/');
                          
                          return (
                            <div 
                              key={file.id || index}
                              className="relative aspect-square rounded-lg overflow-hidden bg-rpp-grey-lightest border border-rpp-grey-lighter group/thumb"
                              title={file.originalName || file.fileName}
                            >
                              {isImage && file.downloadUrl ? (
                                <img
                                  src={file.downloadUrl}
                                  alt={file.originalName || file.fileName}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    // Replace with placeholder on error
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                              ) : isVideo ? (
                                <div className="w-full h-full flex items-center justify-center bg-rpp-grey-lighter">
                                  <div className="relative">
                                    <Video className="w-8 h-8 text-semantic-purple" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <div className="w-3 h-3 bg-white rounded-full opacity-80" />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <FileText className="w-8 h-8 text-rpp-grey-light" />
                                </div>
                              )}
                              {/* Error fallback for images */}
                              {isImage && (
                                <div className="hidden w-full h-full flex items-center justify-center">
                                  <FileImage className="w-8 h-8 text-rpp-grey-light" />
                                </div>
                              )}
                              {/* File name overlay on hover */}
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                                <p className="text-[10px] text-white truncate">
                                  {file.originalName || file.fileName}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-xs text-rpp-grey-light">
                        <FileText className="w-6 h-6 mx-auto mb-1 text-rpp-grey-lighter" />
                        <p>No files in this folder</p>
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}
              
              {selectedFolder && (
                <div className="mt-2 p-2 bg-semantic-blue-light rounded-lg text-xs text-semantic-blue flex items-center gap-2">
                  <Folder className="w-4 h-4" />
                  Uploading to: <span className="font-medium">{selectedFolder.split('/').pop()}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Right Panel - File Upload */}
          <div className="flex-1 p-4 flex flex-col">
            {/* Drag & Drop Area */}
            <div
              onDrop={selectedFolder ? handleDrop : (e) => e.preventDefault()}
              onDragOver={(e) => { e.preventDefault(); if (selectedFolder) setIsDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors mb-4 ${
                isDragOver && selectedFolder
                  ? 'border-rpp-orange bg-rpp-orange-subtle' 
                  : 'border-rpp-grey-lighter hover:border-rpp-orange'
              } ${!selectedJobId || !selectedFolder ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="w-12 h-12 bg-rpp-orange-subtle rounded-full flex items-center justify-center mx-auto mb-3">
                <Upload className="w-6 h-6 text-rpp-orange" />
              </div>
              <p className="text-rpp-grey-darkest font-medium mb-1">
                {!selectedFolder ? 'Select a folder first' : 'Drag and drop files here'}
              </p>
              <p className="text-sm text-rpp-grey mb-3">
                {!selectedFolder ? 'Choose a folder on the left to upload files to' : 'Images, videos, PSD, and DNG files supported'}
              </p>
              <input
                type="file"
                multiple
                accept="image/*,video/*,.psd,.dng,.DNG"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload-editor-modal"
                disabled={!selectedJobId || !selectedFolder || isUploading}
              />
              <label htmlFor="file-upload-editor-modal">
                <Button variant="outline" asChild disabled={!selectedJobId || !selectedFolder}>
                  <span>Browse Files</span>
                </Button>
              </label>
            </div>
            
            {/* File List */}
            <ScrollArea className="flex-1">
              {uploadFiles.length === 0 ? (
                <div className="text-center py-8 text-rpp-grey-light text-sm">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-rpp-grey-lighter" />
                  <p>No files selected</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {uploadFiles.map((item) => (
                    <div 
                      key={item.id} 
                      className="flex items-center gap-3 p-3 bg-rpp-grey-lightest rounded-lg"
                    >
                      {/* File icon */}
                      {getFileIcon(item.file.type)}
                      
                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-rpp-grey-darkest truncate">
                          {item.file.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-rpp-grey">
                          <span>{formatFileSize(item.file.size)}</span>
                          {item.status === 'uploading' && (
                            <span>{Math.round(item.progress)}%</span>
                          )}
                          {item.status === 'completed' && (
                            <span className="text-semantic-green flex items-center gap-1">
                              <Check className="w-3 h-3" /> Complete
                            </span>
                          )}
                          {item.status === 'error' && (
                            <span className="text-semantic-red flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> {item.error || 'Failed'}
                            </span>
                          )}
                        </div>
                        {item.status === 'uploading' && (
                          <Progress value={item.progress} className="h-1 mt-1" />
                        )}
                      </div>
                      
                      {/* Folder badge (static, based on selected folder at time of adding) */}
                      <div className="flex items-center gap-1 px-2 py-1 bg-rpp-grey-lighter rounded text-xs flex-shrink-0">
                        <Folder className="w-3 h-3 text-rpp-orange" />
                        <span className="truncate max-w-[120px]">
                          {item.targetFolder ? item.targetFolder.split('/').pop() : 'No folder'}
                        </span>
                      </div>
                      
                      {/* Remove button */}
                      {item.status === 'pending' && !isUploading && (
                        <button
                          onClick={() => removeFile(item.id)}
                          className="p-1 hover:bg-rpp-grey-lighter rounded text-rpp-grey-light hover:text-semantic-red"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            
            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-rpp-grey-lighter mt-4">
              <div className="text-sm text-rpp-grey">
                {uploadFiles.length > 0 && (
                  <span>{uploadFiles.filter(f => f.status === 'completed').length} / {uploadFiles.length} uploaded</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} disabled={isUploading}>
                  {allUploadsComplete ? 'Done' : 'Cancel'}
                </Button>
                {!allUploadsComplete && (
                  <Button
                    onClick={handleStartUpload}
                    disabled={
                      !selectedJobId || 
                      uploadFiles.length === 0 || 
                      isUploading ||
                      !selectedFolder ||
                      uploadFiles.some(f => !f.targetFolder)
                    }
                    className="bg-rpp-orange hover:bg-rpp-orange/90"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Start Upload
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
