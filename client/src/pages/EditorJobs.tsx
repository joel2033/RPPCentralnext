import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Download, Upload, FileImage, Calendar, Clock, MapPin, Loader2, CheckCircle, AlertCircle, XCircle, Info, Link } from "lucide-react";
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
  status: 'pending' | 'processing' | 'in_progress' | 'completed' | 'cancelled';
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
  // Connection validation status
  connectionStatus?: {
    isValid: boolean;
    issues: string[];
    orderDbId?: string;
    jobDbId?: string;
    lastValidated?: string;
  };
}

// Connection validation result interface
interface ConnectionValidation {
  jobId: string;
  isValid: boolean;
  issues: string[];
  connections: any;
  timestamp: string;
}

export default function EditorJobs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<EditorJob | null>(null);
  const [selectedJobForValidation, setSelectedJobForValidation] = useState<string | null>(null);
  
  // Confirmation dialog states
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [declineReason, setDeclineReason] = useState("");
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: jobs = [], isLoading } = useQuery<EditorJob[]>({
    queryKey: ['/api/editor/jobs-ready-for-upload']
  });

  // Query for connection health check
  const { data: healthCheck } = useQuery({
    queryKey: ['/api/health/connection-integrity'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Query for job validation when needed
  const { data: jobValidation, isLoading: isValidating } = useQuery<ConnectionValidation>({
    queryKey: ['/api/validate/job', selectedJobForValidation],
    enabled: !!selectedJobForValidation,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Function to get connection status icon
  const getConnectionStatusIcon = (job: EditorJob) => {
    if (!job.connectionStatus) {
      return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }

    if (job.connectionStatus.isValid) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }

    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  // Function to get connection status color class
  const getConnectionStatusColor = (job: EditorJob) => {
    if (!job.connectionStatus) return "text-gray-500";
    return job.connectionStatus.isValid ? "text-green-600" : "text-red-600";
  };

  // Function to validate a specific job
  const validateJob = async (job: EditorJob) => {
    setSelectedJobForValidation(job.id);
    try {
      await queryClient.refetchQueries({ 
        queryKey: ['/api/validate/job', job.id] 
      });
    } catch (error) {
      console.error('Error validating job:', error);
      toast({
        title: "Validation Error",
        description: "Failed to validate job connections. Please try again.",
        variant: "destructive"
      });
    }
  };

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
        // Update job status to completed
        await apiRequest(`/api/editor/jobs/${jobId}/status`, 'PATCH', { status: 'completed' });

        // Refresh the jobs list
        queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs-ready-for-upload'] });
        queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs'] });

        toast({
          title: "Upload Successful",
          description: `${uploads.length} deliverable(s) uploaded and job completed.`,
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

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = (job.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (job.address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.services?.some(s => (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    const matchesPriority = priorityFilter === 'all'; // Priority not implemented yet

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'in_revision': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-orange-100 text-orange-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
      // Mark the job as complete
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const token = await user.getIdToken();
      const response = await fetch(`/api/editor/jobs/${selectedOrderId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'completed' })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to mark order as complete');
      }

      // Refresh the jobs list
      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs-ready-for-upload'] });
      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs'] });

      toast({
        title: "Order Completed",
        description: "The order has been marked as complete.",
      });
      
      setShowCompleteDialog(false);
      setSelectedOrderId("");
    } catch (error: any) {
      console.error('Error marking order complete:', error);
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

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="flex space-x-4">
            <div className="h-10 bg-gray-200 rounded w-64"></div>
            <div className="h-10 bg-gray-200 rounded w-32"></div>
            <div className="h-10 bg-gray-200 rounded w-32"></div>
          </div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Queue</h1>
          <p className="text-gray-600">Manage your editing projects and workflow</p>
        </div>
        <div className="text-sm text-gray-500">
          {filteredJobs.length} jobs • {filteredJobs.filter(j => j.status === 'pending').length} pending
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search by customer, address, or service..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
          data-testid="input-search-jobs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="in_revision">In Revision</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-priority-filter">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
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

      {/* Jobs List */}
      <div className="space-y-4">
        {filteredJobs.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileImage className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
              <p className="text-gray-500">Try adjusting your search or filter criteria</p>
            </CardContent>
          </Card>
        ) : (
          filteredJobs.map((job) => (
            <Card key={job.orderId} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileImage className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{job.customerName || job.orderNumber}</h3>

                        {/* Connection Status Indicator */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex items-center gap-1">
                                {getConnectionStatusIcon(job)}
                                <Link className="w-3 h-3 text-gray-400" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="max-w-xs">
                                <div className="font-semibold mb-1">Job-Order Connection</div>
                                <div className="text-xs space-y-1">
                                  <div>Job ID: {job.jobId}</div>
                                  <div>Order: #{job.orderNumber}</div>
                                  {job.connectionStatus?.orderDbId && (
                                    <div>Order DB ID: {job.connectionStatus.orderDbId}</div>
                                  )}
                                  {job.connectionStatus?.issues && job.connectionStatus.issues.length > 0 && (
                                    <div className="mt-2 p-2 bg-red-50 rounded text-red-800 text-xs">
                                      <div className="font-medium mb-1">Issues:</div>
                                      {job.connectionStatus.issues.map((issue, idx) => (
                                        <div key={idx}>• {issue}</div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <Badge className={getStatusColor(job.status)}>
                          {job.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center text-sm text-gray-600 mb-2">
                        <MapPin className="w-4 h-4 mr-1" />
                        {job.address}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          Due: {job.dueDate}
                        </span>
                        <span>{job.services?.[0]?.name || 'No service'}</span>
                        <span>{job.originalFiles?.length || 0} files • {job.services?.length || 0} services</span>
                      </div>
                      {job.services && job.services.length > 0 && job.services.some(s => s.instructions) && (
                        <Collapsible className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="w-full justify-start p-0 h-auto">
                              <span className="font-bold mr-2">Instructions:</span>
                              <Info className="w-4 h-4 mr-1" />
                              Click to view
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2 space-y-1">
                            {job.services
                              .filter(service => service.instructions)
                              .map((service, index) => (
                                <div key={index} className="ml-2 border-l pl-3 border-blue-200 bg-white p-2 rounded">
                                  <div className="font-medium text-blue-800 text-xs uppercase tracking-wide mb-1">
                                    {service.name} ({service.quantity}x)
                                  </div>
                                  <div className="text-gray-700">
                                    {(() => {
                                      try {
                                        // Try to parse as JSON
                                        const parsed = JSON.parse(service.instructions);
                                        if (Array.isArray(parsed)) {
                                          return (
                                            <div className="space-y-2">
                                              {parsed.map((item, idx) => (
                                                <div key={idx} className="bg-gray-50 p-2 rounded border-l-2 border-blue-300">
                                                  {typeof item === 'object' ? (
                                                    <div>
                                                      {item.fileName && <div className="font-medium text-gray-800">File: {item.fileName}</div>}
                                                      {item.detail && <div className="text-sm mt-1">{item.detail}</div>}
                                                      {item.instruction && <div className="text-sm mt-1">{item.instruction}</div>}
                                                      {item.notes && <div className="text-sm text-gray-600 mt-1">Notes: {item.notes}</div>}
                                                    </div>
                                                  ) : (
                                                    <div>{String(item)}</div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          );
                                        } else if (typeof parsed === 'object') {
                                          return (
                                            <div className="bg-gray-50 p-2 rounded border-l-2 border-blue-300">
                                              {parsed.fileName && <div className="font-medium text-gray-800">File: {parsed.fileName}</div>}
                                              {parsed.detail && <div className="text-sm mt-1">{parsed.detail}</div>}
                                              {parsed.instruction && <div className="text-sm mt-1">{parsed.instruction}</div>}
                                              {parsed.notes && <div className="text-sm text-gray-600 mt-1">Notes: {parsed.notes}</div>}
                                            </div>
                                          );
                                        } else {
                                          return <div>{String(parsed)}</div>;
                                        }
                                      } catch (e) {
                                        // If not valid JSON, display as plain text
                                        return <div>{service.instructions}</div>;
                                      }
                                    })()}
                                  </div>
                                </div>
                              ))}
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col space-y-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadFiles(job)}
                      disabled={job.status === 'pending'}
                      data-testid={`button-download-${job.orderNumber}`}
                      className={job.status === 'pending' ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Files
                    </Button>
                    {job.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {
                            setSelectedOrderId(job.orderId);
                            setShowAcceptDialog(true);
                          }}
                          data-testid={`button-accept-${job.id}`}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Accept Order
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setSelectedOrderId(job.orderId);
                            setShowDeclineDialog(true);
                          }}
                          data-testid={`button-decline-${job.id}`}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Decline Order
                        </Button>
                      </>
                    )}
                    {job.status === 'processing' && (
                      <>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleUploadClick(job)}
                          data-testid={`button-upload-${job.id}`}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Results
                        </Button>
                        <Button
                          size="sm"
                          className="bg-gray-600 hover:bg-gray-700 text-white"
                          onClick={() => {
                            setSelectedOrderId(job.jobId);
                            setShowCompleteDialog(true);
                          }}
                          data-testid={`button-complete-${job.id}`}
                        >
                          Mark Complete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Upload Modal */}
      {selectedJob && (
        <FileUploadModal
          isOpen={isUploadOpen}
          onClose={() => {
            setIsUploadOpen(false);
            setSelectedJob(null);
          }}
          serviceName={selectedJob.services?.[0]?.name || "Deliverables"}
          serviceId={selectedJob.jobId}
          userId={auth.currentUser?.uid || ""}
          jobId={selectedJob.id}
          uploadType="completed"
          orderNumber={selectedJob.orderNumber}
          onFilesUpload={(serviceId, files, orderNumber) => {
            handleUploadComplete(selectedJob.id, files);
          }}
        />
      )}

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
            <AlertDialogTitle>Mark Order as Complete?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark this order as complete? This will notify the partner that the work is finished.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleMarkComplete}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Mark as Complete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}