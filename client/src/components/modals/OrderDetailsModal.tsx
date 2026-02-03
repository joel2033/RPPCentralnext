import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Download, 
  FileText, 
  Calendar, 
  MapPin, 
  User,
  Building2,
  Loader2
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { auth } from "@/lib/firebase";

interface OrderService {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  instructions?: string;
  exportTypes?: string;
  files?: Array<{
    id: string;
    fileName: string;
    originalName: string;
    downloadUrl: string;
    fileSize: number;
  }>;
  addedBySupplier?: boolean;
}

interface OrderDetails {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  jobAddress: string;
  jobId?: string;
  supplier: {
    id: string;
    studioName: string;
    email?: string;
  } | null;
  createdBy: {
    id: string;
    name: string;
    email?: string;
  } | null;
  services: OrderService[];
  files: Array<{
    id: string;
    fileName: string;
    originalName: string;
    downloadUrl: string;
    fileSize: number;
  }>;
  serviceFee: number;
  subtotal: number;
  total: number;
  revisionStatus?: {
    maxRounds: number;
    usedRounds: number;
    remainingRounds: number;
  };
}

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderDetails | null;
  onRequestRevision: () => void;
  onViewInstructions?: (serviceId: string) => void;
  isLoading?: boolean;
}

// Get initials from name
function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Format date
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

// Get status badge styling
function getStatusBadgeClass(status: string): string {
  switch (status?.toLowerCase()) {
    case "completed":
    case "fulfilled":
    case "delivered":
      return "bg-support-green text-white";
    case "processing":
    case "in_progress":
      return "bg-semantic-blue text-white";
    case "in_revision":
      return "bg-rpp-orange text-white";
    case "pending":
      return "bg-yellow-500 text-white";
    case "cancelled":
      return "bg-gray-500 text-white";
    default:
      return "bg-gray-400 text-white";
  }
}

// Format status text
function formatStatus(status: string): string {
  switch (status?.toLowerCase()) {
    case "completed":
      return "Fulfilled";
    case "delivered":
      return "Delivered";
    case "processing":
      return "Processing";
    case "in_progress":
      return "In Progress";
    case "in_revision":
      return "In Revision";
    case "pending":
      return "Pending";
    case "cancelled":
      return "Cancelled";
    default:
      return status || "Unknown";
  }
}

