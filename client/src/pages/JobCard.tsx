import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MapPin, User, Calendar, DollarSign, Upload, Image, FileText, Video, Eye, Building, Send, Star, Pencil } from "lucide-react";
import { format } from "date-fns";
import { getAuth } from "firebase/auth";
import GoogleMapEmbed from "@/components/GoogleMapEmbed";
import ActivityTimeline from "@/components/ActivityTimeline";
import FileGallery from "@/components/FileGallery";
import SendDeliveryEmailModal from "@/components/modals/SendDeliveryEmailModal";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

const auth = getAuth();

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
}

export default function JobCard() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const jobId = params.jobId;
  const { toast } = useToast();
  const [deliveryModalJob, setDeliveryModalJob] = useState<JobCardData | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  const { data: jobData, isLoading, error } = useQuery<JobCardData>({
    queryKey: ['/api/jobs/card', jobId],
    enabled: !!jobId,
  });

  // Mutation to update job name
  const updateJobNameMutation = useMutation({
    mutationFn: async (newName: string) => {
      const token = await auth.currentUser?.getIdToken();
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

  const clientReview = {
    rating: 5,
    title: "Excellent",
    quote: "Absolutely stunning work! The ocean view shots are breathtaking and the twilight photos captured the property perfectly. Very professional service and exceeded our expectations. Will definitely use again for future listings.",
    reviewer: "Michael Anderson",
    reviewedOn: "October 15, 2025"
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
            <Button 
              size="sm"
              className="hover:!bg-rpp-red-dark !text-white hover:shadow-lg transition-all !opacity-100 disabled:!opacity-60 disabled:cursor-not-allowed bg-[#f05a2a]"
              data-testid="button-delivery"
              disabled={jobData.status !== 'delivered'}
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
          </div>
          <Badge className={getStatusColor(jobData.status)}>
            {formatStatusForDisplay(jobData.status)}
          </Badge>
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
            <CardHeader>
              <CardTitle className="flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                Property Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-600 font-medium">{jobData.address}</p>
                <GoogleMapEmbed address={jobData.address} />
                <Button variant="outline" size="sm" className="w-full">
                  View Larger Map
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Customer Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Customer
              </CardTitle>
            </CardHeader>
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
          </Card>

          {/* Appointments Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Appointments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {jobData.appointmentDate && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Scheduled Shoot</span>
                      <Badge variant="outline">Upcoming</Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {format(new Date(jobData.appointmentDate), 'MMM dd, yyyy')}
                    </p>
                    <p className="text-sm text-gray-600">
                      {format(new Date(jobData.appointmentDate), 'h:mm a')}
                    </p>
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Appointment
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Billing Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Billing Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Value</span>
                  <span className="font-medium">${jobData.totalValue || '0.00'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <Badge variant="outline">Draft</Badge>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  View Invoice
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Client Review */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Star className="h-5 w-5 mr-2 text-[#f7b500]" />
                Client Review
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-1 text-[#f7b500]">
                {Array.from({ length: clientReview.rating }).map((_, index) => (
                  <Star key={index} className="h-4 w-4 text-[#f7b500]" fill="currentColor" />
                ))}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{clientReview.title}</p>
                <p className="text-sm text-gray-600 mt-2">
                  “{clientReview.quote}”
                </p>
              </div>
              <div className="text-xs text-gray-500">
                Reviewed by {clientReview.reviewer} on {clientReview.reviewedOn}
              </div>
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
        />
      )}
    </div>
  );
}