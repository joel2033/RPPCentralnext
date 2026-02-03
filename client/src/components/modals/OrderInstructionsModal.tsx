import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Package, Settings, User, MapPin, Palette } from "lucide-react";

interface ServiceInstruction {
  fileName?: string;
  detail?: string;
}

interface ExportType {
  type?: string;
  description?: string;
}

interface Service {
  id: string;
  name?: string;
  quantity?: number;
  instructions?: string | ServiceInstruction[];
  exportTypes?: string | ExportType[];
}

interface EditorJob {
  id: string;
  jobId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  address: string;
  services: Service[];
  status: string;
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
  revisionNotes?: string;
  /** Customer editing preferences from partner dashboard (customer profile) */
  editingPreferences?: Array<{
    id: string;
    name: string;
    description?: string;
    isEnabled: boolean;
    notes?: string;
  }>;
}

interface OrderInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: EditorJob | null;
}

// Helper function to strip HTML tags from text
function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

// Parse instructions from string or array
function parseInstructions(instructions: string | ServiceInstruction[] | undefined): ServiceInstruction[] {
  if (!instructions) return [];
  
  if (typeof instructions === 'string') {
    try {
      const parsed = JSON.parse(instructions);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [{ detail: instructions }];
    }
  }
  
  return Array.isArray(instructions) ? instructions : [];
}

// Parse export types from string or array
function parseExportTypes(exportTypes: string | ExportType[] | undefined): ExportType[] {
  if (!exportTypes) return [];
  
  if (typeof exportTypes === 'string') {
    try {
      const parsed = JSON.parse(exportTypes);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [{ description: exportTypes }];
    }
  }
  
  return Array.isArray(exportTypes) ? exportTypes : [];
}

