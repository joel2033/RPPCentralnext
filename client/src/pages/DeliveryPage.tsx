import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Download,
  CheckCircle2,
  ImageIcon,
  Video,
  MapPin,
  Calendar,
  MessageSquare,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  Send,
  Star,
  Play,
  Loader2,
  Folder
} from "lucide-react";
import { format } from "date-fns";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { VideoThumbnail } from "@/components/VideoThumbnail";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRealtimeFolders } from "@/hooks/useFirestoreRealtime";

interface DeliveryFile {
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
  commentCount?: number;
}

interface DeliveryFolder {
  folderPath: string;
  editorFolderName: string;
  partnerFolderName?: string;
  orderId?: string | null;
  orderNumber: string;
  fileCount: number;
  files: DeliveryFile[];
  folderToken?: string;
  uniqueKey?: string;
  isVisible?: boolean;
  displayOrder?: number;
}

interface DeliveryPageData {
  job: {
    id: string;
    jobId: string;
    address: string;
    status?: string;
    appointmentDate?: string;
    propertyImage?: string;
    customer?: {
      firstName: string;
      lastName: string;
      company?: string;
    };
  };
  completedFiles: Array<{
    orderId: string;
    orderNumber: string;
    files: DeliveryFile[];
  }>;
  folders?: DeliveryFolder[];
  revisionStatus?: Array<{
    orderId: string;
    maxRounds: number;
    usedRounds: number;
    remainingRounds: number;
  }>;
  jobReview?: {
    id: string;
    jobId: string;
    rating: number;
    review?: string;
    submittedBy: string;
    submittedByEmail: string;
    createdAt: string;
  };
  branding?: {
    businessName: string;
    logoUrl: string;
  };
}

interface FileComment {
  id: string;
  fileId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  message: string;
  createdAt: string;
  status?: string;
}

