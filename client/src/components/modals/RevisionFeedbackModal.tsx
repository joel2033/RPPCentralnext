import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { 
  RefreshCw, 
  MessageSquare, 
  FileText, 
  Image as ImageIcon,
  Video,
  Download,
  User,
  AlertCircle
} from "lucide-react";

interface FileComment {
  id: string;
  fileId: string;
  content: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
}

interface UploadedFile {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  firebaseUrl?: string;
  downloadUrl: string;
}

interface EditorJob {
  id: string;
  jobId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  address: string;
  revisionNotes?: string;
  revisionCount?: number;
  existingUploads: UploadedFile[];
  fileComments?: FileComment[];
}

interface RevisionFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: EditorJob | null;
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// Get file icon based on mime type
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType.startsWith('video/')) return Video;
  return FileText;
}

export function RevisionFeedbackModal({ isOpen, onClose, job }: RevisionFeedbackModalProps) {
  if (!job) return null;

  const fileComments = job.fileComments || [];
  const uploads = job.existingUploads || [];
  
  // Create a map of fileId to comments
  const commentsByFileId = fileComments.reduce((acc, comment) => {
    if (!acc[comment.fileId]) {
      acc[comment.fileId] = [];
    }
    acc[comment.fileId].push(comment);
    return acc;
  }, {} as Record<string, FileComment[]>);

  // Get files that have comments
  const filesWithComments = uploads.filter(file => commentsByFileId[file.id]?.length > 0);
  const filesWithoutComments = uploads.filter(file => !commentsByFileId[file.id]?.length);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <RefreshCw className="w-5 h-5 text-rpp-orange" />
            Revision Feedback
            <Badge className="bg-semantic-blue text-white ml-2">
              {job.orderNumber}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(85vh-120px)] pr-4">
          <div className="space-y-6">
            {/* Revision Notes Section */}
            {job.revisionNotes && (
              <div className="bg-rpp-orange-subtle border border-rpp-orange/30 rounded-xl p-4">
                <h3 className="font-medium text-rpp-orange mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  QC Revision Notes
                  {job.revisionCount && job.revisionCount > 0 && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      Revision #{job.revisionCount}
                    </Badge>
                  )}
                </h3>
                <p className="text-sm text-rpp-grey-dark whitespace-pre-wrap">
                  {job.revisionNotes}
                </p>
              </div>
            )}

            {/* Files with Comments */}
            {filesWithComments.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-medium text-rpp-grey-darkest flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-semantic-blue" />
                  Files Needing Attention ({filesWithComments.length})
                </h3>
                
                <div className="grid gap-4">
                  {filesWithComments.map((file) => {
                    const FileIcon = getFileIcon(file.mimeType);
                    const comments = commentsByFileId[file.id] || [];
                    const isImage = file.mimeType.startsWith('image/');
                    const isVideo = file.mimeType.startsWith('video/');
                    
                    return (
                      <Card key={file.id} className="border border-rpp-orange/30 bg-rpp-orange-subtle/30">
                        <CardContent className="p-4">
                          <div className="flex gap-4">
                            {/* Thumbnail */}
                            <div className="flex-shrink-0">
                              {isImage ? (
                                <div className="w-24 h-24 rounded-lg overflow-hidden border border-rpp-grey-lighter">
                                  <img 
                                    src={file.downloadUrl} 
                                    alt={file.originalName}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : isVideo ? (
                                <div className="w-24 h-24 rounded-lg overflow-hidden border border-rpp-grey-lighter bg-black flex items-center justify-center">
                                  <Video className="w-8 h-8 text-white" />
                                </div>
                              ) : (
                                <div className="w-24 h-24 rounded-lg border border-rpp-grey-lighter bg-rpp-grey-lightest flex items-center justify-center">
                                  <FileIcon className="w-8 h-8 text-rpp-grey-light" />
                                </div>
                              )}
                            </div>
                            
                            {/* File info and comments */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0">
                                  <p className="font-medium text-rpp-grey-darkest truncate">
                                    {file.originalName}
                                  </p>
                                  <p className="text-xs text-rpp-grey-light">
                                    {formatFileSize(file.fileSize)}
                                  </p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(file.downloadUrl, '_blank')}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                              
                              {/* Comments */}
                              <div className="space-y-2">
                                {comments.map((comment) => (
                                  <div 
                                    key={comment.id}
                                    className="bg-white rounded-lg p-3 border border-rpp-grey-lighter"
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      <User className="w-3 h-3 text-rpp-grey-light" />
                                      <span className="text-xs font-medium text-rpp-grey">
                                        {comment.authorName}
                                      </span>
                                      <Badge variant="outline" className="text-xs py-0">
                                        {comment.authorRole}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-rpp-grey-dark">
                                      {comment.content}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Files without Comments */}
            {filesWithoutComments.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-medium text-rpp-grey flex items-center gap-2">
                  <FileText className="w-4 h-4 text-rpp-grey-light" />
                  Other Uploaded Files ({filesWithoutComments.length})
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {filesWithoutComments.map((file) => {
                    const FileIcon = getFileIcon(file.mimeType);
                    const isImage = file.mimeType.startsWith('image/');
                    
                    return (
                      <div 
                        key={file.id}
                        className="relative group rounded-lg overflow-hidden border border-rpp-grey-lighter hover:border-semantic-blue transition-colors"
                      >
                        {isImage ? (
                          <div className="aspect-square">
                            <img 
                              src={file.downloadUrl} 
                              alt={file.originalName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="aspect-square bg-rpp-grey-lightest flex items-center justify-center">
                            <FileIcon className="w-8 h-8 text-rpp-grey-light" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white"
                            onClick={() => window.open(file.downloadUrl, '_blank')}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                          {file.originalName}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No files message */}
            {uploads.length === 0 && (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-rpp-grey-light mx-auto mb-4" />
                <h3 className="text-lg font-medium text-rpp-grey-darkest mb-2">
                  No Files Found
                </h3>
                <p className="text-rpp-grey">
                  No deliverables have been uploaded for this order yet.
                </p>
              </div>
            )}

            {/* No feedback message */}
            {uploads.length > 0 && fileComments.length === 0 && !job.revisionNotes && (
              <div className="bg-rpp-grey-lightest rounded-xl p-4 text-center">
                <MessageSquare className="w-8 h-8 text-rpp-grey-light mx-auto mb-2" />
                <p className="text-sm text-rpp-grey">
                  No specific file feedback provided. Please review the general revision notes above.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

