import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { 
  Clock, 
  Upload, 
  Loader2, 
  Check, 
  X, 
  ChevronRight, 
  RefreshCw, 
  MessageSquare,
  ArrowRight
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { FileUploadModal } from "@/components/FileUploadModal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  status: 'pending' | 'processing' | 'in_revision' | 'completed' | 'cancelled';
  dueDate: string;
  createdAt: string | Date;
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
  partnerId?: string;
}

export default function EditorDashboard() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<EditorJob | null>(null);
  
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [declineReason, setDeclineReason] = useState("");
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: editorJobs = [], isLoading } = useQuery<EditorJob[]>({
    queryKey: ['/api/editor/jobs-ready-for-upload'],
    refetchInterval: 5000,
  });

  const totalOrders = editorJobs.length;
  const revisionJobs = editorJobs.filter(job => job.status === 'in_revision');
  const processingJobs = editorJobs.filter(job => job.status === 'processing');
  const pendingJobs = editorJobs.filter(job => job.status === 'pending');

  const handleUploadClick = (job: EditorJob) => {
    setSelectedJob(job);
    setIsUploadOpen(true);
  };

  const handleUploadComplete = async (jobId: string, uploads: any[]) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const response = await apiRequest(`/api/editor/jobs/${jobId}/uploads`, 'POST', {
        uploads: uploads.map(upload => ({
          fileName: upload.file.name,
          originalName: upload.file.name,
          fileSize: upload.file.size,
          mimeType: upload.file.type,
          firebaseUrl: upload.url,
          downloadUrl: upload.url
        })),
        notes: 'Deliverables uploaded via dashboard'
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs-ready-for-upload'] });
        queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs'] });

        toast({
          title: "Upload Successful",
          description: `${uploads.length} deliverable(s) uploaded successfully.`,
        });
      }
    } catch (error) {
      console.error('Error completing upload:', error);
      toast({
        title: "Upload Error",
        description: "Failed to complete upload. Please try again.",
        variant: "destructive"
      });
    }
    
    setIsUploadOpen(false);
    setSelectedJob(null);
  };

  const handleAcceptOrder = async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const token = await user.getIdToken();
      const response = await fetch(`/api/editor/orders/${selectedOrderId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to accept order');
      }

      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs-ready-for-upload'] });
      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs'] });

      toast({
        title: "Order Accepted",
        description: "You can now download the files and start working.",
      });
      
      setShowAcceptDialog(false);
      setSelectedOrderId("");
    } catch (error: any) {
      console.error('Error accepting order:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to accept order. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeclineOrder = async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const token = await user.getIdToken();
      const response = await fetch(`/api/editor/orders/${selectedOrderId}/decline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          reason: declineReason || undefined 
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to decline order');
      }

      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs-ready-for-upload'] });
      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs'] });

      toast({
        title: "Order Declined",
        description: "The order has been declined and the partner has been notified.",
      });
      
      setShowDeclineDialog(false);
      setSelectedOrderId("");
      setDeclineReason("");
    } catch (error: any) {
      console.error('Error declining order:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to decline order. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDownloadFiles = async (job: EditorJob) => {
    try {
      setIsDownloading(true);
      setDownloadProgress(10);
      
      const headers: Record<string, string> = {};
      
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        headers.Authorization = `Bearer ${token}`;
        setDownloadProgress(25);
      } else {
        setIsDownloading(false);
        return;
      }

      setDownloadProgress(40);
      
      const response = await fetch(`/api/editor/orders/${encodeURIComponent(job.orderNumber)}/download`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      setDownloadProgress(70);

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'job_files.zip';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      setDownloadProgress(85);

      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setDownloadProgress(100);
      
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(0);
      }, 1000);
      
    } catch (error) {
      console.error('Error downloading files:', error);
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  // Calculate due time display
  const getDueTimeDisplay = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffHours < 0) return { text: 'Overdue', urgent: true };
    if (diffHours < 6) return { text: `Due in ${diffHours} hours`, urgent: true };
    if (diffHours < 24) return { text: `Due in ${diffHours} hours`, urgent: false };
    return { text: `Due in ${diffDays} day${diffDays > 1 ? 's' : ''}`, urgent: false };
  };

  // Get action button based on status
  const getActionButton = (job: EditorJob) => {
    switch (job.status) {
      case 'pending':
        return (
          <Button 
            size="sm" 
            className="btn-primary-gradient"
            onClick={() => {
              setSelectedOrderId(job.orderId);
              setShowAcceptDialog(true);
            }}
          >
            Start
          </Button>
        );
      case 'processing':
        return (
          <Button 
            size="sm" 
            className="btn-primary-gradient"
            onClick={() => handleUploadClick(job)}
          >
            Continue
          </Button>
        );
      case 'in_revision':
        return (
          <Button 
            size="sm" 
            className="btn-primary-gradient"
            onClick={() => handleUploadClick(job)}
          >
            Fix
          </Button>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-24 bg-gray-200 rounded-xl"></div>
            <div className="h-24 bg-gray-200 rounded-xl"></div>
          </div>
          <div className="h-16 bg-gray-200 rounded-xl"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded-xl"></div>
            <div className="h-20 bg-gray-200 rounded-xl"></div>
            <div className="h-20 bg-gray-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-rpp-grey-pale min-h-screen">
      {/* Download Progress Dialog */}
      <Dialog open={isDownloading} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md rounded-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-rpp-orange" />
              Preparing Download
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-rpp-grey">
              Zipping files and preparing your download...
            </p>
            <div className="space-y-2">
              <Progress value={downloadProgress} className="w-full" />
              <p className="text-xs text-rpp-grey-light text-center">
                {downloadProgress}% complete
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Modal */}
      {selectedJob && (
        <FileUploadModal
          isOpen={isUploadOpen}
          onClose={() => {
            setIsUploadOpen(false);
            setSelectedJob(null);
          }}
          serviceName={selectedJob.services[0]?.name || "Deliverables"}
          serviceId={selectedJob.jobId}
          userId={auth.currentUser?.uid || ""}
          jobId={selectedJob.jobId}
          uploadType="completed"
          orderNumber={selectedJob.orderNumber}
          onFilesUpload={(serviceId, files, orderNumber) => {
            handleUploadComplete(selectedJob.jobId, files);
          }}
        />
      )}

      {/* Accept Order Dialog */}
      <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Accept Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to accept this order? You will be able to download the files and start working on it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAcceptDialog(false);
                setSelectedOrderId("");
              }}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button 
              className="btn-primary-gradient rounded-xl"
              onClick={handleAcceptOrder}
            >
              <Check className="w-4 h-4 mr-2" />
              Accept Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline Order Dialog */}
      <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Decline Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to decline this order? The partner will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-rpp-grey-darkest mb-2 block">
              Reason for declining (optional)
            </label>
            <Textarea
              placeholder="Let the partner know why you're declining this order..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className="w-full rounded-xl"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDeclineDialog(false);
                setSelectedOrderId("");
                setDeclineReason("");
              }}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeclineOrder}
              className="rounded-xl"
            >
              <X className="w-4 h-4 mr-2" />
              Decline Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-semibold text-rpp-grey-darkest">Welcome back! 👋</h1>
        <p className="text-rpp-grey">You have {totalOrders} orders to work on.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="card-hover border border-rpp-grey-lighter rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-rpp-grey">My Orders</p>
                <p className="text-3xl font-bold text-rpp-grey-darkest">{totalOrders}</p>
              </div>
              <div className="w-12 h-12 bg-rpp-orange-subtle rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-rpp-orange" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border border-rpp-grey-lighter rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-rpp-grey">Revisions</p>
                <p className="text-3xl font-bold text-rpp-grey-darkest">{revisionJobs.length}</p>
              </div>
              <div className="w-12 h-12 bg-rpp-orange-subtle rounded-full flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-rpp-orange" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revision Requests Banner */}
      {revisionJobs.length > 0 && (
        <Card className="bg-rpp-orange-subtle border-none rounded-2xl overflow-hidden">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rpp-orange/20 rounded-full flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-rpp-orange" />
              </div>
              <div>
                <p className="font-semibold text-rpp-orange">{revisionJobs.length} Revision Request{revisionJobs.length > 1 ? 's' : ''}</p>
                <p className="text-sm text-rpp-orange/80">Client feedback needs addressing</p>
              </div>
            </div>
            <Link href="/editor/revisions">
              <Button className="btn-primary-gradient rounded-xl">
                Review
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Your Orders Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-rpp-grey-darkest">Your Orders</h2>
          <Link href="/editor/jobs">
            <Button variant="ghost" className="text-rpp-grey hover:text-rpp-grey-darkest">
              View All
            </Button>
          </Link>
        </div>

        <div className="space-y-3">
          {[...revisionJobs, ...processingJobs, ...pendingJobs].slice(0, 5).map((job) => {
            const dueInfo = getDueTimeDisplay(job.dueDate);
            const isRevision = job.status === 'in_revision';
            const isUrgent = dueInfo.urgent;
            
            return (
              <Card 
                key={job.id} 
                className="card-hover border border-rpp-grey-lighter rounded-2xl"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-rpp-grey-darkest">
                          {job.orderNumber}
                        </span>
                        {isUrgent && (
                          <Badge className="badge-pill badge-urgent text-xs">
                            Urgent
                          </Badge>
                        )}
                        {isRevision && (
                          <Badge className="badge-pill badge-revision text-xs flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" />
                            Revision
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-rpp-grey mb-1">{job.address}</p>
                      <div className="flex items-center gap-1 text-xs">
                        <Clock className="w-3 h-3" />
                        <span className={dueInfo.urgent ? 'text-semantic-red' : 'text-rpp-grey'}>
                          {dueInfo.text}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getActionButton(job)}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-rpp-grey hover:text-rpp-grey-darkest"
                      >
                        <MessageSquare className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {editorJobs.length === 0 && (
            <Card className="border border-rpp-grey-lighter rounded-2xl">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-rpp-grey-lightest rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-rpp-grey-light" />
                </div>
                <h3 className="font-semibold text-rpp-grey-darkest mb-1">No orders yet</h3>
                <p className="text-sm text-rpp-grey">New orders will appear here when assigned to you.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Ready to Upload CTA */}
      {processingJobs.length > 0 && (
        <Card className="bg-rpp-orange-subtle border-none rounded-2xl overflow-hidden">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rpp-orange/20 rounded-full flex items-center justify-center">
                <Upload className="w-5 h-5 text-rpp-orange" />
              </div>
              <div>
                <p className="font-semibold text-rpp-orange">Ready to Upload?</p>
                <p className="text-sm text-rpp-orange/80">Upload completed files for client delivery</p>
              </div>
            </div>
            <Link href="/editor/uploads">
              <Button className="btn-primary-gradient rounded-xl">
                Upload Files
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
