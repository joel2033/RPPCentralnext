import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, Clock, CheckCircle, MessageSquare, FileText, RefreshCw, ClipboardCheck, User, Timer, Check, X, Eye, PlayCircle } from "lucide-react";

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
  connectionStatus?: {
    isValid: boolean;
    issues: string[];
    orderDbId?: string;
    jobDbId?: string;
    lastValidated?: string;
  };
  assignedEditor?: string;
  partnerName?: string;
  revisionCount?: number;
  revisionNotes?: string;
  approvedBy?: string;
  autoApprovalDeadline?: string;
  fileComments?: Array<{
    id: string;
    fileId: string;
    content: string;
    authorName: string;
    authorRole: string;
    createdAt: string;
  }>;
  /** Customer editing preferences from partner dashboard (customer profile) */
  editingPreferences?: Array<{
    id: string;
    name: string;
    description?: string;
    isEnabled: boolean;
    notes?: string;
  }>;
}

// Kanban stage definitions with PRD colors
const KANBAN_STAGES = [
  { 
    id: 'new_order', 
    label: 'New Order', 
    icon: Clock,
    bgColor: 'bg-semantic-blue',
    textColor: 'text-white',
  },
  { 
    id: 'work_in_progress', 
    label: 'Work in Progress', 
    icon: FileText,
    bgColor: 'bg-semantic-yellow',
    textColor: 'text-white',
  },
  { 
    id: 'revisions', 
    label: 'Revisions', 
    icon: RefreshCw,
    bgColor: 'bg-rpp-orange',
    textColor: 'text-white',
  },
  { 
    id: 'human_check', 
    label: 'Human Check', 
    icon: ClipboardCheck,
    bgColor: 'bg-semantic-purple',
    textColor: 'text-white',
  },
  { 
    id: 'complete', 
    label: 'Complete', 
    icon: CheckCircle,
    bgColor: 'bg-semantic-green',
    textColor: 'text-white',
  },
] as const;

type KanbanStageId = typeof KANBAN_STAGES[number]['id'];

// Map database status to kanban stage
const getKanbanStage = (status: string): KanbanStageId => {
  const statusMap: Record<string, KanbanStageId> = {
    'pending': 'new_order',
    'processing': 'work_in_progress',
    'in_progress': 'work_in_progress',
    'in_revision': 'revisions',
    'human_check': 'human_check',
    'completed': 'complete',
  };
  return statusMap[status] || 'new_order';
};

interface EditorOrdersKanbanProps {
  jobs: EditorJob[];
  onDownloadFiles: (job: EditorJob) => void;
  onUploadClick: (job: EditorJob) => void;
  onAcceptOrder: (orderId: string) => void;
  onDeclineOrder: (orderId: string) => void;
  onMarkComplete: (jobId: string) => void;
  onViewInstructions: (job: EditorJob) => void;
  onStartQC: (job: EditorJob) => void;
  onViewFeedback: (job: EditorJob) => void;
}

