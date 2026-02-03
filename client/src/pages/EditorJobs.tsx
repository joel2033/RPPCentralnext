import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Loader2, Search } from "lucide-react";
import { auth } from "@/lib/firebase";
import { EditorUploadWorkModal } from "@/components/modals/EditorUploadWorkModal";
import { OrderInstructionsModal } from "@/components/modals/OrderInstructionsModal";
import { RevisionFeedbackModal } from "@/components/modals/RevisionFeedbackModal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { EditorOrdersKanban, type EditorJob } from "@/components/EditorOrdersKanban";

export default function EditorJobs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<EditorJob | null>(null);
  
  // Confirmation dialog states
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [declineReason, setDeclineReason] = useState("");
  const [instructionsJob, setInstructionsJob] = useState<EditorJob | null>(null);
  const [feedbackJob, setFeedbackJob] = useState<EditorJob | null>(null);
  
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: jobs = [], isLoading } = useQuery<EditorJob[]>({
    queryKey: ['/api/editor/jobs-ready-for-upload']
  });

  const handleUploadClick = (job: EditorJob) => {
    console.log('[DEBUG] Upload clicked for job:', { id: job.id, jobId: job.jobId, orderNumber: job.orderNumber });
    setSelectedJob(job);
    setIsUploadOpen(true);
  };

  const handleUploadComplete = async (jobId: string, uploads: any[]) => {
    try {
      // Record the uploads in the backend
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
        notes: 'Deliverables uploaded via jobs page'
      });

      if (response.ok) {
        // Refresh the jobs list
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

  // Filter jobs by search term across all stages
  const filteredJobs = jobs.filter(job => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (job.customerName || '').toLowerCase().includes(term) ||
      (job.address || '').toLowerCase().includes(term) ||
      job.orderNumber.toLowerCase().includes(term) ||
      job.services?.some(s => (s.name || '').toLowerCase().includes(term))
    );
  });

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

      // Refresh the jobs list
      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs-ready-for-upload'] });
      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs'] });

      toast({
        title: "Order Accepted",
        description: "You can now begin processing this order.",
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
        body: JSON.stringify({ reason: declineReason })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to decline order');
      }

      // Refresh the jobs list
      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs-ready-for-upload'] });
      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs'] });

      toast({
        title: "Order Declined",
        description: "The order has been declined and the partner will be notified.",
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

  const handleMarkComplete = async () => {
    try {
      console.log('[handleMarkComplete] Starting, orderId:', selectedOrderId);
      // Move the order to human_check status for QC review
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const token = await user.getIdToken();
      console.log('[handleMarkComplete] Making API call to:', `/api/editor/orders/${selectedOrderId}/mark-complete`);
      const response = await fetch(`/api/editor/orders/${selectedOrderId}/mark-complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('[handleMarkComplete] Response status:', response.status, response.ok);

      if (!response.ok) {
        const error = await response.json();
        console.error('[handleMarkComplete] API error:', error);
        throw new Error(error.error || 'Failed to mark order as complete');
      }

      const result = await response.json();
      console.log('[handleMarkComplete] Success:', result);

      // Refresh the jobs list
      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs-ready-for-upload'] });
      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs'] });

      toast({
        title: "Sent for QC Review",
        description: "The order has been sent for quality control review.",
      });
      
      setShowCompleteDialog(false);
      setSelectedOrderId("");
    } catch (error: any) {
      console.error('[handleMarkComplete] Error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to mark order as complete. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDownloadFiles = async (job: EditorJob) => {
    try {
      console.log('Download button clicked for order:', job.orderNumber);

      // Show progress dialog
      setIsDownloading(true);
      setDownloadProgress(10);

      // Create the API request with authentication headers
      const headers: Record<string, string> = {};

      // Add auth header if user is authenticated
      if (auth.currentUser) {
        console.log('Getting auth token...');
        const token = await auth.currentUser.getIdToken();
        headers.Authorization = `Bearer ${token}`;
        console.log('Auth token obtained, making request...');
        setDownloadProgress(25);
      } else {
        console.error('No authenticated user found');
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

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'job_files.zip';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      setDownloadProgress(85);

      // Convert response to blob
      const blob = await response.blob();

      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setDownloadProgress(100);

      // Refresh jobs to show updated status
      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs-ready-for-upload'] });
      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs'] });

      // Hide dialog after a short delay
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(0);
      }, 1000);

    } catch (error) {
      console.error('Error downloading files:', error);
      setIsDownloading(false);
      setDownloadProgress(0);
      toast({
        title: "Download Error",
        description: "Failed to download files. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handler functions for kanban callbacks
  const onAcceptOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowAcceptDialog(true);
  };

  const onDeclineOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowDeclineDialog(true);
  };

  const onMarkComplete = async (orderId: string) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const token = await user.getIdToken();
      const response = await fetch(`/api/editor/orders/${orderId}/mark-complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to mark order as complete');
      }

      // Refresh the jobs list
      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs-ready-for-upload'] });
      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs'] });

      toast({
        title: "Sent for QC Review",
        description: "The order has been sent for quality control review.",
      });
    } catch (error: any) {
      console.error('Error marking order complete:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to mark order as complete. Please try again.",
        variant: "destructive"
      });
    }
  };

  const onViewInstructions = (job: EditorJob) => {
    setInstructionsJob(job);
    setShowInstructionsModal(true);
  };

  const onViewFeedback = (job: EditorJob) => {
    setFeedbackJob(job);
    setShowFeedbackModal(true);
  };

  const onStartQC = (job: EditorJob) => {
    // Navigate to QC page with order ID
    navigate(`/editor/qc/${job.orderId}`);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-96 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
          <p className="text-gray-500">Manage your assigned orders</p>
        </div>
        
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-jobs"
          />
        </div>
      </div>

      {/* Download Progress Dialog */}
      <Dialog open={isDownloading} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Preparing Download
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Zipping files and preparing your download...
            </p>
            <div className="space-y-2">
              <Progress value={downloadProgress} className="w-full" />
              <p className="text-xs text-gray-500 text-center">
                {downloadProgress}% complete
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Kanban Board */}
      <EditorOrdersKanban
        jobs={filteredJobs}
        onDownloadFiles={handleDownloadFiles}
        onUploadClick={handleUploadClick}
        onAcceptOrder={onAcceptOrder}
        onDeclineOrder={onDeclineOrder}
        onMarkComplete={onMarkComplete}
        onViewInstructions={onViewInstructions}
        onStartQC={onStartQC}
        onViewFeedback={onViewFeedback}
      />

      {/* Upload Modal */}
      <EditorUploadWorkModal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          setSelectedJob(null);
        }}
        selectedJob={selectedJob}
        jobs={jobs}
        onUploadComplete={handleUploadComplete}
      />

      {/* Accept Order Confirmation Dialog */}
      <AlertDialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept This Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to accept this order? Once accepted, you'll be able to download files and begin processing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleAcceptOrder}
              className="bg-green-600 hover:bg-green-700"
            >
              Accept Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Decline Order Confirmation Dialog */}
      <AlertDialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline This Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to decline this order? The order will be cancelled and the partner will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Reason for declining (optional)</label>
            <Textarea
              placeholder="Enter a reason for declining this order..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className="w-full"
              rows={3}
              data-testid="textarea-decline-reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeclineReason("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeclineOrder}
              className="bg-red-600 hover:bg-red-700"
            >
              Decline Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark Complete Confirmation Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send for QC Review?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark this order as complete? This will send the order to the Human Check stage for quality control review before delivery.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleMarkComplete}
              className="bg-semantic-purple hover:bg-semantic-purple/90"
            >
              Send for QC
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order Instructions Modal */}
      <OrderInstructionsModal
        isOpen={showInstructionsModal}
        onClose={() => {
          setShowInstructionsModal(false);
          setInstructionsJob(null);
        }}
        job={instructionsJob}
      />

      {/* Revision Feedback Modal */}
      <RevisionFeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => {
          setShowFeedbackModal(false);
          setFeedbackJob(null);
        }}
        job={feedbackJob}
      />
    </div>
  );
}
