import { useState, useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, User, Calendar, DollarSign, Upload, Image, FileText, Video, Eye, Building, Send, Star, Pencil, ChevronDown, ChevronUp, Edit, Trash2, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import { getAuth } from "firebase/auth";
import GoogleMapEmbed from "@/components/GoogleMapEmbed";
import ActivityTimeline from "@/components/ActivityTimeline";
import FileGallery from "@/components/FileGallery";
import SendDeliveryEmailModal from "@/components/modals/SendDeliveryEmailModal";
import CreateAppointmentModal from "@/components/modals/CreateAppointmentModal";
import AppointmentDetailsModal from "@/components/modals/AppointmentDetailsModal";
import BillingSection, { BillingItem } from "@/components/BillingSection";
import { InvoiceDetailsModal } from "@/components/modals/InvoiceDetailsModal";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useMasterView } from "@/contexts/MasterViewContext";
import { auth } from "@/lib/firebase";
import { apiRequest } from "@/lib/queryClient";

const firebaseAuth = getAuth();

interface JobCardData {
  id: string;
  jobId: string;
  deliveryToken?: string;
  partnerId: string;
  address: string;
  jobName?: string;
  customerId?: string;
  totalValue?: string;
  status?: string;
  assignedTo?: string;
  appointmentDate?: string;
  dueDate?: string;
  propertyImage?: string;
  propertyImageThumbnail?: string;
  notes?: string;
  billingItems?: string; // JSON string of BillingItem[]
  invoiceStatus?: string;
  xeroInvoiceId?: string | null;
  xeroInvoiceNumber?: string | null;
  createdAt: string;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    company?: string;
    category?: string;
    profileImage?: string;
  };
  jobReview?: {
    id: string;
    jobId: string;
    rating: number;
    review?: string;
    submittedBy?: string;
    submittedByEmail?: string;
    createdAt: string;
  };
}