// Calculate days until auto-approval
function getAutoApprovalDays(deadline: string | undefined): number | null {
  if (!deadline) return null;
  const deadlineDate = new Date(deadline);
  const now = new Date();
  const diffTime = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Order card component with PRD styling
function OrderCard({
  job,
  stage,
  onDownloadFiles,
  onUploadClick,
  onAcceptOrder,
  onDeclineOrder,
  onViewInstructions,
  onStartQC,
  onMarkComplete,
  onViewFeedback,
}: {
  job: EditorJob;
  stage: KanbanStageId;
  onDownloadFiles: (job: EditorJob) => void;
  onUploadClick: (job: EditorJob) => void;
  onAcceptOrder: (orderId: string) => void;
  onDeclineOrder: (orderId: string) => void;
  onViewInstructions: (job: EditorJob) => void;
  onStartQC: (job: EditorJob) => void;
  onMarkComplete: (orderId: string) => void;
  onViewFeedback: (job: EditorJob) => void;
}) {
  const autoApprovalDays = getAutoApprovalDays(job.autoApprovalDeadline);
  
  return (
    <Card className="card-hover bg-white border border-rpp-grey-lighter rounded-xl">
      <CardContent className="p-4">
        {/* Header with order number and revision badge */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold text-rpp-grey-darkest text-base">
              {job.orderNumber}
            </h3>
            <p className="text-sm text-rpp-grey">{job.address}</p>
          </div>
        </div>
        
        {/* Customer info */}
        <div className="flex items-center gap-2 text-sm text-rpp-grey mb-1">
          <User className="w-4 h-4 text-rpp-grey-light" />
          <span>{job.customerName || 'Customer'}</span>
        </div>
        
        {/* Editor info with avatar */}
        <div className="flex items-center gap-2 text-sm text-rpp-grey mb-2">
          <div className="w-5 h-5 rounded-full bg-rpp-orange flex items-center justify-center text-white text-xs font-medium">
            JS
          </div>
          <span>John Smith</span>
        </div>
        
        {/* File count */}
        <div className="flex items-center gap-2 text-sm text-rpp-grey-light mb-3">
          <FileText className="w-4 h-4" />
          <span>{job.originalFiles?.length || 0} files</span>
        </div>
        
        {/* Auto-approval timer for revisions stage */}
        {stage === 'revisions' && autoApprovalDays !== null && (
          <div className="flex items-center gap-2 bg-rpp-orange-subtle text-rpp-orange rounded-lg px-3 py-2 text-sm mb-3">
            <Timer className="w-4 h-4" />
            <span>Auto-approves in {autoApprovalDays} days</span>
          </div>
        )}
        
        {/* Revision notes preview */}
        {(stage === 'revisions' || stage === 'human_check') && job.revisionNotes && (
          <div className="bg-rpp-grey-lightest rounded-lg p-3 text-sm text-rpp-grey mb-3 line-clamp-2">
            {job.revisionNotes}
          </div>
        )}
        
        {/* Approved by badge for complete stage */}
        {stage === 'complete' && job.approvedBy && (
          <div className="flex items-center gap-2 text-semantic-green text-sm mb-3">
            <CheckCircle className="w-4 h-4" />
            <span>Approved by {job.approvedBy === 'admin' ? 'Admin' : 'Partner'}</span>
          </div>
        )}
        
        {/* Action buttons based on stage */}
        <div className="flex flex-col gap-2">
          {stage === 'new_order' && (
            <>
              <Button
                size="sm"
                className="w-full justify-center gap-2 bg-semantic-green hover:bg-semantic-green/90 text-white rounded-xl"
                onClick={() => onAcceptOrder(job.orderId)}
              >
                <Check className="w-4 h-4" />
                Accept Order
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-center gap-2 text-semantic-red border-semantic-red/30 hover:bg-semantic-red/10 hover:text-semantic-red rounded-xl"
                onClick={() => onDeclineOrder(job.orderId)}
              >
                <X className="w-4 h-4" />
                Decline
              </Button>
            </>
          )}
          
          {stage === 'work_in_progress' && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-center gap-2 text-rpp-grey-dark border-rpp-grey-lighter hover:border-rpp-orange hover:text-rpp-orange rounded-xl"
                onClick={() => onDownloadFiles(job)}
              >
                <Download className="w-4 h-4" />
                Download Files
              </Button>
              <Button
                size="sm"
                className="w-full justify-center gap-2 btn-primary-gradient rounded-xl"
                onClick={() => onUploadClick(job)}
              >
                <Upload className="w-4 h-4" />
                Upload Files
              </Button>
              <Button
                type="button"
                size="sm"
                className="w-full justify-center gap-2 bg-semantic-purple hover:bg-semantic-purple/90 text-white rounded-xl"
                onClick={() => onMarkComplete(job.orderId)}
              >
                <CheckCircle className="w-4 h-4" />
                Mark Complete
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-center gap-2 text-semantic-blue border-semantic-blue/30 hover:bg-semantic-blue/10 rounded-xl"
                onClick={() => onViewInstructions(job)}
              >
                <Eye className="w-4 h-4" />
                View Instructions
              </Button>
            </>
          )}
          
          {stage === 'revisions' && (
            <>
              <Button
                size="sm"
                className="w-full justify-center gap-2 bg-rpp-orange hover:bg-rpp-orange/90 text-white rounded-xl"
                onClick={() => onViewFeedback(job)}
              >
                <MessageSquare className="w-4 h-4" />
                View Feedback
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-center gap-2 text-rpp-grey-dark border-rpp-grey-lighter hover:border-rpp-orange hover:text-rpp-orange rounded-xl"
                onClick={() => onDownloadFiles(job)}
              >
                <Download className="w-4 h-4" />
                Download Files
              </Button>
              <Button
                size="sm"
                className="w-full justify-center gap-2 btn-primary-gradient rounded-xl"
                onClick={() => onUploadClick(job)}
              >
                <Upload className="w-4 h-4" />
                Upload Revision
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-center gap-2 text-semantic-blue border-semantic-blue/30 hover:bg-semantic-blue/10 rounded-xl"
                onClick={() => onViewInstructions(job)}
              >
                <Eye className="w-4 h-4" />
                View Instructions
              </Button>
            </>
          )}
          
          {stage === 'human_check' && (
            <Button
              size="sm"
              className="w-full justify-center gap-2 bg-semantic-purple hover:bg-semantic-purple/90 text-white rounded-xl"
              onClick={() => onStartQC(job)}
            >
              <PlayCircle className="w-4 h-4" />
              Start QC
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Main Kanban component
export function EditorOrdersKanban({
  jobs,
  onDownloadFiles,
  onUploadClick,
  onAcceptOrder,
  onDeclineOrder,
  onMarkComplete,
  onViewInstructions,
  onStartQC,
  onViewFeedback,
}: EditorOrdersKanbanProps) {
  // Group jobs by kanban stage
  const jobsByStage = useMemo(() => {
    const grouped: Record<KanbanStageId, EditorJob[]> = {
      new_order: [],
      work_in_progress: [],
      revisions: [],
      human_check: [],
      complete: [],
    };
    
    jobs.forEach(job => {
      const stage = getKanbanStage(job.status);
      grouped[stage].push(job);
    });
    
    return grouped;
  }, [jobs]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {KANBAN_STAGES.map(stage => {
        const Icon = stage.icon;
        const count = jobsByStage[stage.id].length;
        
        return (
          <div key={stage.id} className="flex flex-col">
            {/* Column header tab - pill style */}
            <div
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-full ${stage.bgColor} ${stage.textColor} font-medium text-sm mb-4 shadow-sm`}
            >
              <Icon className="w-4 h-4" />
              <span>{stage.label}</span>
              <span className={`ml-1 px-2.5 py-0.5 rounded-full ${stage.textColor === 'text-white' ? 'bg-white/20' : 'bg-black/10'} text-xs font-bold`}>
                {count}
              </span>
            </div>
            
            {/* Column content */}
            <div className="flex-1 space-y-3">
              {jobsByStage[stage.id].length === 0 ? (
                <div className="h-40 border-2 border-dashed border-rpp-grey-lighter rounded-xl flex items-center justify-center text-rpp-grey-light text-sm">
                  No orders
                </div>
              ) : (
                jobsByStage[stage.id].map(job => (
                  <OrderCard
                    key={job.orderId}
                    job={job}
                    stage={stage.id}
                    onDownloadFiles={onDownloadFiles}
                    onUploadClick={onUploadClick}
                    onAcceptOrder={onAcceptOrder}
                    onDeclineOrder={onDeclineOrder}
                    onViewInstructions={onViewInstructions}
                    onStartQC={onStartQC}
                    onMarkComplete={onMarkComplete}
                    onViewFeedback={onViewFeedback}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { getKanbanStage, KANBAN_STAGES };
export type { EditorJob, KanbanStageId };