export function OrderDetailsModal({
  isOpen,
  onClose,
  order,
  onRequestRevision,
  onViewInstructions,
  isLoading,
}: OrderDetailsModalProps) {
  const [isDownloadingFiles, setIsDownloadingFiles] = useState(false);

  if (!order && !isLoading) return null;

  const handleDownloadFile = (downloadUrl: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAllFiles = async () => {
    if (!order) return;
    setIsDownloadingFiles(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/orders/${order.id}/files/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to download files');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `order_${order.orderNumber}_files.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading files:', error);
    } finally {
      setIsDownloadingFiles(false);
    }
  };

  const canRequestRevision = order && 
    (order.status === "completed" || order.status === "fulfilled" || order.status === "delivered") &&
    (!order.revisionStatus || order.revisionStatus.remainingRounds > 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rpp-orange"></div>
          </div>
        ) : order ? (
          <>
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="text-xl font-semibold text-rpp-grey-darkest">
                Order Details
              </DialogTitle>
            </DialogHeader>

            <ScrollArea className="max-h-[calc(90vh-180px)]">
              <div className="p-6 pt-4 space-y-6">
                {/* Order Header */}
                <div className="flex items-center gap-3">
                  <span className="text-rpp-grey">Order</span>
                  <span className="font-semibold text-rpp-grey-darkest">
                    #{order.orderNumber}
                  </span>
                  <Badge className={getStatusBadgeClass(order.status)}>
                    {formatStatus(order.status)}
                  </Badge>
                </div>

                {/* Order Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-rpp-grey">
                      <Calendar className="w-4 h-4" />
                      <span>Date Created</span>
                    </div>
                    <p className="text-sm font-medium text-rpp-grey-darkest">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-rpp-grey">
                      <MapPin className="w-4 h-4" />
                      <span>Job</span>
                    </div>
                    <p className="text-sm font-medium text-rpp-grey-darkest truncate" title={order.jobAddress}>
                      {order.jobAddress}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-rpp-grey">
                      <Building2 className="w-4 h-4" />
                      <span>Supplier</span>
                    </div>
                    {order.supplier ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs bg-rpp-orange text-white">
                            {getInitials(order.supplier.studioName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-rpp-grey-darkest">
                            {order.supplier.studioName}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-rpp-grey">Unassigned</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-rpp-grey">
                      <User className="w-4 h-4" />
                      <span>Created by</span>
                    </div>
                    {order.createdBy ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs bg-support-green text-white">
                            {getInitials(order.createdBy.name)}
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-sm font-medium text-rpp-grey-darkest">
                          {order.createdBy.name}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-rpp-grey">Unknown</p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Order Summary */}
                <div>
                  <h3 className="font-semibold text-rpp-grey-darkest mb-4">
                    Order Summary
                  </h3>

                  {/* Services Table */}
                  <div className="border border-rpp-grey-lighter rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-rpp-grey-surface">
                        <tr>
                          <th className="text-left py-2 px-3 text-sm font-medium text-rpp-grey">
                            Service
                          </th>
                          <th className="text-center py-2 px-3 text-sm font-medium text-rpp-grey">
                            Quantity
                          </th>
                          <th className="text-right py-2 px-3 text-sm font-medium text-rpp-grey">
                            Unit Price
                          </th>
                          <th className="text-right py-2 px-3 text-sm font-medium text-rpp-grey">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.services.map((service, index) => (
                          <tr
                            key={service.id || index}
                            className="border-t border-rpp-grey-lighter"
                          >
                            <td className="py-3 px-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-rpp-grey-darkest">
                                    {service.name}
                                  </span>
                                  {service.addedBySupplier && (
                                    <Badge variant="outline" className="text-xs py-0">
                                      Added By Supplier
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                  {service.instructions && onViewInstructions && (
                                    <button
                                      onClick={() => onViewInstructions(service.id)}
                                      className="text-semantic-blue hover:underline"
                                    >
                                      Instructions
                                    </button>
                                  )}
                                  {service.files && service.files.length > 0 && (
                                    <button
                                      onClick={() => {
                                        service.files?.forEach(file => {
                                          handleDownloadFile(file.downloadUrl, file.originalName);
                                        });
                                      }}
                                      className="text-semantic-blue hover:underline"
                                    >
                                      Uploads
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center text-sm text-rpp-grey-dark">
                              {service.quantity}
                            </td>
                            <td className="py-3 px-3 text-right text-sm text-rpp-grey-dark">
                              {formatCurrency(service.unitPrice)}
                            </td>
                            <td className="py-3 px-3 text-right text-sm font-medium text-rpp-grey-darkest">
                              {formatCurrency(service.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Totals */}
                    <div className="border-t border-rpp-grey-lighter bg-white">
                      {order.serviceFee > 0 && (
                        <div className="flex justify-between py-2 px-3">
                          <span className="text-sm text-rpp-grey">Service Fee</span>
                          <span className="text-sm text-rpp-grey-dark">
                            {formatCurrency(order.serviceFee)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between py-3 px-3 bg-rpp-grey-lightest">
                        <span className="text-sm font-semibold text-rpp-grey-darkest">
                          Total
                        </span>
                        <span className="text-sm font-semibold text-rpp-grey-darkest">
                          US{formatCurrency(order.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Original Files Section */}
                {order.files && order.files.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-rpp-grey-lightest rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-rpp-grey" />
                      <span className="text-sm text-rpp-grey-dark">
                        Original Files ({order.files.length})
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDownloadAllFiles}
                      disabled={isDownloadingFiles}
                      className="flex-shrink-0"
                    >
                      {isDownloadingFiles ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                )}

                {/* Revision Status */}
                {order.revisionStatus && (
                  <div className="bg-rpp-grey-lightest rounded-lg p-3">
                    <p className="text-sm text-rpp-grey">
                      Customer Revision rounds: {order.revisionStatus.usedRounds} / {order.revisionStatus.maxRounds} used
                      {order.revisionStatus.remainingRounds === 0 && (
                        <span className="text-semantic-red ml-2">(No revisions remaining)</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Footer with Request Revision Button */}
            <div className="p-4 border-t border-rpp-grey-lighter flex justify-end">
              <Button
                onClick={onRequestRevision}
                disabled={!canRequestRevision}
                className="bg-transparent border border-rpp-orange text-rpp-orange hover:bg-rpp-orange hover:text-white"
              >
                Request Revision
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export type { OrderDetails, OrderService };