export default function JobCard() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const jobId = params.jobId;
  const { toast } = useToast();
  const [deliveryModalJob, setDeliveryModalJob] = useState<JobCardData | null>(null);
  const [showCreateAppointment, setShowCreateAppointment] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, { products: boolean; notes: boolean }>>({});
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const { isReadOnly } = useMasterView();
  
  // Billing state
  const [billingItems, setBillingItems] = useState<BillingItem[]>([]);
  const [invoiceStatus, setInvoiceStatus] = useState<string>("draft");

  const { data: jobData, isLoading, error } = useQuery<JobCardData>({
    queryKey: ['/api/jobs/card', jobId],
    enabled: !!jobId,
  });

  const { data: xeroStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/auth/xero/status"],
    enabled: !!jobId,
  });

  const raiseInvoiceMutation = useMutation({
    mutationFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/jobs/${jobId}/raise-invoice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error || data.message || res.statusText;
        const detail = data.detail ? ` ${data.detail}` : "";
        throw new Error(`${typeof msg === "string" ? msg : JSON.stringify(msg)}${detail}`);
      }
      return data;
    },
    onSuccess: (data: { invoiceNumber?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/card', jobId] });
      toast({
        title: "Invoice raised",
        description: data.invoiceNumber ? `Invoice ${data.invoiceNumber} created in Xero.` : "Invoice created in Xero.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to raise invoice",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch appointments for this job
  const { data: appointments = [], isLoading: isLoadingAppointments } = useQuery<any[]>({
    queryKey: ["/api/jobs", jobId, "appointments"],
    enabled: !!jobId,
    queryFn: async () => {
      if (!jobId) return [];
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          console.error('[JobCard] No auth token available');
          return [];
        }
        
        const response = await fetch(`/api/jobs/${jobId}/appointments`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          console.log('[JobCard] Appointments API response:', data);
          return data;
        }
        const errorText = await response.text();
        console.error('[JobCard] Failed to fetch appointments:', response.status, response.statusText, errorText);
        return [];
      } catch (error) {
        console.error('[JobCard] Error fetching appointments:', error);
        return [];
      }
    },
  });

  // Initialize billing state from job data
  useEffect(() => {
    if (jobData) {
      // Parse billing items from JSON string
      if (jobData.billingItems) {
        try {
          const parsed = JSON.parse(jobData.billingItems);
          setBillingItems(Array.isArray(parsed) ? parsed : []);
        } catch (e) {
          console.error("Failed to parse billing items:", e);
          setBillingItems([]);
        }
      } else {
        setBillingItems([]);
      }
      setInvoiceStatus(jobData.invoiceStatus || "draft");
    }
  }, [jobData]);

  // Mutation to update billing items
  const updateBillingMutation = useMutation({
    mutationFn: async ({ items, status }: { items: BillingItem[]; status: string }) => {
      const token = await firebaseAuth.currentUser?.getIdToken();
      const response = await fetch(`/api/jobs/${jobData?.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          billingItems: JSON.stringify(items),
          invoiceStatus: status,
          // Also update totalValue to match billing total (including tax)
          totalValue: items.reduce((sum, item) => sum + item.amount + (item.amount * item.taxRate / 100), 0).toFixed(2),
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update billing");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/card', jobId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update billing",
        variant: "destructive",
      });
    },
  });

  // Handler for billing items change
  const handleBillingItemsChange = (items: BillingItem[]) => {
    setBillingItems(items);
    updateBillingMutation.mutate({ items, status: invoiceStatus });
  };

  // Handler for invoice status change
  const handleInvoiceStatusChange = (status: string) => {
    setInvoiceStatus(status);
    updateBillingMutation.mutate({ items: billingItems, status });
  };

  // Mutation to update job name
  const updateJobNameMutation = useMutation({
    mutationFn: async (newName: string) => {
      const token = await firebaseAuth.currentUser?.getIdToken();
      const response = await fetch(`/api/jobs/${jobData?.id}/name`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jobName: newName }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update job name");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/card', jobId] });
      toast({
        title: "Success",
        description: "Job name updated successfully!",
      });
      setIsEditingName(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update job name",
        variant: "destructive",
      });
    },
  });

  // Mutation to update job status with optimistic updates
  const updateJobStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const token = await firebaseAuth.currentUser?.getIdToken();
      const response = await fetch(`/api/jobs/${jobData?.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update job status");
      }
      return response.json();
    },
    // Optimistic update - update UI immediately before server responds
    onMutate: async (newStatus: string) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['/api/jobs/card', jobId] });
      await queryClient.cancelQueries({ queryKey: ["/api/jobs"] });

      // Snapshot the previous value for rollback
      const previousJobData = queryClient.getQueryData<JobCardData>(['/api/jobs/card', jobId]);
      const previousJobsList = queryClient.getQueryData<any[]>(['/api/jobs']);

      // Optimistically update the job card data
      if (previousJobData) {
        queryClient.setQueryData<JobCardData>(['/api/jobs/card', jobId], {
          ...previousJobData,
          status: newStatus,
        });
      }

      // Optimistically update the jobs list
      if (previousJobsList) {
        queryClient.setQueryData<any[]>(['/api/jobs'], (old) => {
          if (!old) return old;
          return old.map((job) =>
            job.id === jobData?.id ? { ...job, status: newStatus } : job
          );
        });
      }

      // Return context with previous data for rollback
      return { previousJobData, previousJobsList };
    },
    onSuccess: () => {
      // Invalidate to ensure we have the latest data from server
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/card', jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Job status updated successfully!",
      });
    },
    onError: (error: any, newStatus: string, context: any) => {
      // Rollback to previous data on error
      if (context?.previousJobData) {
        queryClient.setQueryData(['/api/jobs/card', jobId], context.previousJobData);
      }
      if (context?.previousJobsList) {
        queryClient.setQueryData(['/api/jobs'], context.previousJobsList);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update job status",
        variant: "destructive",
      });
    },
  });

  const { data: completedFilesData, isLoading: isFilesLoading } = useQuery<{
    completedFiles: Array<{
      orderId: string;
      orderNumber: string;
      files: Array<{
        id: string;
        fileName: string;
        originalName: string;
        fileSize: number;
        mimeType: string;
        downloadUrl: string;
        uploadedAt: string;
        notes?: string;
      }>;
    }>;
  }>({
    queryKey: [`/api/jobs/${jobId}/completed-files`],
    enabled: !!jobId,
  });

  // Helper functions for editable job name
  const customerProfileId = jobData?.customer?.id ?? jobData?.customerId ?? null;

  const handleStartEdit = () => {
    setEditNameValue(jobData?.jobName || jobData?.address || "");
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    const trimmedValue = editNameValue.trim();
    if (trimmedValue && trimmedValue !== (jobData?.jobName || jobData?.address)) {
      updateJobNameMutation.mutate(trimmedValue);
    } else {
      setIsEditingName(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditNameValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-48 bg-gray-200 rounded"></div>
            </div>
            <div className="space-y-6">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !jobData) {
    return (
      <div className="container mx-auto p-6">
        <Button 
          variant="outline" 
          onClick={() => setLocation('/jobs')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Jobs
        </Button>
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-500">Job not found or failed to load.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'booked': return 'bg-purple-100 text-purple-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'on_hold': return 'bg-orange-100 text-orange-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatusForDisplay = (status?: string) => {
    if (!status) return 'Booked';
    const statusMap: Record<string, string> = {
      'booked': 'Booked',
      'pending': 'Pending',
      'on_hold': 'On Hold',
      'delivered': 'Delivered',
      'cancelled': 'Cancelled'
    };
    return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  };

  const getRatingText = (stars: number) => {
    if (stars === 5) return "Excellent!";
    if (stars === 4) return "Great!";
    if (stars === 3) return "Good";
    if (stars === 2) return "Fair";
    if (stars === 1) return "Poor";
    return "";
  };

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            onClick={() => setLocation('/jobs')}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Button>
          <div className="flex items-center gap-3">
            <div className="group relative">
              {isEditingName ? (
                <Input
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSaveName}
                  autoFocus
                  className="text-2xl font-bold h-auto py-1 px-2 border-2 border-blue-500 focus-visible:ring-0"
                  data-testid="input-job-name"
                />
              ) : (
                <h1
                  onClick={handleStartEdit}
                  className="text-lg font-medium cursor-pointer hover:text-blue-600 transition-colors flex items-center gap-2"
                  data-testid="heading-job-name"
                >
                  {jobData.jobName || jobData.address}
                  <Pencil className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h1>
              )}
            </div>
            {!isReadOnly && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md">
                    <Badge className={`${getStatusColor(jobData.status)} cursor-pointer hover:opacity-90 hover:shadow-sm transition-all flex items-center gap-1.5 px-2.5 py-1`}>
                      {formatStatusForDisplay(jobData.status)}
                      <ChevronDown className="h-3 w-3 opacity-70" />
                    </Badge>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={() => updateJobStatusMutation.mutate('booked')}
                    disabled={jobData.status?.toLowerCase() === 'booked'}
                  >
                    Booked
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updateJobStatusMutation.mutate('pending')}
                    disabled={jobData.status?.toLowerCase() === 'pending'}
                  >
                    Pending
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updateJobStatusMutation.mutate('on_hold')}
                    disabled={jobData.status?.toLowerCase() === 'on_hold'}
                  >
                    On Hold
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updateJobStatusMutation.mutate('delivered')}
                    disabled={jobData.status?.toLowerCase() === 'delivered'}
                  >
                    Delivered
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updateJobStatusMutation.mutate('cancelled')}
                    disabled={jobData.status?.toLowerCase() === 'cancelled'}
                    className="text-red-600"
                  >
                    Cancelled
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {isReadOnly && (
              <Badge className={getStatusColor(jobData.status)}>
                {formatStatusForDisplay(jobData.status)}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              data-testid="button-preview"
              onClick={() => {
                const token = jobData.deliveryToken || jobData.jobId;
                if (!token) return;
                const newWindow = window.open(`/delivery/${token}`, '_blank', 'noopener,noreferrer');
                if (newWindow) newWindow.opener = null;
              }}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              data-testid="button-share"
              onClick={async () => {
                const token = jobData.deliveryToken || jobData.jobId;
                if (!token) return;
                try {
                  const deliveryUrl = `${window.location.origin}/delivery/${token}`;
                  await navigator.clipboard.writeText(deliveryUrl);
                  toast({
                    title: "Link copied!",
                    description: "Delivery link has been copied to your clipboard.",
                  });
                } catch (error) {
                  toast({
                    title: "Copy failed",
                    description: "Could not copy link to clipboard. Please copy manually from the address bar.",
                    variant: "destructive",
                  });
                }
              }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Share
            </Button>
            {!isReadOnly && (
              <Button 
                size="sm"
                className="hover:!bg-rpp-red-dark !text-white hover:shadow-lg transition-all !opacity-100 disabled:!opacity-60 disabled:cursor-not-allowed bg-[#f05a2a]"
                data-testid="button-delivery"
                onClick={(e) => {
                  e.stopPropagation();
                  const token = jobData.deliveryToken || jobData.jobId;
                  if (!token) return;
                  setDeliveryModalJob(jobData);
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                Deliver
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Completed Files Gallery */}
          <Card>
            <CardHeader>
              <CardTitle>Completed Deliverables</CardTitle>
              <p className="text-sm text-gray-600">View and download completed files from editors</p>
            </CardHeader>
            <CardContent>
              {jobId ? (
                <FileGallery 
                  completedFiles={completedFilesData?.completedFiles || []} 
                  jobId={jobId}
                  isLoading={isFilesLoading}
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">Invalid job ID</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <ActivityTimeline jobId={jobData.jobId} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Property Location */}
          <Card>
            <CardHeader 
              className="cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedCards(prev => ({ ...prev, propertyLocation: !prev.propertyLocation }))}
            >
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 mr-2" />
                  Property Location
                </div>
                {expandedCards.propertyLocation ? (
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </CardTitle>
            </CardHeader>
            {expandedCards.propertyLocation && (
              <CardContent>
                <div className="space-y-4">
                  <p className="text-gray-600 font-medium">{jobData.address}</p>
                  <GoogleMapEmbed address={jobData.address} />
                  <Button variant="outline" size="sm" className="w-full">
                    View Larger Map
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Customer Section */}
          <Card>
            <CardHeader 
              className="cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedCards(prev => ({ ...prev, customer: !prev.customer }))}
            >
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Customer
                </div>
                {expandedCards.customer ? (
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </CardTitle>
            </CardHeader>
            {expandedCards.customer && (
              <CardContent>
                {jobData.customer ? (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{jobData.customer.firstName} {jobData.customer.lastName}</p>
                        <p className="text-sm text-gray-500">{jobData.customer.email}</p>
                      </div>
                    </div>
                    {jobData.customer.company && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Building className="h-4 w-4" />
                        <span>{jobData.customer.company}</span>
                      </div>
                    )}
                    {jobData.customer.phone && (
                      <p className="text-sm text-gray-600">{jobData.customer.phone}</p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      asChild
                      disabled={!customerProfileId}
                    >
                      <Link href={customerProfileId ? `/customers/${customerProfileId}` : "#"}>
                        View Profile
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No customer assigned</p>
                )}
              </CardContent>
            )}
          </Card>

          {/* Appointments Section */}
          <Card>
            <CardHeader 
              className="cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedCards(prev => ({ ...prev, appointments: !prev.appointments }))}
            >
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  Appointments
                </div>
                {expandedCards.appointments ? (
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </CardTitle>
            </CardHeader>
            {expandedCards.appointments && (
              <CardContent>
              <div className="space-y-4">
                {isLoadingAppointments ? (
                  // Loading skeletons for appointments
                  <>
                    {[1, 2].map((i) => (
                      <div key={i} className="p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-5 w-16" />
                        </div>
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    ))}
                  </>
                ) : appointments.length > 0 ? (
                  appointments.map((appointment: any) => {
                    // Get products from appointment.products field
                    let appointmentProducts: any[] = [];
                    try {
                      if (appointment.products) {
                        appointmentProducts = typeof appointment.products === 'string' 
                          ? JSON.parse(appointment.products) 
                          : appointment.products;
                      }
                    } catch (error) {
                      console.error('[JobCard] Error parsing appointment products:', error);
                    }

                    return (
                      <div
                        key={appointment.id}
                        className="p-4 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer group relative"
                        onClick={(e) => {
                          // Don't open modal if clicking on action buttons
                          if ((e.target as HTMLElement).closest('.appointment-actions')) {
                            return;
                          }
                          setSelectedAppointment(appointment);
                        }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-gray-800">Scheduled Shoot</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {appointment.status === 'scheduled' ? 'Upcoming' :
                               appointment.status === 'completed' ? 'Completed' :
                               appointment.status === 'cancelled' ? 'Cancelled' : 'Upcoming'}
                            </Badge>
                            {!isReadOnly && (
                              <div className="appointment-actions flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAppointment(appointment);
                                  }}
                                  title="Edit appointment"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (window.confirm("Are you sure you want to delete this appointment?")) {
                                      try {
                                        const token = await auth.currentUser?.getIdToken();
                                        const appointmentId = appointment.appointmentId || appointment.id;
                                        const response = await fetch(`/api/appointments/${appointmentId}`, {
                                          method: "DELETE",
                                          headers: token ? {
                                            'Authorization': `Bearer ${token}`,
                                          } : {},
                                          credentials: 'include',
                                        });
                                        if (response.ok) {
                                          toast({
                                            title: "Success",
                                            description: "Appointment deleted successfully!",
                                          });
                                          queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "appointments"] });
                                          queryClient.invalidateQueries({ queryKey: ["/api/jobs/card", jobId] });
                                        } else {
                                          throw new Error("Failed to delete appointment");
                                        }
                                      } catch (error: any) {
                                        toast({
                                          title: "Error",
                                          description: error.message || "Failed to delete appointment",
                                          variant: "destructive",
                                        });
                                      }
                                    }
                                  }}
                                  title="Delete appointment"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-baseline gap-3">
                          <p className="text-sm font-medium text-gray-800">
                            {format(new Date(appointment.appointmentDate), 'MMM dd, yyyy')}
                          </p>
                          <p className="text-sm text-gray-500">
                            {format(new Date(appointment.appointmentDate), 'h:mm a')}
                          </p>
                        </div>
                        {appointment.estimatedDuration && (
                          <p className="text-xs text-gray-500 mt-1.5">
                            Duration: {appointment.estimatedDuration} min
                          </p>
                        )}
                        {appointmentProducts.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-blue-200">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedSections(prev => ({
                                  ...prev,
                                  [appointment.id]: {
                                    ...prev[appointment.id],
                                    products: !prev[appointment.id]?.products
                                  }
                                }));
                              }}
                              className="flex items-center justify-between w-full text-left hover:opacity-80 transition-opacity"
                            >
                              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Products</p>
                              {expandedSections[appointment.id]?.products ? (
                                <ChevronUp className="h-3.5 w-3.5 text-gray-500" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                              )}
                            </button>
                            {expandedSections[appointment.id]?.products && (
                              <div className="space-y-1.5 mt-2">
                                {appointmentProducts.map((product: any, index: number) => {
                                  const productName = product.name || product.title || product.id;
                                  const shouldAppendVariation = !product.name && product.variationName;
                                  return (
                                    <p key={index} className="text-sm text-gray-700">
                                      {productName}
                                      {shouldAppendVariation && ` - ${product.variationName}`}
                                      {product.quantity && product.quantity > 1 && <span className="text-gray-500 ml-1">(x{product.quantity})</span>}
                                    </p>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                        {appointment.notes && (
                          <div className="mt-3 pt-3 border-t border-blue-200">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedSections(prev => ({
                                  ...prev,
                                  [appointment.id]: {
                                    ...prev[appointment.id],
                                    notes: !prev[appointment.id]?.notes
                                  }
                                }));
                              }}
                              className="flex items-center justify-between w-full text-left hover:opacity-80 transition-opacity"
                            >
                              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Notes</p>
                              {expandedSections[appointment.id]?.notes ? (
                                <ChevronUp className="h-3.5 w-3.5 text-gray-500" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                              )}
                            </button>
                            {expandedSections[appointment.id]?.notes && (
                              <p className="text-sm text-gray-700 mt-2">{appointment.notes}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : jobData?.appointmentDate ? (
                  // Fallback: Show old appointmentDate if no appointments found
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-gray-800">Scheduled Shoot</span>
                      <Badge variant="outline" className="text-xs">Upcoming</Badge>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <p className="text-sm font-medium text-gray-800">
                        {format(new Date(jobData.appointmentDate), 'MMM dd, yyyy')}
                      </p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(jobData.appointmentDate), 'h:mm a')}
                      </p>
                    </div>
                  </div>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowCreateAppointment(true)}
                  data-testid="button-schedule-appointment"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Appointment
                </Button>
              </div>
            </CardContent>
            )}
          </Card>

          {/* Billing Section */}
          <BillingSection
            jobId={jobData.jobId}
            billingItems={billingItems}
            invoiceStatus={invoiceStatus}
            onBillingItemsChange={handleBillingItemsChange}
            onInvoiceStatusChange={handleInvoiceStatusChange}
            isReadOnly={isReadOnly}
            isCollapsed={!expandedCards.billing}
            onToggleCollapse={() => setExpandedCards(prev => ({ ...prev, billing: !prev.billing }))}
            xeroConnected={xeroStatus?.connected ?? false}
            xeroInvoiceId={jobData.xeroInvoiceId}
            xeroInvoiceNumber={jobData.xeroInvoiceNumber}
            onRaiseInvoice={jobData.xeroInvoiceId ? undefined : () => raiseInvoiceMutation.mutate()}
            isRaisingInvoice={raiseInvoiceMutation.isPending}
            onViewInvoice={() => setShowInvoiceModal(true)}
          />

          {/* Client Review */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Star className="h-5 w-5 mr-2 text-[#f7b500]" />
                Client Review
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {jobData.jobReview ? (
                <>
                  <div className="flex items-center space-x-1 text-[#f7b500]">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star 
                        key={index} 
                        className={`h-4 w-4 ${
                          index < jobData.jobReview!.rating 
                            ? 'text-[#f7b500] fill-current' 
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  {jobData.jobReview.rating > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {getRatingText(jobData.jobReview.rating)}
                      </p>
                    </div>
                  )}
                  {jobData.jobReview.review && (
                    <p className="text-sm text-gray-600 mt-2">
                      "{jobData.jobReview.review}"
                    </p>
                  )}
                  <div className="text-xs text-gray-500">
                    {jobData.jobReview.submittedBy && (
                      <>Reviewed by {jobData.jobReview.submittedBy}</>
                    )}
                    {jobData.jobReview.createdAt && (
                      <>
                        {jobData.jobReview.submittedBy && ' on '}
                        {format(new Date(jobData.jobReview.createdAt), "MMMM d, yyyy")}
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center space-x-1 text-gray-300">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className="h-4 w-4" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Send Delivery Email Modal */}
      {deliveryModalJob && deliveryModalJob.customer && (
        <SendDeliveryEmailModal
          open={!!deliveryModalJob}
          onOpenChange={(open) => !open && setDeliveryModalJob(null)}
          job={deliveryModalJob}
          customer={deliveryModalJob.customer}
          onEmailSent={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
            queryClient.invalidateQueries({ queryKey: ['/api/jobs/card', jobId] });
          }}
          onJobUpdated={(updatedJob) => {
            // Update the local job state with the new delivery token
            setDeliveryModalJob((prev: JobCardData | null) => ({
              ...prev!,
              deliveryToken: updatedJob.deliveryToken,
            }));
            // Refresh the job card data to get updated data
            queryClient.invalidateQueries({ queryKey: ['/api/jobs/card', jobId] });
            queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
          }}
        />
      )}
      {/* Create Appointment Modal */}
      {showCreateAppointment && (
        <CreateAppointmentModal
          jobId={jobData.jobId}
          onClose={() => setShowCreateAppointment(false)}
          onCreated={() => {
            setShowCreateAppointment(false);
            // Refresh appointments and job card
            queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "appointments"] });
            queryClient.invalidateQueries({ queryKey: ["/api/jobs/card", jobId] });
          }}
        />
      )}

      {/* Appointment Details Modal */}
      {selectedAppointment && (
        <AppointmentDetailsModal
          appointment={selectedAppointment}
          onClose={() => {
            setSelectedAppointment(null);
            // Refresh appointments and job card after closing
            queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "appointments"] });
            queryClient.invalidateQueries({ queryKey: ["/api/jobs/card", jobId] });
          }}
        />
      )}

      {/* Invoice Details Modal */}
      <InvoiceDetailsModal
        open={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        job={jobData ? { address: jobData.address, jobName: jobData.jobName, customer: jobData.customer } : null}
        billingItems={billingItems}
        invoiceStatus={invoiceStatus}
        xeroInvoiceId={jobData?.xeroInvoiceId}
        xeroInvoiceNumber={jobData?.xeroInvoiceNumber}
        dueDate={jobData?.dueDate ? new Date(jobData.dueDate).toISOString().slice(0, 10) : undefined}
      />
    </div>
  );
}