import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ArrowLeft, 
  CheckCircle, 
  RefreshCw, 
  Image as ImageIcon, 
  Video, 
  FileText, 
  MessageSquare,
  User,
  MapPin,
  Calendar,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Play,
  Folder,
  FolderOpen,
  ClipboardList,
  Settings2
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface UploadedFile {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  downloadUrl: string;
  firebaseUrl: string;
  uploadedAt: string;
  notes?: string;
  folderPath?: string;
}

interface FileComment {
  id: string;
  fileId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
}

interface OrderService {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceDescription?: string | null;
  quantity: number;
  instructions?: string | null;
  exportTypes?: string | null;
  createdAt: string;
}

interface FolderData {
  folderPath: string;
  folderName: string;
  files: UploadedFile[];
}

interface QCOrderData {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    partnerId: string;
    jobId: string;
    customerId?: string;
    assignedTo?: string;
    createdAt: string;
    revisionNotes?: string;
    usedRevisionRounds: number;
    maxRevisionRounds: number;
  };
  job: {
    id: string;
    jobId: string;
    address: string;
    customerName?: string;
  } | null;
  uploads: UploadedFile[];
  folders?: FolderData[];
  services?: OrderService[];
  comments: FileComment[];
}

export default function EditorQC() {
  const [, params] = useRoute("/editor/qc/:orderId");
  const [, navigate] = useLocation();
  const orderId = params?.orderId;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // State
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [fileComments, setFileComments] = useState<Record<string, string>>({});
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [instructionsExpanded, setInstructionsExpanded] = useState(true);

  // Fetch QC data
  const { data: qcData, isLoading, error } = useQuery<QCOrderData>({
    queryKey: [`/api/editor/orders/${orderId}/qc/files`],
    enabled: !!orderId,
  });

  // Initialize file comments from existing data
  useEffect(() => {
    if (qcData?.comments) {
      const commentMap: Record<string, string> = {};
      qcData.comments.forEach(comment => {
        if (!commentMap[comment.fileId]) {
          commentMap[comment.fileId] = comment.content;
        }
      });
      setFileComments(commentMap);
    }
  }, [qcData?.comments]);

  // Filter media files for gallery
  const imageFiles = qcData?.uploads?.filter(f => f.mimeType.startsWith('image/')) || [];
  const videoFiles = qcData?.uploads?.filter(f => f.mimeType.startsWith('video/')) || [];
  const otherFiles = qcData?.uploads?.filter(f => 
    !f.mimeType.startsWith('image/') && !f.mimeType.startsWith('video/')
  ) || [];

  // Lightbox navigation
  const allMediaFiles = [...imageFiles, ...videoFiles];
  const currentLightboxFile = allMediaFiles[lightboxIndex];

  const openLightbox = (file: UploadedFile) => {
    const index = allMediaFiles.findIndex(f => f.id === file.id);
    if (index !== -1) {
      setLightboxIndex(index);
      setLightboxOpen(true);
    }
  };

  const nextImage = () => {
    setLightboxIndex((prev) => (prev + 1) % allMediaFiles.length);
  };

  const prevImage = () => {
    setLightboxIndex((prev) => (prev - 1 + allMediaFiles.length) % allMediaFiles.length);
  };

  // Handle comment change
  const handleCommentChange = (fileId: string, comment: string) => {
    setFileComments(prev => ({ ...prev, [fileId]: comment }));
  };

  // Save comment for a file
  const saveComment = async (fileId: string) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const token = await user.getIdToken();
      await fetch(`/api/editor/files/${fileId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: fileComments[fileId] || '' })
      });

      toast({
        title: "Comment Saved",
        description: "Your comment has been saved.",
      });
    } catch (error) {
      console.error('Error saving comment:', error);
      toast({
        title: "Error",
        description: "Failed to save comment.",
        variant: "destructive"
      });
    }
  };

  // Pass QC - approve order
  const handlePassQC = async () => {
    try {
      setIsSubmitting(true);
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const token = await user.getIdToken();
      const response = await fetch(`/api/editor/orders/${orderId}/qc/pass`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to pass QC');
      }

      toast({
        title: "QC Passed",
        description: "Order has been approved and marked as complete.",
      });

      // Invalidate all relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs-ready-for-upload'] });
      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/editor/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      navigate('/editor/jobs');
    } catch (error: any) {
      console.error('Error passing QC:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to pass QC.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Request revision
  const handleRequestRevision = async () => {
    if (!revisionNotes.trim()) {
      toast({
        title: "Notes Required",
        description: "Please provide revision notes.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const token = await user.getIdToken();
      const response = await fetch(`/api/editor/orders/${orderId}/qc/revision`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ revisionNotes })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to request revision');
      }

      toast({
        title: "Revision Requested",
        description: "Order has been sent back for revision.",
      });

      // Invalidate queries and navigate back
      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs-ready-for-upload'] });
      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs'] });
      setShowRevisionDialog(false);
      navigate('/editor/jobs');
    } catch (error: any) {
      console.error('Error requesting revision:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to request revision.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  // Toggle folder expansion
  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

  // Helper function to strip HTML tags from text
  const stripHtml = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  };

  // Parse instructions from JSON string - handles multiple formats
  const parseInstructions = (instructionsStr: string | null | undefined): Array<{ label?: string; value?: string; fileName?: string; detail?: string }> => {
    if (!instructionsStr) return [];
    try {
      const parsed = JSON.parse(instructionsStr);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      // If it's an object, wrap it in an array
      if (typeof parsed === 'object' && parsed !== null) {
        return [parsed];
      }
      return [];
    } catch {
      // If it's not JSON, treat as plain text
      return [{ detail: instructionsStr }];
    }
  };

  // Parse export types from JSON string
  const parseExportTypes = (exportTypesStr: string | null | undefined): Array<{ type: string; description?: string }> => {
    if (!exportTypesStr) return [];
    try {
      const parsed = JSON.parse(exportTypesStr);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return [];
    } catch {
      return [];
    }
  };

  // Format folder display name - handles tokens and paths
  const formatFolderDisplayName = (name: string, folderPath?: string): string => {
    // Helper to check if a string looks like a random token (nanoid-style, 10-20 char random string)
    // Tokens are typically: all lowercase/mixed, no vowel patterns, high entropy
    const looksLikeToken = (str: string) => {
      if (!str) return false;
      // Tokens are exactly 10-20 chars of random alphanumeric with no pattern
      if (str.length < 10 || str.length > 25) return false;
      // Must be purely alphanumeric (tokens don't have spaces, underscores in names, etc.)
      if (!/^[a-zA-Z0-9]+$/.test(str)) return false;
      // Real folder names typically have vowels in readable patterns
      // Random tokens have unusual consonant clusters or no vowels
      const vowelCount = (str.match(/[aeiouAEIOU]/g) || []).length;
      const vowelRatio = vowelCount / str.length;
      // Random strings typically have low vowel ratio (< 15%) or very random distribution
      // Real words/names have 20-40% vowels
      if (vowelRatio >= 0.15 && vowelRatio <= 0.5) return false;
      // Check for camelCase or PascalCase patterns (real folder names)
      if (/[a-z][A-Z]/.test(str)) return false;
      // Check for common folder name patterns
      if (/photo|image|video|floor|plan|virtual|tour|edit|raw|file|folder|high|low|res|final|draft|web|print|social|hdr|mls/i.test(str)) return false;
      return true;
    };

    // If name is provided and looks like a real folder name, use it
    if (name && name !== 'Root' && !looksLikeToken(name)) {
      // If it's a path, get the last segment
      if (name.includes('/')) {
        const segments = name.split('/').filter(Boolean);
        const lastSegment = segments[segments.length - 1];
        if (lastSegment && !looksLikeToken(lastSegment)) {
          return lastSegment;
        }
      }
      return name;
    }

    // If name looks like a token, try to find a better name from the path
    if (folderPath && folderPath !== 'Root') {
      const segments = folderPath.split('/').filter(s => s && !looksLikeToken(s));
      if (segments.length > 0) {
        return segments[segments.length - 1];
      }
    }

    // Fallback to generic name only if we really have nothing
    return name && name !== 'Root' && !looksLikeToken(name) ? name : "Files";
  };

  // Initialize all folders as expanded
  useEffect(() => {
    if (qcData?.folders) {
      setExpandedFolders(new Set(qcData.folders.map(f => f.folderPath)));
    }
  }, [qcData?.folders]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !qcData) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-rpp-grey-light mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-rpp-grey-darkest mb-2">
            Order Not Found
          </h2>
          <p className="text-rpp-grey mb-4">
            The order you're looking for doesn't exist or you don't have access.
          </p>
          <Button onClick={() => navigate('/editor/jobs')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/editor/jobs')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-rpp-grey-darkest flex items-center gap-2">
              Quality Control
              <Badge className="bg-semantic-purple text-white">
                {qcData.order.orderNumber}
              </Badge>
            </h1>
            <p className="text-rpp-grey">Review uploaded content before completion</p>
          </div>
        </div>

        {/* QC Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="text-rpp-orange border-rpp-orange/30 hover:bg-rpp-orange/10"
            onClick={() => setShowRevisionDialog(true)}
            disabled={isSubmitting}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Request Revision
          </Button>
          <Button
            className="bg-semantic-green hover:bg-semantic-green/90 text-white"
            onClick={handlePassQC}
            disabled={isSubmitting}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Pass QC
          </Button>
        </div>
      </div>

      {/* Order Info Card */}
      <Card className="border border-rpp-grey-lighter rounded-xl">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-rpp-grey-light" />
              <span className="text-sm text-rpp-grey-dark">
                {qcData.job?.customerName || 'Customer'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rpp-grey-light" />
              <span className="text-sm text-rpp-grey-dark truncate">
                {qcData.job?.address || 'No address'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-rpp-grey-light" />
              <span className="text-sm text-rpp-grey-dark">
                {new Date(qcData.order.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-rpp-grey-light" />
              <span className="text-sm text-rpp-grey-dark">
                {qcData.uploads?.length || 0} files uploaded
              </span>
            </div>
          </div>
          
          {/* Revision info */}
          {qcData.order.usedRevisionRounds > 0 && (
            <div className="mt-3 pt-3 border-t border-rpp-grey-lighter">
              <Badge className="bg-rpp-orange-subtle text-rpp-orange border border-rpp-orange/30">
                Revision {qcData.order.usedRevisionRounds} of {qcData.order.maxRevisionRounds}
              </Badge>
              {qcData.order.revisionNotes && (
                <p className="mt-2 text-sm text-rpp-grey bg-rpp-grey-lightest rounded-lg p-3">
                  {qcData.order.revisionNotes}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Instructions Section */}
      {qcData.services && qcData.services.length > 0 && (
        <Card className="border border-rpp-grey-lighter rounded-xl">
          <Collapsible open={instructionsExpanded} onOpenChange={setInstructionsExpanded}>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer hover:bg-rpp-grey-lightest/50 transition-colors rounded-t-xl">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-semantic-blue" />
                    Order Instructions ({qcData.services.length} service{qcData.services.length !== 1 ? 's' : ''})
                  </div>
                  {instructionsExpanded ? (
                    <ChevronUp className="w-5 h-5 text-rpp-grey" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-rpp-grey" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {qcData.services.map((service, index) => {
                  const instructions = parseInstructions(service.instructions);
                  const exportTypes = parseExportTypes(service.exportTypes);
                  
                  return (
                    <div 
                      key={service.id} 
                      className={`p-4 rounded-lg border border-rpp-grey-lighter bg-rpp-grey-lightest/30 ${index > 0 ? 'mt-4' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Settings2 className="w-4 h-4 text-semantic-blue" />
                          <h4 className="font-medium text-rpp-grey-darkest">
                            {service.serviceName}
                          </h4>
                          {service.quantity > 1 && (
                            <Badge variant="outline" className="text-xs">
                              x{service.quantity}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {service.serviceDescription && (
                        <p className="text-sm text-rpp-grey mb-3">
                          {service.serviceDescription}
                        </p>
                      )}
                      
                      {/* Instructions */}
                      {instructions.length > 0 && instructions.some(i => i.label || i.value || i.fileName || i.detail) && (
                        <div className="space-y-3">
                          <h5 className="text-sm font-medium text-rpp-grey-dark flex items-center gap-2">
                            <FileText className="w-4 h-4 text-rpp-grey" />
                            Instructions
                          </h5>
                          <div className="space-y-2">
                            {instructions.map((instruction, idx) => {
                              // Handle {label, value} format
                              if (instruction.label && instruction.value) {
                                return (
                                  <div key={idx} className="bg-white rounded-lg p-3 border border-rpp-grey-lighter">
                                    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 text-sm">
                                      <span className="text-rpp-grey-dark font-medium shrink-0">
                                        {instruction.label}:
                                      </span>
                                      <span className="text-rpp-grey-darkest whitespace-pre-wrap">
                                        {stripHtml(String(instruction.value))}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }
                              // Handle {fileName, detail} format
                              if (instruction.fileName || instruction.detail) {
                                return (
                                  <div key={idx} className="bg-white rounded-lg p-3 border border-rpp-grey-lighter">
                                    {instruction.fileName && (
                                      <div className="font-medium text-rpp-grey-dark text-sm mb-1 flex items-center gap-2">
                                        <ImageIcon className="w-3.5 h-3.5" />
                                        {instruction.fileName}
                                      </div>
                                    )}
                                    {instruction.detail && (
                                      <div className="text-sm text-rpp-grey-darkest whitespace-pre-wrap">
                                        {stripHtml(String(instruction.detail))}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              // Handle plain text
                              if (typeof instruction === 'string') {
                                return (
                                  <div key={idx} className="bg-white rounded-lg p-3 border border-rpp-grey-lighter text-sm text-rpp-grey-darkest whitespace-pre-wrap">
                                    {stripHtml(instruction)}
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* Export Types */}
                      {exportTypes.length > 0 && exportTypes.some(e => e.type || e.description) && (
                        <div className="mt-3 pt-3 border-t border-rpp-grey-lighter">
                          <h5 className="text-sm font-medium text-rpp-grey-dark mb-2 flex items-center gap-2">
                            <Settings2 className="w-4 h-4 text-rpp-grey" />
                            Export Requirements
                          </h5>
                          <div className="space-y-2">
                            {exportTypes.map((exportType, idx) => (
                              <div 
                                key={idx} 
                                className="bg-semantic-blue/5 rounded-lg p-3 border border-semantic-blue/20"
                              >
                                {exportType.type && (
                                  <div className="font-medium text-semantic-blue text-sm mb-1">
                                    {exportType.type}
                                  </div>
                                )}
                                {exportType.description && (
                                  <div className="text-sm text-rpp-grey-dark whitespace-pre-wrap">
                                    {stripHtml(String(exportType.description))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* No instructions message */}
                      {(!instructions.length || !instructions.some(i => i.label || i.value || i.fileName || i.detail)) && 
                       (!exportTypes.length || !exportTypes.some(e => e.type || e.description)) && (
                        <p className="text-sm text-rpp-grey-light italic">
                          No specific instructions provided for this service
                        </p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* File Gallery - Organized by Folder Hierarchy */}
      <div className="space-y-6">
        {/* Folder-based view */}
        {qcData.folders && qcData.folders.length > 0 ? (
          <Card className="border border-rpp-grey-lighter rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Folder className="w-5 h-5 text-semantic-blue" />
                Uploaded Files ({qcData.uploads?.length || 0} files in {qcData.folders.length} folder{qcData.folders.length !== 1 ? 's' : ''})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {qcData.folders.map((folder) => {
                const isExpanded = expandedFolders.has(folder.folderPath);
                const folderImages = folder.files.filter(f => f.mimeType.startsWith('image/'));
                const folderVideos = folder.files.filter(f => f.mimeType.startsWith('video/'));
                const folderOther = folder.files.filter(f => !f.mimeType.startsWith('image/') && !f.mimeType.startsWith('video/'));
                
                return (
                  <Collapsible
                    key={folder.folderPath}
                    open={isExpanded}
                    onOpenChange={() => toggleFolder(folder.folderPath)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-3 rounded-lg border border-rpp-grey-lighter hover:bg-rpp-grey-lightest cursor-pointer transition-colors">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <FolderOpen className="w-5 h-5 text-semantic-blue" />
                          ) : (
                            <Folder className="w-5 h-5 text-semantic-blue" />
                          )}
                          <div>
                            <p className="font-medium text-rpp-grey-darkest">
                              {formatFolderDisplayName(folder.folderName, folder.folderPath)}
                            </p>
                            <p className="text-xs text-rpp-grey">
                              {folder.files.length} file{folder.files.length !== 1 ? 's' : ''} 
                              {folderImages.length > 0 && ` • ${folderImages.length} image${folderImages.length !== 1 ? 's' : ''}`}
                              {folderVideos.length > 0 && ` • ${folderVideos.length} video${folderVideos.length !== 1 ? 's' : ''}`}
                              {folderOther.length > 0 && ` • ${folderOther.length} other`}
                            </p>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-rpp-grey" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-rpp-grey" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-3 ml-8 space-y-4">
                        {/* Images in folder */}
                        {folderImages.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <ImageIcon className="w-4 h-4 text-semantic-blue" />
                              <span className="text-sm font-medium text-rpp-grey-dark">
                                Images ({folderImages.length})
                              </span>
                            </div>
                            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-3">
                              {folderImages.map((file) => (
                                <div 
                                  key={file.id} 
                                  className="group relative aspect-square rounded-lg overflow-hidden border border-rpp-grey-lighter cursor-pointer hover:border-semantic-blue transition-colors"
                                  onClick={() => openLightbox(file)}
                                >
                                  <img 
                                    src={file.downloadUrl} 
                                    alt={file.originalName}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                    <ImageIcon className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                  {fileComments[file.id] && (
                                    <div className="absolute bottom-1 right-1">
                                      <Badge className="bg-semantic-blue text-white text-xs px-1 py-0.5">
                                        <MessageSquare className="w-2.5 h-2.5" />
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Videos in folder */}
                        {folderVideos.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Video className="w-4 h-4 text-semantic-purple" />
                              <span className="text-sm font-medium text-rpp-grey-dark">
                                Videos ({folderVideos.length})
                              </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                              {folderVideos.map((file) => (
                                <div 
                                  key={file.id} 
                                  className="group relative aspect-video rounded-lg overflow-hidden border border-rpp-grey-lighter cursor-pointer hover:border-semantic-purple transition-colors"
                                  onClick={() => openLightbox(file)}
                                >
                                  <video 
                                    src={file.downloadUrl} 
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                    <Play className="w-8 h-8 text-white" />
                                  </div>
                                  {fileComments[file.id] && (
                                    <div className="absolute bottom-1 right-1">
                                      <Badge className="bg-semantic-purple text-white text-xs px-1 py-0.5">
                                        <MessageSquare className="w-2.5 h-2.5" />
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Other files in folder */}
                        {folderOther.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="w-4 h-4 text-rpp-grey" />
                              <span className="text-sm font-medium text-rpp-grey-dark">
                                Other Files ({folderOther.length})
                              </span>
                            </div>
                            <div className="space-y-1">
                              {folderOther.map((file) => (
                                <div 
                                  key={file.id} 
                                  className="flex items-center justify-between p-2 rounded-lg border border-rpp-grey-lighter hover:bg-rpp-grey-lightest transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-rpp-grey-light" />
                                    <div>
                                      <p className="text-sm font-medium text-rpp-grey-dark">
                                        {file.originalName}
                                      </p>
                                      <p className="text-xs text-rpp-grey-light">
                                        {formatFileSize(file.fileSize)}
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(file.downloadUrl, '_blank')}
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </CardContent>
          </Card>
        ) : (
          /* Fallback to flat file view if no folders */
          <div className="space-y-6">
            {/* Images Section */}
            {imageFiles.length > 0 && (
              <Card className="border border-rpp-grey-lighter rounded-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-semantic-blue" />
                    Images ({imageFiles.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {imageFiles.map((file) => (
                      <div 
                        key={file.id} 
                        className="group relative aspect-square rounded-xl overflow-hidden border border-rpp-grey-lighter cursor-pointer hover:border-semantic-blue transition-colors"
                        onClick={() => openLightbox(file)}
                      >
                        <img 
                          src={file.downloadUrl} 
                          alt={file.originalName}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        {fileComments[file.id] && (
                          <div className="absolute bottom-1 right-1">
                            <Badge className="bg-semantic-blue text-white text-xs px-1.5 py-0.5">
                              <MessageSquare className="w-3 h-3" />
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Videos Section */}
            {videoFiles.length > 0 && (
              <Card className="border border-rpp-grey-lighter rounded-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Video className="w-5 h-5 text-semantic-purple" />
                    Videos ({videoFiles.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {videoFiles.map((file) => (
                      <div 
                        key={file.id} 
                        className="group relative aspect-video rounded-xl overflow-hidden border border-rpp-grey-lighter cursor-pointer hover:border-semantic-purple transition-colors"
                        onClick={() => openLightbox(file)}
                      >
                        <video 
                          src={file.downloadUrl} 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <Play className="w-10 h-10 text-white" />
                        </div>
                        {fileComments[file.id] && (
                          <div className="absolute bottom-1 right-1">
                            <Badge className="bg-semantic-purple text-white text-xs px-1.5 py-0.5">
                              <MessageSquare className="w-3 h-3" />
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Other Files Section */}
            {otherFiles.length > 0 && (
              <Card className="border border-rpp-grey-lighter rounded-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-rpp-grey" />
                    Other Files ({otherFiles.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {otherFiles.map((file) => (
                      <div 
                        key={file.id} 
                        className="flex items-center justify-between p-3 rounded-lg border border-rpp-grey-lighter hover:bg-rpp-grey-lightest transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-rpp-grey-light" />
                          <div>
                            <p className="text-sm font-medium text-rpp-grey-dark">
                              {file.originalName}
                            </p>
                            <p className="text-xs text-rpp-grey-light">
                              {formatFileSize(file.fileSize)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(file.downloadUrl, '_blank')}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* No files message */}
        {qcData.uploads?.length === 0 && (
          <Card className="border border-rpp-grey-lighter rounded-xl">
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 text-rpp-grey-light mx-auto mb-4" />
              <h3 className="text-lg font-medium text-rpp-grey-darkest mb-2">
                No Files Uploaded
              </h3>
              <p className="text-rpp-grey">
                No deliverables have been uploaded for this order yet.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Lightbox Modal */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[95vw] lg:max-w-5xl max-h-[90vh] p-0 overflow-hidden">
          <div className="relative w-full h-full overflow-hidden">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full"
              onClick={() => setLightboxOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>

            {/* Navigation buttons */}
            {allMediaFiles.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full"
                  onClick={prevImage}
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full"
                  onClick={nextImage}
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              </>
            )}

            {/* Media content */}
            <div className="bg-black flex items-center justify-center min-h-[400px] max-h-[70vh] overflow-hidden">
              {currentLightboxFile?.mimeType.startsWith('image/') ? (
                <img 
                  src={currentLightboxFile.downloadUrl} 
                  alt={currentLightboxFile.originalName}
                  className="max-w-full max-h-[70vh] w-auto h-auto object-contain"
                />
              ) : currentLightboxFile?.mimeType.startsWith('video/') ? (
                <video 
                  src={currentLightboxFile.downloadUrl} 
                  controls
                  className="max-w-full max-h-[70vh] w-auto h-auto"
                />
              ) : null}
            </div>

            {/* File info and comments */}
            {currentLightboxFile && (
              <div className="p-4 bg-white border-t overflow-y-auto max-h-[20vh]">
                <div className="flex items-center justify-between mb-3 gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-rpp-grey-darkest truncate">
                      {currentLightboxFile.originalName}
                    </h4>
                    <p className="text-sm text-rpp-grey">
                      {formatFileSize(currentLightboxFile.fileSize)} • 
                      {lightboxIndex + 1} of {allMediaFiles.length}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0"
                    onClick={() => window.open(currentLightboxFile.downloadUrl, '_blank')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>

                {/* Comment input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-rpp-grey-dark">
                    Notes / Comments
                  </label>
                  <Textarea
                    placeholder="Add notes or comments for this file..."
                    value={fileComments[currentLightboxFile.id] || ''}
                    onChange={(e) => handleCommentChange(currentLightboxFile.id, e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveComment(currentLightboxFile.id)}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Save Comment
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Revision Request Dialog */}
      <Dialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-rpp-orange" />
              Request Revision
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-rpp-grey">
              Provide detailed notes about what needs to be revised. This will be sent back to the editor.
            </p>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-rpp-grey-dark">
                Revision Notes *
              </label>
              <Textarea
                placeholder="Describe what needs to be fixed or changed..."
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                rows={5}
                className="resize-none"
              />
            </div>

            {qcData.order.usedRevisionRounds >= qcData.order.maxRevisionRounds && (
              <div className="bg-rpp-orange-subtle text-rpp-orange rounded-lg p-3 text-sm">
                <strong>Warning:</strong> This order has reached its maximum revision limit 
                ({qcData.order.maxRevisionRounds} rounds). Additional revisions may incur extra charges.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRevisionDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="bg-rpp-orange hover:bg-rpp-orange/90 text-white"
              onClick={handleRequestRevision}
              disabled={isSubmitting || !revisionNotes.trim()}
            >
              {isSubmitting ? 'Submitting...' : 'Request Revision'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

