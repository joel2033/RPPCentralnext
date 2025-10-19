import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
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
  Play
} from "lucide-react";
import { format } from "date-fns";
import ImageWithFallback from "@/components/ImageWithFallback";
import { queryClient, apiRequest } from "@/lib/queryClient";

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
  orderNumber: string;
  fileCount: number;
  files: DeliveryFile[];
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
    submittedAt: string;
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
  
  const { data: deliveryData, isLoading, error } = useQuery<DeliveryPageData>({
    queryKey: [`/api/delivery/${token}`],
    enabled: !!token,
  });

  const { data: fileComments = [] } = useQuery<FileComment[]>({
    queryKey: [`/api/delivery/${token}/files/${selectedMediaForModal?.id}/comments`],
    enabled: !!token && !!selectedMediaForModal,
  });

  // Initialize review form from existing review data
  useEffect(() => {
    if (deliveryData?.jobReview && !reviewSubmitted) {
      setRating(deliveryData.jobReview.rating);
      setReviewText(deliveryData.jobReview.review || "");
    }
  }, [deliveryData?.jobReview]);

  // Scroll detection for sticky header
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 50);
      
      if (currentScrollY > 400 && currentScrollY < lastScrollY.current) {
        setShowQuickNav(true);
      } else {
        setShowQuickNav(false);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Organize files into folders
  const folders = deliveryData?.folders || (() => {
    if (!deliveryData?.completedFiles) return [];
    
    const folderMap = new Map<string, DeliveryFolder>();
    
    deliveryData.completedFiles.forEach((order) => {
      order.files.forEach((file) => {
        const folderKey = file.folderPath || "All Files";
        if (!folderMap.has(folderKey)) {
          folderMap.set(folderKey, {
            folderPath: folderKey,
            editorFolderName: file.editorFolderName || folderKey,
            orderNumber: order.orderNumber,
            fileCount: 0,
            files: [],
          });
        }
        const folder = folderMap.get(folderKey)!;
        folder.fileCount++;
        folder.files.push(file);
      });
    });
    
    return Array.from(folderMap.values());
  })();

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

  const handleDownloadAll = () => {
    folders.forEach((folder) => {
      folder.files.forEach((file) => {
        handleDownload(file.downloadUrl, file.originalName);
      });
    });
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

  const submitRevisionRequestMutation = useMutation({
    mutationFn: async () => {
      const selectedFiles = folders.flatMap((folder) =>
        folder.files.filter((file) => selectedItems.has(file.id))
      );
      const orderId = deliveryData?.revisionStatus?.[0]?.orderId || deliveryData?.completedFiles?.[0]?.orderId;
      
      return apiRequest(`/api/delivery/${token}/revisions/request`, {
        method: "POST",
        body: JSON.stringify({
          orderId,
          fileIds: selectedFiles.map((f) => f.id),
          comments: revisionNotes,
        }),
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
      return apiRequest(`/api/delivery/${token}/files/${selectedMediaForModal?.id}/comments`, {
        method: "POST",
        body: JSON.stringify({
          authorId: "client",
          authorName: deliveryData?.job.customer?.firstName + " " + deliveryData?.job.customer?.lastName,
          authorRole: "client",
          message: newComment,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/delivery/${token}/files/${selectedMediaForModal?.id}/comments`] });
      setNewComment("");
    },
  });

  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/delivery/${token}/review`, {
        method: "POST",
        body: JSON.stringify({
          rating,
          review: reviewText,
          submittedBy: deliveryData?.job.customer?.firstName + " " + deliveryData?.job.customer?.lastName,
          submittedByEmail: "client@example.com",
        }),
      });
    },
    onSuccess: () => {
      setReviewSubmitted(true);
      queryClient.invalidateQueries({ queryKey: [`/api/delivery/${token}`] });
    },
  });

  const getFolderIcon = (folderName: string) => {
    const name = folderName.toLowerCase();
    if (name.includes("video")) return Video;
    return ImageIcon;
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

  // Keyboard navigation
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your delivery...</p>
        </div>
      </div>
    );
  }

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
            <div className="flex flex-col">
              <div className="text-2xl font-bold text-primary">RPP</div>
              <div className="text-xs tracking-wider text-muted-foreground">
                REAL PROPERTY<br />PHOTOGRAPHY
              </div>
            </div>

            {/* Delivered Badge */}
            <Badge
              className="bg-green-50 text-green-700 border-green-200 px-4 py-2"
              data-testid="badge-delivered"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Delivered
            </Badge>
          </div>

          {/* Quick Navigation Bar */}
          <div
            className={`overflow-hidden transition-all duration-300 ${
              showQuickNav ? "max-h-20 opacity-100 mt-4 border-t border-border/50 pt-4" : "max-h-0 opacity-0"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground whitespace-nowrap mr-2">
                Jump to:
              </span>
              <div className="flex items-center gap-3 overflow-x-auto flex-1">
                {folders.map((folder) => {
                  const Icon = getFolderIcon(folder.editorFolderName);
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
                      {folder.editorFolderName}
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
                className="bg-gradient-to-r from-primary to-primary/90 rounded-xl flex-shrink-0"
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
      <div className="relative h-[400px] bg-gradient-to-br from-gray-900 to-gray-800 overflow-hidden">
        {/* Background Image */}
        {job.propertyImage && (
          <>
            <ImageWithFallback
              src={job.propertyImage}
              alt={job.address}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </>
        )}

        {/* Hero Content */}
        <div className="relative h-full max-w-7xl mx-auto px-6 flex flex-col justify-center">
          <div className="max-w-3xl">
            <Badge className="bg-white/10 text-white border-white/20 backdrop-blur-sm mb-4">
              Professional Media Delivery
            </Badge>

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
                const Icon = getFolderIcon(folder.editorFolderName);
                return (
                  <Button
                    key={folder.folderPath}
                    variant="ghost"
                    onClick={() => scrollToFolder(folder.folderPath)}
                    className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm hover:bg-white/20 hover:border-white/40 text-white"
                    data-testid={`hero-folder-${folder.folderPath}`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {folder.editorFolderName}
                    <Badge className="ml-2 bg-white/20 text-white text-xs h-5 px-1.5">
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
      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Media Folders */}
        <div className="space-y-12">
          {folders.map((folder) => (
            <div
              key={folder.folderPath}
              id={`folder-${folder.folderPath}`}
              className="scroll-mt-40"
            >
              {/* Folder Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <h2 className="text-3xl font-bold" data-testid={`text-folder-${folder.folderPath}`}>
                    {folder.editorFolderName}
                  </h2>
                  <Badge variant="secondary" className="border border-border/50">
                    {folder.fileCount} files
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatFileSize(folder.files.reduce((sum, f) => sum + f.fileSize, 0))}
                  </span>
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
                    className="bg-gradient-to-r from-primary to-primary/90 rounded-xl"
                    onClick={() => {
                      folder.files.forEach((file) => {
                        handleDownload(file.downloadUrl, file.originalName);
                      });
                    }}
                    data-testid={`button-download-folder-${folder.folderPath}`}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download All
                  </Button>
                </div>
              </div>

              {/* Media Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {folder.files.map((file) => {
                  const isSelected = selectedItems.has(file.id);
                  const hasComments = (file.commentCount || 0) > 0;
                  const isVideo = file.mimeType.startsWith("video/");

                  return (
                    <div
                      key={file.id}
                      className={`group relative aspect-square rounded-xl overflow-hidden border-2 bg-muted cursor-pointer hover:shadow-xl transition-all duration-200 ${
                        isSelected ? "border-primary" : "border-border"
                      }`}
                      onClick={() => setSelectedMediaForModal(file)}
                      data-testid={`card-media-${file.id}`}
                    >
                      {/* Image */}
                      <ImageWithFallback
                        src={file.downloadUrl}
                        alt={file.originalName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Selection Checkbox */}
                      <div
                        className={`absolute top-3 left-3 z-10 w-6 h-6 rounded-lg border-2 flex items-center justify-center ${
                          isSelected
                            ? "bg-primary border-primary"
                            : "bg-white/90 border-white/90 hover:bg-white"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelection(file.id);
                        }}
                        data-testid={`checkbox-${file.id}`}
                      >
                        {isSelected && <Check className="h-4 w-4 text-white" />}
                      </div>

                      {/* Revision Badge */}
                      {hasComments && (
                        <div className="absolute top-3 right-3 z-10 w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                          <MessageSquare className="h-4 w-4" />
                        </div>
                      )}

                      {/* Video Play Icon */}
                      {isVideo && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center">
                            <Play className="h-8 w-8 text-primary ml-1 fill-current" />
                          </div>
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
                            size="sm"
                            variant="ghost"
                            className="p-1.5 bg-white/90 hover:bg-white rounded-lg flex-shrink-0 ml-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(file.downloadUrl, file.originalName);
                            }}
                            data-testid={`button-download-${file.id}`}
                          >
                            <Download className="h-3.5 w-3.5" />
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
                <div className="text-xs text-muted-foreground">
                  Submitted on {format(new Date(deliveryData.jobReview.submittedAt), "MMMM d, yyyy 'at' h:mm a")}
                </div>
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedMediaForModal(null)}
                className="absolute top-2 right-2 lg:top-4 lg:right-4 h-9 w-9 lg:h-10 lg:w-10 bg-background/90 backdrop-blur-sm hover:bg-background rounded-full z-10"
                data-testid="button-close-modal"
              >
                <X className="h-4 w-4" />
              </Button>

              {selectedMediaForModal && (
                <>
                  <ImageWithFallback
                    src={selectedMediaForModal.downloadUrl}
                    alt={selectedMediaForModal.originalName}
                    className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg shadow-2xl"
                  />
                  {selectedMediaForModal.mimeType.startsWith("video/") && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-16 h-16 lg:w-24 lg:h-24 bg-white/90 rounded-full flex items-center justify-center shadow-xl">
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
                  Download Image
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
    </div>
  );
}
