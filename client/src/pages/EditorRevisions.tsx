import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  RefreshCw, 
  Search, 
  Clock, 
  AlertTriangle,
  ArrowRight,
  MessageSquare,
  User
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { FileUploadModal } from "@/components/FileUploadModal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface RevisionJob {
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
  status: 'in_revision';
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
  revisionCount?: number;
  revisionNotes?: string;
  revisionRequestedAt?: string;
}

export default function EditorRevisions() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "pending">("all");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<RevisionJob | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch jobs with revision status
  const { data: allJobs = [], isLoading } = useQuery<RevisionJob[]>({
    queryKey: ['/api/editor/jobs'],
    refetchInterval: 5000,
  });

  // Filter for revision jobs
  const revisionJobs = allJobs.filter(job => job.status === 'in_revision');
  
  // Apply search filter
  const filteredJobs = revisionJobs.filter(job => {
    const matchesSearch = searchTerm === "" || 
      job.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

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

  const handleUploadClick = (job: RevisionJob) => {
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
        notes: 'Revision deliverables uploaded'
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs'] });

        toast({
          title: "Revision Uploaded",
          description: "Your revision has been submitted for review.",
        });
      }
    } catch (error) {
      console.error('Error completing upload:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload revision. Please try again.",
        variant: "destructive"
      });
    }
    
    setIsUploadOpen(false);
    setSelectedJob(null);
  };

  // Generate revision ID for display
  const getRevisionId = (job: RevisionJob) => {
    return `REV-${job.orderNumber.replace(/[^0-9]/g, '').slice(-4).padStart(4, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-rpp-grey-pale min-h-screen">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-rpp-grey-lighter rounded-xl w-1/3"></div>
          <div className="h-16 bg-rpp-grey-lighter rounded-2xl"></div>
          <div className="space-y-3">
            <div className="h-28 bg-rpp-grey-lighter rounded-2xl"></div>
            <div className="h-28 bg-rpp-grey-lighter rounded-2xl"></div>
            <div className="h-28 bg-rpp-grey-lighter rounded-2xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-rpp-grey-pale min-h-screen">
      {/* Upload Modal */}
      {selectedJob && (
        <FileUploadModal
          isOpen={isUploadOpen}
          onClose={() => {
            setIsUploadOpen(false);
            setSelectedJob(null);
          }}
          serviceName={selectedJob.services[0]?.name || "Revision"}
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-rpp-grey-darkest flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-rpp-orange" />
            Revision Requests
          </h1>
          <p className="text-rpp-grey">{filteredJobs.length} pending revision{filteredJobs.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Urgent Alert Banner */}
      {filteredJobs.some(job => getDueTimeDisplay(job.dueDate).urgent) && (
        <Card className="bg-semantic-red-light border-none rounded-2xl overflow-hidden">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-semantic-red/20 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-semantic-red" />
            </div>
            <div>
              <p className="font-semibold text-semantic-red-dark">
                {filteredJobs.filter(job => getDueTimeDisplay(job.dueDate).urgent).length} Urgent Revision{filteredJobs.filter(job => getDueTimeDisplay(job.dueDate).urgent).length !== 1 ? 's' : ''}
              </p>
              <p className="text-sm text-semantic-red">These revisions need immediate attention</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-rpp-grey-light" />
          <Input
            placeholder="Search revisions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl border-rpp-grey-lighter focus:border-rpp-orange"
          />
        </div>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "pending")}>
          <TabsList className="bg-rpp-grey-lightest rounded-xl p-1">
            <TabsTrigger 
              value="all" 
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              All
            </TabsTrigger>
            <TabsTrigger 
              value="pending"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Pending
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Revision Cards */}
      <div className="space-y-3">
        {filteredJobs.length === 0 ? (
          <Card className="border border-rpp-grey-lighter rounded-2xl">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 bg-rpp-grey-lightest rounded-full flex items-center justify-center mx-auto mb-4">
                <RefreshCw className="w-8 h-8 text-rpp-grey-light" />
              </div>
              <h3 className="text-lg font-semibold text-rpp-grey-darkest mb-2">No Revisions</h3>
              <p className="text-rpp-grey">You don't have any revision requests at the moment.</p>
            </CardContent>
          </Card>
        ) : (
          filteredJobs.map((job) => {
            const dueInfo = getDueTimeDisplay(job.dueDate);
            const revisionId = getRevisionId(job);
            
            return (
              <Card 
                key={job.id} 
                className="card-hover border border-rpp-grey-lighter rounded-2xl"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Header with revision ID and badges */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-rpp-grey-darkest">
                          {revisionId}
                        </span>
                        <Badge className="badge-pill badge-revision text-xs">
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Revision {job.revisionCount || 1}
                        </Badge>
                        {dueInfo.urgent && (
                          <Badge className="badge-pill badge-urgent text-xs">
                            Urgent
                          </Badge>
                        )}
                      </div>
                      
                      {/* Address */}
                      <p className="text-sm text-rpp-grey mb-2">{job.address}</p>
                      
                      {/* Revision notes preview */}
                      {job.revisionNotes && (
                        <div className="bg-rpp-grey-lightest rounded-lg p-3 text-sm text-rpp-grey mb-3">
                          <p className="line-clamp-2">{job.revisionNotes}</p>
                        </div>
                      )}
                      
                      {/* Meta info */}
                      <div className="flex items-center gap-4 text-xs text-rpp-grey">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{job.customerName || 'Customer'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span className={dueInfo.urgent ? 'text-semantic-red font-medium' : ''}>
                            {dueInfo.text}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="btn-primary-gradient rounded-xl"
                        onClick={() => handleUploadClick(job)}
                      >
                        Start Fix
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-rpp-grey hover:text-rpp-grey-darkest"
                      >
                        <MessageSquare className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