export default function DeliveryPage() {
  const params = useParams();
  const token = params.token;
  const { currentUser, loading: authLoading } = useAuth();
  
  const [scrolled, setScrolled] = useState(false);
  const [showQuickNav, setShowQuickNav] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedMediaForModal, setSelectedMediaForModal] = useState<DeliveryFile | null>(null);
  const [showRevisionRequest, setShowRevisionRequest] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [revisionSuccess, setRevisionSuccess] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const lastScrollY = useRef(0);
  const rafId = useRef<number | null>(null);
  const showQuickNavRef = useRef(false);

  // Subfolder viewing state
  const [viewingSubfolder, setViewingSubfolder] = useState<string | null>(null);

  // Download progress state
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

  // Track which credential type we're using (jobId for preview, deliveryToken for public)
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  // Force re-render when real-time folders change
  const [realtimeUpdateTrigger, setRealtimeUpdateTrigger] = useState(0);

  // Video player state
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedVideoName, setSelectedVideoName] = useState<string>('');
  const [galleryVideos, setGalleryVideos] = useState<Array<{ url: string; name: string }>>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number>(0);
  
  // Try authenticated preview first (if logged in), then fall back to public delivery endpoint
  const { data: deliveryData, isLoading, error } = useQuery<DeliveryPageData>({
    queryKey: [`/api/delivery/${token}`, currentUser?.uid],
    queryFn: async () => {
      // If user is authenticated, try the preview endpoint first
      if (currentUser) {
        try {
          const idToken = await currentUser.getIdToken();
          const previewResponse = await fetch(`/api/jobs/${token}/preview`, {
            credentials: 'include',
            headers: {
              'Authorization': `Bearer ${idToken}`,
            },
          });

          // Only fall back on 404 (token is deliveryToken, not jobId)
          // Don't fall back on 403 (token is jobId but not owned by this partner)
          if (previewResponse.ok) {
            setIsPreviewMode(true);
            const data = await previewResponse.json();
            console.log('[DEBUG] Preview response:', { hasJobReview: !!data.jobReview, jobReview: data.jobReview });
            return data;
          }

          // For non-404 errors, fall through silently to delivery endpoint
          // This prevents error flash during fallback
          if (previewResponse.status !== 404 && previewResponse.status !== 403) {
            // Try delivery endpoint as fallback
          }
          // Fall through to delivery endpoint on 404 or 403
        } catch (error: any) {
          // Silently fall through to delivery endpoint on any error
        }
      }

      // Try public delivery endpoint (works for both authenticated and unauthenticated users)
      setIsPreviewMode(false);
      const deliveryResponse = await fetch(`/api/delivery/${token}`);
      if (!deliveryResponse.ok) {
        throw new Error('Delivery not found');
      }
      const data = await deliveryResponse.json();
      console.log('[DEBUG] Delivery response:', { hasJobReview: !!data.jobReview, jobReview: data.jobReview });
      return data;
    },
    enabled: !!token && !authLoading,
    retry: false, // Don't retry on error to prevent flash
  });

  // File comments query - use appropriate endpoint based on preview mode
  const fileCommentsEndpoint = isPreviewMode
    ? `/api/jobs/${token}/files/${selectedMediaForModal?.id}/comments`
    : `/api/delivery/${token}/files/${selectedMediaForModal?.id}/comments`;
    
  const { data: fileComments = [] } = useQuery<FileComment[]>({
    queryKey: [fileCommentsEndpoint, currentUser?.uid],
    queryFn: async () => {
      if (isPreviewMode && currentUser) {
        const idToken = await currentUser.getIdToken();
        const response = await fetch(fileCommentsEndpoint, {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });
        if (!response.ok) throw new Error('Failed to fetch comments');
        return response.json();
      }
      // Public delivery endpoint
      const response = await fetch(fileCommentsEndpoint);
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
    enabled: !!token && !!selectedMediaForModal && !authLoading,
  });

  const jobDocumentId = deliveryData?.job?.id ?? null;
  const { folders: realtimeFolders } = useRealtimeFolders(jobDocumentId);
  const lastFoldersSignature = useRef<string | null>(null);

  useEffect(() => {
    lastFoldersSignature.current = null;
  }, [jobDocumentId]);

  // Real-time folders will automatically update via memoized values (realtimeVisibilityMap, effectiveFolders, visibleFolders)
  // Force a re-render when real-time folders change by updating a state variable
  
  useEffect(() => {
    if (!jobDocumentId) return;
    if (!Array.isArray(realtimeFolders)) return;

    // Just log for debugging - the memoized values will handle the updates
    const signature = JSON.stringify(
      realtimeFolders.map(folder => ({
        uniqueKey: folder.uniqueKey || null,
        isVisible: typeof folder.isVisible === "boolean" ? folder.isVisible : true,
      }))
    );

    if (lastFoldersSignature.current === null) {
      lastFoldersSignature.current = signature;
      return;
    }

    if (lastFoldersSignature.current !== signature) {
      lastFoldersSignature.current = signature;
      console.log('[DeliveryPage] Real-time folder visibility changed, triggering update');
      // Force a re-render by updating state
      setRealtimeUpdateTrigger(prev => prev + 1);
      // The memoized values (realtimeVisibilityMap, effectiveFolders, visibleFolders) will automatically update
    }
  }, [realtimeFolders, jobDocumentId]);

  // Initialize review form from existing review data
  useEffect(() => {
    if (deliveryData?.jobReview && !reviewSubmitted) {
      console.log('[DEBUG] Job review data:', deliveryData.jobReview);
      setRating(deliveryData.jobReview.rating);
      setReviewText(deliveryData.jobReview.review || "");
    } else {
      console.log('[DEBUG] No job review data:', {
        hasJobReview: !!deliveryData?.jobReview,
        reviewSubmitted,
        deliveryData: deliveryData ? 'exists' : 'null'
      });
    }
  }, [deliveryData?.jobReview, reviewSubmitted, deliveryData]);

  // Scroll detection for sticky header - optimized to prevent pulsing
  useEffect(() => {
    const handleScroll = () => {
      // Cancel any pending animation frame
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }

      // Schedule update for next animation frame to batch updates
      rafId.current = requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const scrollDelta = currentScrollY - lastScrollY.current;
        setScrolled(currentScrollY > 50);
        
        // Improved logic with hysteresis to prevent rapid toggling
        // Show when scrolling up past 400px, hide when scrolling down past 350px
        const shouldShow = currentScrollY > 400 && scrollDelta < 0;
        const shouldHide = currentScrollY < 350 || (scrollDelta > 0 && currentScrollY > 400);
        
        // Only update state if value actually changed
        if (shouldShow && !showQuickNavRef.current) {
          showQuickNavRef.current = true;
          setShowQuickNav(true);
        } else if (shouldHide && showQuickNavRef.current) {
          showQuickNavRef.current = false;
          setShowQuickNav(false);
        }
        
        lastScrollY.current = currentScrollY;
        rafId.current = null;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  // Organize files into folders
  const jobKeyBase = deliveryData?.job?.id || deliveryData?.job?.jobId || "job";

  const getFolderKey = useCallback((folder: { uniqueKey?: string | null; folderToken?: string | null; orderId?: string | null; folderPath?: string | null }) => {
    if (!folder) return '';
    // Always use uniqueKey if available (from backend)
    if (folder.uniqueKey) return folder.uniqueKey;
    // Fallback to building key if uniqueKey not available
    if (folder.folderToken) return `${jobKeyBase}::token::${folder.folderToken}`;
    if (folder.orderId && folder.folderPath) return `${jobKeyBase}::order::${folder.orderId}::${folder.folderPath}`;
    if (folder.folderPath) return `${jobKeyBase}::path::${folder.folderPath}`;
    return `${jobKeyBase}::legacy`;
  }, [jobKeyBase]);

  const rawFolders = deliveryData?.folders || (() => {
    if (!deliveryData?.completedFiles) return [];

    const folderMap = new Map<string, DeliveryFolder>();
    const pathCounters = new Map<string, number>();

    deliveryData.completedFiles.forEach((order) => {
      order.files.forEach((file) => {
        const folderPath = file.folderPath || "All Files";
        if (!folderMap.has(folderPath)) {
          const parsedToken =
            folderPath.includes("folders/") ? folderPath.split("/").pop() : undefined;
          const baseProps = {
            folderToken: parsedToken,
            orderId: order.orderId,
            folderPath,
          };
          let uniqueKey = getFolderKey(baseProps);
          if (uniqueKey.startsWith(`${jobKeyBase}::path::`)) {
            const count = pathCounters.get(folderPath) ?? 0;
            pathCounters.set(folderPath, count + 1);
            uniqueKey = `${uniqueKey}::${count}`;
          }

          folderMap.set(folderPath, {
            folderPath,
            editorFolderName: file.editorFolderName || folderPath,
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            fileCount: 0,
            files: [],
            folderToken: parsedToken,
            uniqueKey,
            isVisible: true,
          });
        }
        const folder = folderMap.get(folderPath)!;
        folder.fileCount++;
        folder.files.push(file);
      });
    });

    return Array.from(folderMap.values());
  })();

  // Build a map of real-time folder visibility by uniqueKey
  // Real-time folders take precedence over rawFolders
  const realtimeVisibilityMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (Array.isArray(realtimeFolders)) {
      console.log('[DeliveryPage] Processing real-time folders:', realtimeFolders.map(f => ({
        uniqueKey: f.uniqueKey,
        folderPath: f.folderPath,
        folderToken: f.folderToken,
        orderId: f.orderId,
        isVisible: f.isVisible
      })));
      realtimeFolders.forEach(folder => {
        const key = getFolderKey(folder);
        if (!key) {
          console.warn('[DeliveryPage] Could not get key for real-time folder:', folder);
          return;
        }
        if (typeof folder.isVisible === "boolean") {
          map.set(key, folder.isVisible);
          console.log('[DeliveryPage] Set visibility for key:', key, 'to', folder.isVisible);
        }
      });
    }
    return map;
  }, [realtimeFolders, getFolderKey]);

  // Merge rawFolders with real-time visibility updates
  // Real-time visibility always takes precedence
  const effectiveFolders = useMemo(() => {
    if (!Array.isArray(rawFolders)) return [];
    return rawFolders.map(folder => {
      const key = getFolderKey(folder);
      // If we have real-time visibility data for this key, use it
      if (key && realtimeVisibilityMap.has(key)) {
        const realtimeVisible = realtimeVisibilityMap.get(key);
        console.log('[DeliveryPage] Merging real-time visibility for key:', key, 'value:', realtimeVisible, 'folder:', folder.editorFolderName);
        return {
          ...folder,
          isVisible: realtimeVisible,
        };
      }
      // Otherwise use the folder's own isVisible property, defaulting to true if not set
      return {
        ...folder,
        isVisible: folder.isVisible ?? true,
      };
    });
  }, [rawFolders, realtimeVisibilityMap, getFolderKey]);

  const hiddenFolderKeys = useMemo(() => {
    const hidden = new Set<string>();
    // Check effectiveFolders directly - they already have the merged visibility from real-time updates
    if (Array.isArray(effectiveFolders)) {
      effectiveFolders.forEach(folder => {
        const key = getFolderKey(folder);
        if (!key) return;
        // If isVisible is explicitly false, hide it
        if (folder.isVisible === false) {
          hidden.add(key);
          console.log('[DeliveryPage] Hiding folder with key:', key, 'folder:', folder.editorFolderName, 'isVisible:', folder.isVisible);
        }
      });
    }
    console.log('[DeliveryPage] hiddenFolderKeys:', Array.from(hidden));
    return hidden;
  }, [effectiveFolders, getFolderKey]);

  const visibleFolders = useMemo(() => {
    if (!Array.isArray(effectiveFolders)) return [];
    const visible = effectiveFolders.filter(folder => {
      const key = getFolderKey(folder);
      const isHidden = key && hiddenFolderKeys.has(key);
      if (isHidden) {
        console.log('[DeliveryPage] Filtering out hidden folder:', folder.editorFolderName, 'key:', key);
      }
      return key && !hiddenFolderKeys.has(key);
    });
    console.log('[DeliveryPage] visibleFolders count:', visible.length, 'out of', effectiveFolders.length);
    return visible;
  }, [effectiveFolders, hiddenFolderKeys, getFolderKey]);

  // Debug: Log when effectiveFolders changes
  useEffect(() => {
    console.log('[DeliveryPage] effectiveFolders updated:', effectiveFolders.map(f => ({
      folderPath: f.folderPath,
      editorFolderName: f.editorFolderName,
      uniqueKey: getFolderKey(f),
      isVisible: f.isVisible
    })));
  }, [effectiveFolders, getFolderKey]);

  // Filter to show only ROOT folders (not subfolders) for display
  const getRootFolders = () => {
    if (!visibleFolders || !Array.isArray(visibleFolders)) return [];

    const rootFolders = visibleFolders.filter(folder => {
      const segments = folder.folderPath.split('/');

      // Partner folder created via "Add Content": folders/{token} - EXACTLY 2 segments
      // These are folders created in the completed deliverables section
      if (segments.length === 2 && segments[0] === 'folders') {
        return true;
      }

      // Partner folder (root): completed/{jobId}/folders/{token} - EXACTLY 4 segments
      if (segments.length === 4 && segments[0] === 'completed' && segments[2] === 'folders') {
        return true;
      }

      // Editor folder structure (new): completed/{jobId}/{orderNumber}/{folderName} - 3-4 segments
      if (segments.length >= 3 && segments.length <= 4 && segments[0] === 'completed' && segments[2] !== 'folders') {
        return true;
      }

      // Editor folder structure (legacy): Simple folder name like "Photos" (1 segment, no path)
      if (segments.length === 1 && folder.editorFolderName) {
        return true;
      }

      // Special case: "All Files" fallback
      if (folder.folderPath === "All Files") {
        return true;
      }

      // Anything with 5+ segments is a subfolder - don't show at root level
      return false;
    });

    // Sort folders by displayOrder (ascending), with folders without displayOrder sorted last
    rootFolders.sort((a, b) => {
      const aOrder = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });

    return rootFolders;
  };

  const folders = getRootFolders();

  // Get subfolders for a given parent folder
  const getSubfolders = (parentFolderPath: string) => {
    if (!visibleFolders || !Array.isArray(visibleFolders)) return [];

    return visibleFolders.filter(folder => {
      // Check if this folder is a direct child of the parent
      if (!folder.folderPath.startsWith(parentFolderPath + '/')) return false;

      // Count segments to ensure it's a direct child (not a grandchild)
      const parentSegments = parentFolderPath.split('/').length;
      const folderSegments = folder.folderPath.split('/').length;

      // Direct child should have exactly one more segment than parent
      return folderSegments === parentSegments + 1;
    });
  };

  const totalFiles = folders.reduce((sum, folder) => sum + folder.fileCount, 0);
  const totalSize = folders.reduce((sum, folder) => 
    sum + folder.files.reduce((fileSum, file) => fileSum + file.fileSize, 0), 0
  );

  // Check revision limits
  const revisionStatus = deliveryData?.revisionStatus?.[0];
  const revisionsExhausted = revisionStatus ? revisionStatus.remainingRounds <= 0 : false;
  const revisionRoundsRemaining = revisionStatus?.remainingRounds || 0;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Check if file is a video
  const isVideo = (mimeType: string) => {
    return mimeType.startsWith('video/');
  };

  // Handle video click - build gallery and open video player
  const handleVideoClick = (url: string, name: string, folderFiles?: DeliveryFile[]) => {
    // Build gallery from folder files if provided
    if (folderFiles) {
      const videoFiles = folderFiles
        .filter(file => file.downloadUrl && isVideo(file.mimeType))
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

  // Navigate between videos
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

  const scrollToFolder = (folderId: string) => {
    const element = document.getElementById(`folder-${folderId}`);
    if (element) {
      const offset = 150;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }
  };

  const toggleSelection = (fileId: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const toggleFolderSelection = (folder: DeliveryFolder) => {
    const folderFileIds = folder.files.map((f) => f.id);
    const allSelected = folderFileIds.every((id) => selectedItems.has(id));
    
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        folderFileIds.forEach((id) => next.delete(id));
      } else {
        folderFileIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleDownloadAll = async () => {
    if (!token) return;

    // Open progress dialog
    setDownloadProgress({
      isOpen: true,
      stage: 'creating',
      progress: 0,
      filesProcessed: 0,
      totalFiles: 0,
      bytesReceived: 0,
      totalBytes: 0,
      folderName: 'All Files'
    });

    try {
      // Step 1: Listen to SSE for zip creation progress (not available for public delivery yet)
      // For now, we'll skip the progress endpoint and download directly

      // Download the ZIP file using the correct endpoint
      setDownloadProgress(prev => ({ ...prev, stage: 'downloading', progress: 0 }));

      let response;
      if (isPreviewMode && currentUser) {
        // Preview mode - use authenticated endpoint with jobId
        const idToken = await currentUser.getIdToken();
        response = await fetch(`/api/jobs/${token}/preview/download-all`, {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });
      } else {
        // Public delivery mode - use delivery token
        response = await fetch(`/api/delivery/${token}/download-all`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Download failed' }));
        throw new Error(errorData.error || 'Download failed');
      }

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
          bytesReceived: receivedLength,
          totalBytes: contentLength
        }));
      }

      // Create blob and trigger download
      const blob = new Blob(chunks);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${deliveryData?.job.address || 'delivery'}-all-files.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Close dialog
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
      alert('Download failed. Please try again.');
    }
  };

  const handleDownloadSelected = () => {
    const filesToDownload = folders.flatMap((folder) =>
      folder.files.filter((file) => selectedItems.has(file.id))
    );
    
    filesToDownload.forEach((file) => {
      handleDownload(file.downloadUrl, file.originalName);
    });
  };

  const handleDownload = (url: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadFolder = async (folder: DeliveryFolder) => {
    if (!token) return;

    // Open progress dialog
    setDownloadProgress({
      isOpen: true,
      stage: 'downloading',
      progress: 0,
      filesProcessed: 0,
      totalFiles: 0,
      bytesReceived: 0,
      totalBytes: 0,
      folderName: folder.partnerFolderName || folder.editorFolderName || 'folder'
    });

    try {
      // Use different endpoint based on preview mode
      let response;
      if (isPreviewMode && currentUser) {
        // Preview mode - use authenticated endpoint with jobId
        const idToken = await currentUser.getIdToken();
        response = await fetch(
          `/api/jobs/${token}/preview/folders/download?folderPath=${encodeURIComponent(folder.folderPath)}`,
          {
            credentials: 'include',
            headers: {
              'Authorization': `Bearer ${idToken}`,
            },
          }
        );
      } else {
        // Public delivery mode - use delivery token
        response = await fetch(
          `/api/delivery/${token}/folders/download?folderPath=${encodeURIComponent(folder.folderPath)}`
        );
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Download failed' }));
        throw new Error(errorData.error || 'Download failed');
      }

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
      const blob = new Blob(chunks);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folder.partnerFolderName || folder.editorFolderName || 'folder'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Close dialog
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
      alert(error instanceof Error ? error.message : 'Download failed. Please try again.');
    }
  };

  const submitRevisionRequestMutation = useMutation({
    mutationFn: async () => {
      const selectedFiles = folders.flatMap((folder) =>
        folder.files.filter((file) => selectedItems.has(file.id))
      );
      const orderId = deliveryData?.revisionStatus?.[0]?.orderId || deliveryData?.completedFiles?.[0]?.orderId;
      
      // Use authenticated endpoint for preview mode, public endpoint otherwise
      if (isPreviewMode) {
        if (!currentUser) throw new Error('Authentication required for preview mode');
        const idToken = await currentUser.getIdToken();
        const response = await fetch(`/api/jobs/${token}/revisions/request`, {
          method: "POST",
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            orderId,
            fileIds: selectedFiles.map((f) => f.id),
            comments: revisionNotes,
          }),
        });
        if (!response.ok) throw new Error('Failed to submit revision request');
        return response.json();
      }
      
      return apiRequest(`/api/delivery/${token}/revisions/request`, "POST", {
        orderId,
        fileIds: selectedFiles.map((f) => f.id),
        comments: revisionNotes,
      });
    },
    onSuccess: () => {
      setRevisionSuccess(true);
      setSelectedItems(new Set());
      setRevisionNotes("");
      setTimeout(() => {
        setShowRevisionRequest(false);
        setRevisionSuccess(false);
      }, 2000);
    },
  });

  const submitCommentMutation = useMutation({
    mutationFn: async () => {
      // Use authenticated endpoint for preview mode, public endpoint otherwise
      if (isPreviewMode) {
        if (!currentUser) throw new Error('Authentication required for preview mode');
        const idToken = await currentUser.getIdToken();
        const response = await fetch(`/api/jobs/${token}/files/${selectedMediaForModal?.id}/comments`, {
          method: "POST",
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            authorId: "client",
            authorName: deliveryData?.job.customer?.firstName + " " + deliveryData?.job.customer?.lastName,
            authorRole: "client",
            message: newComment,
          }),
        });
        if (!response.ok) throw new Error('Failed to submit comment');
        return response.json();
      }
      
      return apiRequest(`/api/delivery/${token}/files/${selectedMediaForModal?.id}/comments`, "POST", {
        authorId: "client",
        authorName: deliveryData?.job.customer?.firstName + " " + deliveryData?.job.customer?.lastName,
        authorRole: "client",
        message: newComment,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [fileCommentsEndpoint, currentUser?.uid] });
      setNewComment("");
    },
  });

  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      // Use authenticated endpoint for preview mode, public endpoint otherwise
      if (isPreviewMode) {
        if (!currentUser) throw new Error('Authentication required for preview mode');
        const idToken = await currentUser.getIdToken();
        const response = await fetch(`/api/jobs/${token}/review`, {
          method: "POST",
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            rating,
            review: reviewText,
            submittedBy: deliveryData?.job.customer?.firstName + " " + deliveryData?.job.customer?.lastName,
            submittedByEmail: "client@example.com",
          }),
        });
        if (!response.ok) throw new Error('Failed to submit review');
        return response.json();
      }
      
      return apiRequest(`/api/delivery/${token}/review`, "POST", {
        rating,
        review: reviewText,
        submittedBy: deliveryData?.job.customer?.firstName + " " + deliveryData?.job.customer?.lastName,
        submittedByEmail: "client@example.com",
      });
    },
    onSuccess: async () => {
      setReviewSubmitted(true);
      // Invalidate and refetch after a short delay to account for Firestore eventual consistency
      queryClient.invalidateQueries({ queryKey: [`/api/delivery/${token}`, currentUser?.uid] });
      // Also invalidate the preview endpoint query key if in preview mode
      if (isPreviewMode) {
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${token}/preview`, currentUser?.uid] });
      }
      // Wait a bit and refetch to ensure Firestore has the data (eventual consistency)
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: [`/api/delivery/${token}`, currentUser?.uid] });
        if (isPreviewMode) {
          queryClient.refetchQueries({ queryKey: [`/api/jobs/${token}/preview`, currentUser?.uid] });
        }
      }, 1000); // Increased delay for Firestore eventual consistency
    },
  });

  const getFolderIcon = (folderName: string) => {
    const name = folderName.toLowerCase();
    if (name.includes("video")) return Video;
    return ImageIcon;
  };

  const formatFolderDisplayName = (name: string, folderPath?: string) => {
    // If name is provided and doesn't look like a path with tokens, use it
    if (name && !name.includes('/')) {
      return name;
    }

    // If we have a folderPath, extract the last meaningful segment
    if (folderPath) {
      const segments = folderPath.split('/');
      // Return the last segment (which should be the folder name or token)
      // But only if it's not empty
      const lastSegment = segments[segments.length - 1];
      if (lastSegment && lastSegment.trim()) {
        return lastSegment;
      }
    }

    // Fallback: if name has slashes, show only the last part
    if (name && name.includes('/')) {
      const parts = name.split('/');
      return parts[parts.length - 1] || name;
    }

    return name || "Files";
  };

  const getRatingText = (stars: number) => {
    if (stars === 5) return "Excellent!";
    if (stars === 4) return "Great!";
    if (stars === 3) return "Good";
    if (stars === 2) return "Fair";
    if (stars === 1) return "Poor";
    return "";
  };

  // Navigate between images in modal
  const currentFolderFiles = selectedMediaForModal
    ? folders.find((f) => f.files.some((file) => file.id === selectedMediaForModal.id))?.files || []
    : [];
  const currentFileIndex = currentFolderFiles.findIndex((f) => f.id === selectedMediaForModal?.id);

  const handlePrevImage = () => {
    if (currentFileIndex > 0) {
      setSelectedMediaForModal(currentFolderFiles[currentFileIndex - 1]);
    }
  };

  const handleNextImage = () => {
    if (currentFileIndex < currentFolderFiles.length - 1) {
      setSelectedMediaForModal(currentFolderFiles[currentFileIndex + 1]);
    }
  };

  // Keyboard navigation for image modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedMediaForModal) return;
      if (e.key === "ArrowLeft") handlePrevImage();
      if (e.key === "ArrowRight") handleNextImage();
      if (e.key === "Escape") setSelectedMediaForModal(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedMediaForModal, currentFileIndex]);

  // Keyboard navigation for video player
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedVideo) return;
      if (e.key === "ArrowLeft") navigateVideo('prev');
      if (e.key === "ArrowRight") navigateVideo('next');
      if (e.key === "Escape") setSelectedVideo(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedVideo, currentVideoIndex, galleryVideos]);

  // Show loading state while auth is loading OR query is loading
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your delivery...</p>
        </div>
      </div>
    );
  }

  // Only show error after loading is complete AND we have an actual error
  if (error || !deliveryData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Delivery Not Found</h1>
          <p className="text-muted-foreground">
            The requested delivery could not be found or has been removed.
          </p>
        </Card>
      </div>
    );
  }

  const { job } = deliveryData;

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <header
        className={`sticky top-0 z-20 bg-card/95 backdrop-blur-xl border-b border-border/50 transition-shadow duration-300 ${
          scrolled ? "shadow-md" : ""
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img 
                src="/assets/rpp-logo.png" 
                alt="Real Property Photography" 
                className="h-12 w-auto object-contain"
                data-testid="delivery-logo"
              />
            </div>
          </div>

          {/* Quick Navigation Bar - Fixed height to prevent layout shifts */}
          <div className="relative h-20 overflow-hidden">
            <div
              className={`absolute inset-x-0 top-0 flex items-center gap-3 border-t border-border/50 pt-4 pb-2 will-change-transform transition-[transform,opacity] duration-300 ease-in-out ${
                showQuickNav 
                  ? "translate-y-0 opacity-100 pointer-events-auto" 
                  : "-translate-y-full opacity-0 pointer-events-none"
              }`}
            >
              <span className="text-sm text-muted-foreground whitespace-nowrap mr-2">
                Jump to:
              </span>
              <div className="flex items-center gap-3 overflow-x-auto flex-1">
                {folders.map((folder) => {
                  const displayName = folder.partnerFolderName || folder.editorFolderName || folder.folderPath;
                  const Icon = getFolderIcon(displayName);
                  return (
                    <Button
                      key={folder.folderPath}
                      variant="outline"
                      size="sm"
                      onClick={() => scrollToFolder(folder.folderPath)}
                      className="px-4 py-2 rounded-xl border-border/50 hover:bg-primary/10 hover:border-primary/50 flex-shrink-0"
                      data-testid={`nav-folder-${folder.folderPath}`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {formatFolderDisplayName(displayName)}
                      <Badge
                        variant="secondary"
                        className="ml-2 text-xs h-5 px-1.5 bg-muted/50"
                      >
                        {folder.fileCount}
                      </Badge>
                    </Button>
                  );
                })}
              </div>
              <Button
                onClick={handleDownloadAll}
                className="bg-gradient-to-r from-primary to-primary rounded-xl flex-shrink-0"
                size="sm"
                data-testid="button-download-all-header"
              >
                <Download className="h-4 w-4 mr-2" />
                Download All
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="relative h-[550px] bg-gradient-to-br from-gray-900 to-gray-800 overflow-hidden">
        {/* Background Image */}
        {job.propertyImage && (
          <>
            <ImageWithFallback
              src={job.propertyImage}
              alt={job.address}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/30" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          </>
        )}

        {/* Hero Content */}
        <div className="relative h-full max-w-7xl mx-auto px-6 flex flex-col justify-center">
          <div className="max-w-3xl">
            <h1
              className="text-white text-4xl md:text-5xl font-bold mb-3"
              data-testid="text-property-address"
            >
              {job.address}
            </h1>

            <p className="text-white/90 text-lg md:text-xl mb-6">
              Your high-resolution property photos and videos are ready for download
            </p>

            {/* Metadata Row */}
            <div className="flex flex-wrap items-center gap-4 text-white/80 text-sm mb-6">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{job.address}</span>
              </div>
              {job.appointmentDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Delivered {format(new Date(job.appointmentDate), "MMM d, yyyy")}</span>
                </div>
              )}
            </div>

            {/* Folder Quick Links */}
            <div className="flex flex-wrap items-center gap-3 mt-8">
              {folders.map((folder) => {
                const displayName = folder.partnerFolderName || folder.editorFolderName || folder.folderPath;
                const Icon = getFolderIcon(displayName);
                return (
                  <Button
                    key={folder.folderPath}
                    variant="outline"
                    onClick={() => scrollToFolder(folder.folderPath)}
                    className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:border-white/50 rounded-xl backdrop-blur-sm"
                    data-testid={`hero-folder-${folder.folderPath}`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {formatFolderDisplayName(displayName)}
                    <Badge variant="secondary" className="ml-2 text-xs bg-white/20 text-white border-0">
                      {folder.fileCount}
                    </Badge>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Media Folders */}
        <div className="space-y-8">
          {folders.map((folder) => (
            <div
              key={folder.folderPath}
              id={`folder-${folder.folderPath}`}
              className="scroll-mt-40"
            >
              {/* Folder Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-bold" data-testid={`text-folder-${folder.folderPath}`}>
                    {formatFolderDisplayName(
                      folder.partnerFolderName || folder.editorFolderName || folder.folderPath,
                      folder.folderPath
                    )}
                  </h2>
                  <Badge variant="outline" className="border border-border/50">
                    {folder.fileCount} files
                  </Badge>

                  {/* Subfolder Indicators */}
                  {(() => {
                    const subfolders = getSubfolders(folder.folderPath);
                    if (subfolders.length > 0) {
                      return (
                        <div className="flex items-center gap-2 ml-2">
                          <Separator orientation="vertical" className="h-6" />
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Folder className="h-4 w-4" />
                              Includes:
                            </span>
                            {subfolders.map((subfolder) => (
                              <Badge
                                key={subfolder.folderPath}
                                variant="outline"
                                className="border-primary/30 text-primary bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
                                onClick={() => setViewingSubfolder(subfolder.folderPath)}
                              >
                                <Folder className="h-3 w-3 mr-1" />
                                {formatFolderDisplayName(
                                  subfolder.partnerFolderName || subfolder.editorFolderName || subfolder.folderPath,
                                  subfolder.folderPath
                                )}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Folder Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleFolderSelection(folder)}
                    className="rounded-xl"
                    data-testid={`button-select-folder-${folder.folderPath}`}
                  >
                    {folder.files.every((f) => selectedItems.has(f.id)) ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Selected
                      </>
                    ) : (
                      "Select All"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-primary to-primary rounded-xl"
                    onClick={() => handleDownloadFolder(folder)}
                    data-testid={`button-download-folder-${folder.folderPath}`}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download All
                  </Button>
                </div>
              </div>

              {/* Media Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {folder.files.map((file) => {
                  const isSelected = selectedItems.has(file.id);
                  const hasComments = (file.commentCount || 0) > 0;
                  const fileIsVideo = isVideo(file.mimeType);

                  return (
                    <div
                      key={file.id}
                      className={`group relative aspect-square rounded-xl overflow-hidden border-2 bg-muted cursor-pointer hover:shadow-xl transition-all duration-200 ${
                        isSelected ? "border-primary" : "border-border"
                      }`}
                      onClick={() => {
                        if (fileIsVideo) {
                          handleVideoClick(file.downloadUrl, file.originalName, folder.files);
                        } else {
                          setSelectedMediaForModal(file);
                        }
                      }}
                      data-testid={`card-media-${file.id}`}
                    >
                      {/* Image or Video Thumbnail */}
                      {fileIsVideo ? (
                        <VideoThumbnail
                          videoUrl={file.downloadUrl}
                          alt={file.originalName}
                          className="w-full h-full group-hover:scale-105 transition-transform duration-300"
                          showPlayIcon={true}
                        />
                      ) : (
                        <ImageWithFallback
                          src={file.downloadUrl}
                          alt={file.originalName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      )}

                      {/* Selection Checkbox */}
                      <Button
                        size="icon"
                        variant={isSelected ? "default" : "secondary"}
                        className={`absolute top-3 left-3 z-10 h-7 w-7 rounded-xl shadow-sm ${
                          isSelected ? "" : "border border-border/50"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelection(file.id);
                        }}
                        data-testid={`checkbox-${file.id}`}
                      >
                        {isSelected && <Check className="h-4 w-4" />}
                      </Button>

                      {/* Revision Badge */}
                      {hasComments && (
                        <div className="absolute top-3 right-3 z-10 w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                          <MessageSquare className="h-4 w-4" />
                        </div>
                      )}

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs truncate">{file.originalName}</p>
                            <p className="text-white/80 text-xs mt-0.5">
                              {formatFileSize(file.fileSize)}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 rounded-xl flex-shrink-0 ml-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(file.downloadUrl, file.originalName);
                            }}
                            data-testid={`button-download-${file.id}`}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator className="mt-8" />
            </div>
          ))}
        </div>

        {/* Rating & Review */}
        {deliveryData.jobReview && !reviewSubmitted ? (
          <Card className="mt-16 border-border/50">
            <div className="p-8">
              <h3 className="text-2xl font-bold mb-4">Your Review</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground mb-2 block">Rating</Label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-8 h-8 ${
                          star <= deliveryData.jobReview!.rating
                            ? "fill-primary text-primary"
                            : "fill-none text-muted-foreground"
                        }`}
                      />
                    ))}
                    <span className="text-sm font-medium ml-2">
                      {getRatingText(deliveryData.jobReview.rating)}
                    </span>
                  </div>
                </div>
                {deliveryData.jobReview.review && (
                  <div>
                    <Label className="text-muted-foreground mb-2 block">Your Feedback</Label>
                    <p className="text-foreground">{deliveryData.jobReview.review}</p>
                  </div>
                )}
                {deliveryData.jobReview.createdAt && (
                  <div className="text-xs text-muted-foreground">
                    Submitted on {format(new Date(deliveryData.jobReview.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ) : !reviewSubmitted && (
          <Card className="mt-16 border-border/50">
            <div className="p-8">
              <h3 className="text-2xl font-bold mb-2">Rate Your Experience</h3>
              <p className="text-muted-foreground mb-6">
                Help us improve by sharing your thoughts on the quality and service
              </p>

              {/* Star Rating */}
              <div className="mb-6">
                <Label className="mb-3 block">Overall Rating</Label>
                <div className="flex items-center gap-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="transition-all duration-200 hover:scale-110"
                      data-testid={`star-${star}`}
                    >
                      <Star
                        className={`w-10 h-10 ${
                          star <= (hoverRating || rating)
                            ? "fill-primary text-primary"
                            : "fill-none text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                  {(hoverRating || rating) > 0 && (
                    <span className="text-sm font-medium ml-2">
                      {getRatingText(hoverRating || rating)}
                    </span>
                  )}
                </div>
              </div>

              {/* Review Textarea */}
              <div className="mb-6">
                <Label htmlFor="review" className="mb-2 block">
                  Your Review (Optional)
                </Label>
                <Textarea
                  id="review"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value.slice(0, 500))}
                  placeholder="Share your experience with the photography service, image quality, professionalism, etc."
                  rows={5}
                  className="rounded-xl resize-none"
                  data-testid="textarea-review"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {reviewText.length} / 500 characters
                </p>
              </div>

              {/* Submit Button */}
              <Button
                onClick={() => submitReviewMutation.mutate()}
                disabled={rating === 0 || submitReviewMutation.isPending}
                className="w-full bg-gradient-to-r from-primary to-primary/90 rounded-xl"
                data-testid="button-submit-review"
              >
                <Send className="h-4 w-4 mr-2" />
                Submit Review
              </Button>
            </div>
          </Card>
        )}

        {reviewSubmitted && (
          <Card className="mt-16 border-green-200 bg-green-50">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">Thank You for Your Feedback!</h3>
              <p className="text-muted-foreground">
                We appreciate your review and will use it to improve our services.
              </p>
            </div>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-16 py-8 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Files are available for download for 30 days. For questions or support, please contact
            your photographer.
          </p>
        </div>
      </div>

      {/* Floating Action Bar */}
      {selectedItems.size > 0 && (
        <Card className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30 shadow-2xl animate-in slide-in-from-bottom-4">
          <div className="p-4 flex flex-col gap-3">
            {/* Selection Info */}
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="border" data-testid="badge-selection-count">
                {selectedItems.size} selected
              </Badge>
              <Separator orientation="vertical" className="h-8" />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRevisionRequest(true)}
                  disabled={revisionsExhausted}
                  className={`rounded-xl ${
                    revisionsExhausted
                      ? "opacity-50 cursor-not-allowed"
                      : "border-primary/50 text-primary hover:bg-primary/10"
                  }`}
                  data-testid="button-request-edits"
                >
                  Request Edits
                </Button>
                <Button
                  size="sm"
                  onClick={handleDownloadSelected}
                  className="bg-gradient-to-r from-primary to-primary/90 rounded-xl"
                  data-testid="button-download-selected"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Selected
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedItems(new Set())}
                  className="rounded-xl"
                  data-testid="button-clear-selection"
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Revision Status Alert */}
            {revisionsExhausted && (
              <Alert className="py-2 px-3 bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <p className="text-xs text-amber-800 ml-6">
                  No revision rounds remaining. Please contact your photographer for additional edits.
                </p>
              </Alert>
            )}
            {!revisionsExhausted && revisionRoundsRemaining > 0 && (
              <div className="text-xs text-muted-foreground px-1">
                {revisionRoundsRemaining} revision {revisionRoundsRemaining === 1 ? 'round' : 'rounds'} remaining
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Revision Request Modal */}
      <Dialog open={showRevisionRequest} onOpenChange={setShowRevisionRequest}>
        <DialogContent className="max-w-2xl" data-testid="modal-revision-request">
          {!revisionSuccess ? (
            <>
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold">Request Edits</h2>
                  <p className="text-muted-foreground">
                    Describe the changes you'd like for the selected files
                  </p>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-sm">
                    Selected {selectedItems.size} file(s) for revision
                  </p>
                </Alert>

                <div>
                  <Label htmlFor="revision-notes" className="mb-2 block">
                    What changes would you like?
                  </Label>
                  <Textarea
                    id="revision-notes"
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                    placeholder="Example: Please brighten the living room photos, crop tighter on the exterior shots, and remove the power lines from image #5."
                    rows={6}
                    className="rounded-xl resize-none"
                    data-testid="textarea-revision-notes"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {revisionNotes.length} characters
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowRevisionRequest(false)}
                    className="flex-1 rounded-xl"
                    data-testid="button-cancel-revision"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => submitRevisionRequestMutation.mutate()}
                    disabled={revisionNotes.length < 10 || submitRevisionRequestMutation.isPending}
                    className="flex-1 bg-gradient-to-r from-primary to-primary/90 rounded-xl"
                    data-testid="button-submit-revision"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Submit Request
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">Revision Request Submitted!</h3>
              <p className="text-muted-foreground">
                Your photographer will review your request and provide updates soon.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Detail Modal */}
      <Dialog open={!!selectedMediaForModal} onOpenChange={() => setSelectedMediaForModal(null)}>
        <DialogContent
          className="max-w-[100vw] lg:max-w-[95vw] xl:max-w-[1800px] h-[100dvh] lg:h-[95vh] p-0 gap-0 rounded-none lg:rounded-lg"
          data-testid="modal-image-detail"
        >
          <div className="flex flex-col lg:flex-row h-full">
            {/* Large Image Display */}
            <div className="flex-1 bg-muted/30 flex items-center justify-center p-4 lg:p-8 relative">
              {selectedMediaForModal && (
                <>
                  <ImageWithFallback
                    src={selectedMediaForModal.downloadUrl}
                    alt={selectedMediaForModal.originalName}
                    className="max-w-full max-h-[80vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
                  />
                  {selectedMediaForModal.mimeType.startsWith("video/") && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-16 h-16 lg:w-24 lg:h-24 bg-secondary rounded-full flex items-center justify-center shadow-xl">
                        <Play className="h-8 w-8 lg:h-12 lg:w-12 text-primary ml-1 fill-current" />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="w-full lg:w-[320px] xl:w-[360px] border-t lg:border-t-0 lg:border-l border-border bg-background flex flex-col">
              {/* Image Info */}
              <div className="p-4 lg:p-5 border-b border-border">
                <h3 className="font-semibold text-lg mb-3" data-testid="text-modal-filename">
                  {selectedMediaForModal?.originalName}
                </h3>
                <div className="flex gap-2 mb-3">
                  <Badge variant="secondary" className="text-xs">
                    {formatFileSize(selectedMediaForModal?.fileSize || 0)}
                  </Badge>
                </div>
                <Button
                  onClick={() =>
                    selectedMediaForModal &&
                    handleDownload(selectedMediaForModal.downloadUrl, selectedMediaForModal.originalName)
                  }
                  className="w-full bg-gradient-to-r from-primary to-primary/90 rounded-xl"
                  data-testid="button-download-modal"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download File
                </Button>
              </div>

              {/* Comments Section */}
              <ScrollArea className="flex-1">
                <div className="p-4 lg:p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold">Comments & Revisions</h4>
                    {fileComments.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {fileComments.length}
                      </Badge>
                    )}
                  </div>

                  {fileComments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No comments yet</p>
                      <p className="text-xs">Click below to start a conversation</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {fileComments.map((comment) => (
                        <div key={comment.id} className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span
                              className={`font-medium ${
                                comment.authorRole === "client" ? "text-foreground" : "text-primary"
                              }`}
                            >
                              {comment.authorName}
                            </span>
                            <span className="text-muted-foreground">
                              {format(new Date(comment.createdAt), "MMM d, h:mm a")}
                            </span>
                          </div>
                          <div
                            className={`text-sm rounded-xl p-3 ${
                              comment.authorRole === "client" ? "bg-muted/50" : "bg-primary/10"
                            }`}
                          >
                            {comment.message}
                          </div>
                          {comment.status && (
                            <Badge
                              className={`text-xs px-2 py-0.5 ${
                                comment.status === "resolved"
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : comment.status === "in_progress"
                                  ? "bg-amber-500/10 text-amber-600"
                                  : "bg-blue-500/10 text-blue-600"
                              }`}
                            >
                              {comment.status}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* New Comment Input */}
              <div className="p-4 lg:p-5 border-t border-border">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment or revision request..."
                  rows={3}
                  className="rounded-xl resize-none mb-3"
                  data-testid="textarea-comment"
                />
                <Button
                  onClick={() => submitCommentMutation.mutate()}
                  disabled={!newComment.trim() || submitCommentMutation.isPending}
                  className="w-full bg-gradient-to-r from-primary to-primary/90 rounded-xl"
                  data-testid="button-submit-comment"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Submit Comment
                </Button>
              </div>
            </div>
          </div>

          {/* Thumbnail Carousel */}
          <div className="border-t border-border bg-muted/30 p-3 lg:p-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevImage}
                disabled={currentFileIndex === 0}
                className="h-12 w-12 rounded-xl flex-shrink-0"
                data-testid="button-prev-image"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <ScrollArea className="flex-1">
                <div className="flex gap-2">
                  {currentFolderFiles.map((file, index) => (
                    <div
                      key={file.id}
                      onClick={() => setSelectedMediaForModal(file)}
                      className={`w-16 h-16 lg:w-20 lg:h-20 rounded-lg overflow-hidden cursor-pointer border-2 transition-all duration-200 flex-shrink-0 ${
                        file.id === selectedMediaForModal?.id
                          ? "border-primary opacity-100"
                          : "border-transparent opacity-60 hover:opacity-100 hover:border-border"
                      }`}
                      data-testid={`thumb-${file.id}`}
                    >
                      <ImageWithFallback
                        src={file.downloadUrl}
                        alt={file.originalName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextImage}
                disabled={currentFileIndex === currentFolderFiles.length - 1}
                className="h-12 w-12 rounded-xl flex-shrink-0"
                data-testid="button-next-image"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Player Modal */}
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
                <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                  {galleryVideos.map((vid, index) => (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentVideoIndex(index);
                        setSelectedVideo(vid.url);
                        setSelectedVideoName(vid.name);
                      }}
                      className={`flex-shrink-0 relative group transition-all ${
                        index === currentVideoIndex 
                          ? 'ring-2 ring-white scale-110' 
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
                      {index === currentVideoIndex && (
                        <div className="absolute inset-0 bg-white/20 rounded-lg" />
                      )}
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

      {/* Subfolder Viewer Dialog */}
      {viewingSubfolder && (() => {
        const subfolder = visibleFolders.find(f => f.folderPath === viewingSubfolder);
        if (!subfolder) return null;

        return (
          <Dialog open={true} onOpenChange={() => setViewingSubfolder(null)}>
            <DialogContent className="max-w-6xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Folder className="h-5 w-5" />
                  {formatFolderDisplayName(
                    subfolder.partnerFolderName || subfolder.editorFolderName || subfolder.folderPath,
                    subfolder.folderPath
                  )}
                </DialogTitle>
                <DialogDescription>
                  {subfolder.fileCount} file{subfolder.fileCount !== 1 ? 's' : ''} in this folder
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="h-[60vh] pr-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {subfolder.files.map((file) => {
                    const fileIsVideo = isVideo(file.mimeType);

                    return (
                      <div
                        key={file.id}
                        className="group relative aspect-square rounded-xl overflow-hidden border-2 border-border bg-muted cursor-pointer hover:shadow-xl transition-all duration-200"
                        onClick={() => {
                          if (fileIsVideo) {
                            handleVideoClick(file.downloadUrl, file.originalName, subfolder.files);
                            setViewingSubfolder(null);
                          } else {
                            setSelectedMediaForModal(file);
                            setViewingSubfolder(null);
                          }
                        }}
                      >
                        <ImageWithFallback
                          src={file.downloadUrl}
                          alt={file.originalName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />

                        {fileIsVideo && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center shadow-lg">
                              <Play className="h-8 w-8 text-primary ml-1 fill-current" />
                            </div>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-xs truncate">{file.originalName}</p>
                              <p className="text-white/80 text-xs mt-0.5">
                                {formatFileSize(file.fileSize)}
                              </p>
                            </div>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-8 w-8 rounded-xl flex-shrink-0 ml-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(file.downloadUrl, file.originalName);
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setViewingSubfolder(null)}>
                  Close
                </Button>
                <Button onClick={() => handleDownloadFolder(subfolder)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Folder
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