export function OrderInstructionsModal({ isOpen, onClose, job }: OrderInstructionsModalProps) {
  if (!job) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="w-5 h-5 text-semantic-blue" />
            Order Instructions
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(85vh-120px)] pr-4">
          <div className="space-y-6">
            {/* Order Header */}
            <div className="bg-rpp-grey-lightest rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-semantic-blue text-white">
                    {job.orderNumber}
                  </Badge>
                  <span className="text-sm text-rpp-grey">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {job.originalFiles?.length || 0} files
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-rpp-grey-dark">
                <User className="w-4 h-4 text-rpp-grey-light" />
                <span>{job.customerName || 'Customer'}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-rpp-grey">
                <MapPin className="w-4 h-4 text-rpp-grey-light" />
                <span>{job.address || 'No address'}</span>
              </div>
            </div>

            {/* Revision Notes (if any) */}
            {job.revisionNotes && (
              <div className="bg-rpp-orange-subtle border border-rpp-orange/30 rounded-xl p-4">
                <h3 className="font-medium text-rpp-orange mb-2 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Revision Notes
                </h3>
                <p className="text-sm text-rpp-grey-dark whitespace-pre-wrap">
                  {job.revisionNotes}
                </p>
              </div>
            )}

            {/* Services and Instructions */}
            <div className="space-y-4">
              <h3 className="font-medium text-rpp-grey-darkest flex items-center gap-2">
                <Package className="w-4 h-4 text-semantic-blue" />
                Services & Instructions
              </h3>
              
              {job.services && job.services.length > 0 ? (
                job.services.map((service, index) => {
                  const instructions = parseInstructions(service.instructions);
                  const exportTypes = parseExportTypes(service.exportTypes);
                  const hasContent = instructions.some(i => i.fileName || i.detail) || 
                                    exportTypes.some(e => e.type || e.description);
                  
                  return (
                    <div 
                      key={service.id || index} 
                      className="border border-rpp-grey-lighter rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-rpp-grey-darkest">
                          {service.name || `Service ${index + 1}`}
                        </h4>
                        {service.quantity && service.quantity > 1 && (
                          <Badge variant="secondary" className="text-xs">
                            Qty: {service.quantity}
                          </Badge>
                        )}
                      </div>
                      
                      {/* File-specific Instructions */}
                      {instructions.length > 0 && instructions.some(i => i.fileName || i.detail) && (
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-rpp-grey">
                            Instructions:
                          </h5>
                          <div className="space-y-2">
                            {instructions.map((inst, idx) => (
                              <div 
                                key={idx} 
                                className="bg-rpp-grey-lightest rounded-lg p-3 text-sm"
                              >
                                {inst.fileName && (
                                  <div className="font-medium text-rpp-grey-dark mb-1">
                                    File: {inst.fileName}
                                  </div>
                                )}
                                {inst.detail && (
                                  <div className="text-rpp-grey whitespace-pre-wrap">
                                    {stripHtml(String(inst.detail))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Export Types */}
                      {exportTypes.length > 0 && exportTypes.some(e => e.type || e.description) && (
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-rpp-grey">
                            Export Requirements:
                          </h5>
                          <div className="space-y-2">
                            {exportTypes.map((exp, idx) => (
                              <div 
                                key={idx} 
                                className="bg-semantic-blue-light rounded-lg p-3 text-sm"
                              >
                                {exp.type && (
                                  <div className="font-medium text-semantic-blue-dark mb-1">
                                    Format: {exp.type}
                                  </div>
                                )}
                                {exp.description && (
                                  <div className="text-rpp-grey-dark whitespace-pre-wrap">
                                    {stripHtml(String(exp.description))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {!hasContent && (
                        <p className="text-sm text-rpp-grey-light italic">
                          No specific instructions provided
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="border border-rpp-grey-lighter rounded-xl p-6 text-center">
                  <FileText className="w-8 h-8 text-rpp-grey-light mx-auto mb-2" />
                  <p className="text-sm text-rpp-grey-light">
                    No services or instructions available for this order.
                  </p>
                </div>
              )}
            </div>

            {/* Customer Editing Preferences (from customer profile in partner dashboard) */}
            {job.editingPreferences && job.editingPreferences.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-medium text-rpp-grey-darkest flex items-center gap-2">
                  <Palette className="w-4 h-4 text-semantic-blue" />
                  Customer Editing Preferences
                </h3>
                <div className="border border-rpp-grey-lighter rounded-xl divide-y divide-rpp-grey-lighter">
                  {job.editingPreferences
                    .filter((pref) => pref.isEnabled)
                    .map((pref) => (
                      <div key={pref.id} className="p-4">
                        <div className="font-medium text-rpp-grey-darkest">{pref.name}</div>
                        {pref.description && (
                          <div className="text-sm text-rpp-grey mt-1">{pref.description}</div>
                        )}
                        {pref.notes && (
                          <div className="text-sm text-rpp-grey-dark mt-2 bg-rpp-grey-lightest rounded-lg p-2 whitespace-pre-wrap">
                            {pref.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  {job.editingPreferences.filter((p) => p.isEnabled).length === 0 && (
                    <div className="p-4 text-sm text-rpp-grey-light italic">
                      No customer editing preferences set for this order.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* File List */}
            {job.originalFiles && job.originalFiles.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-rpp-grey-darkest flex items-center gap-2">
                  <FileText className="w-4 h-4 text-semantic-blue" />
                  Original Files ({job.originalFiles.length})
                </h3>
                <div className="border border-rpp-grey-lighter rounded-xl divide-y divide-rpp-grey-lighter">
                  {job.originalFiles.slice(0, 10).map((file, index) => (
                    <div key={file.id || index} className="px-4 py-2 flex items-center justify-between">
                      <span className="text-sm text-rpp-grey-dark truncate flex-1">
                        {file.originalName || file.fileName}
                      </span>
                      <span className="text-xs text-rpp-grey-light ml-2">
                        {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  ))}
                  {job.originalFiles.length > 10 && (
                    <div className="px-4 py-2 text-center text-sm text-rpp-grey-light">
                      +{job.originalFiles.length - 10} more files
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

