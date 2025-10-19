
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Calendar, Clock, User, MoreVertical, ChevronDown, Filter, Download, Edit2, Trash2, Send } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CreateJobModal from "@/components/modals/CreateJobModal";
import SendDeliveryEmailModal from "@/components/modals/SendDeliveryEmailModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function Jobs() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [photographerFilter, setPhotographerFilter] = useState<string>("all");
  const [, setLocation] = useLocation();
  const [renamingJob, setRenamingJob] = useState<{ id: string; currentName: string } | null>(null);
  const [newImageName, setNewImageName] = useState("");
  const [deliveryModalJob, setDeliveryModalJob] = useState<any>(null);
  const { toast } = useToast();
  
  const { data: jobs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["/api/customers"],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'delivered':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'booked':
      case 'scheduled':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'in_progress':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'cancelled':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers.find((c: any) => c.id === customerId);
    return customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown Customer';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'No date set';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: '2-digit'
    });
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const calculateDuration = (startDate: string) => {
    // For demo purposes, showing duration as "1h 30m duration"
    return '1h 30m duration';
  };

  // Image menu handlers
  const handleDownloadImage = async (imageUrl: string, jobAddress: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${jobAddress.replace(/[^a-zA-Z0-9]/g, '_')}_cover.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Image downloaded",
        description: "Cover image has been downloaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not download the image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRenameImage = (jobId: string, currentAddress: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingJob({ id: jobId, currentName: currentAddress });
    setNewImageName(currentAddress);
  };

  const deleteCoverImageMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return await apiRequest(`/api/jobs/${jobId}/cover-image`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Image deleted",
        description: "Cover image has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Could not delete the image. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteImage = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this cover image?')) {
      deleteCoverImageMutation.mutate(jobId);
    }
  };

  // Sort jobs: newest first (by appointment date, then creation date)
  const sortedJobs = [...jobs].sort((a, b) => {
    const dateA = new Date(a.appointmentDate || a.createdAt || 0).getTime();
    const dateB = new Date(b.appointmentDate || b.createdAt || 0).getTime();
    return dateB - dateA; // Newest first
  });

  const filteredJobs = sortedJobs.filter((job: any) => {
    // Search filter
    const matchesSearch = job.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getCustomerName(job.customerId).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.jobId && job.jobId.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;

    // Status filter
    if (statusFilter !== "all" && job.status !== statusFilter) return false;

    // Customer filter
    if (customerFilter !== "all" && job.customerId !== customerFilter) return false;

    // Photographer filter
    if (photographerFilter !== "all" && job.assignedPhotographerId !== photographerFilter) return false;
    
    return true;
  });

  const successfulJobsCount = jobs.filter(j => j.status === 'completed' || j.status === 'delivered').length;

  // Get unique statuses for filter
  const uniqueStatuses = Array.from(new Set(jobs.map(j => j.status).filter(Boolean)));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-rpp-grey-surface p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-rpp-grey-bg rounded w-1/4"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 bg-white rounded-2xl shadow-sm"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rpp-grey-surface">
      <div className="max-w-[1400px] mx-auto p-4">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-rpp-grey-dark font-medium text-[24px]">
                Jobs <span className="text-sm font-medium text-rpp-grey-medium">on time - ({successfulJobsCount}) successful</span>
              </h1>
              <p className="text-sm text-rpp-grey-medium mt-1">
                Find any job you've ever booked, delivered or completed.
              </p>
            </div>
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="bg-rpp-red-main hover:bg-rpp-red-dark text-white rounded-xl font-semibold"
              data-testid="button-create-job"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create new job
            </Button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="space-y-3 mb-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-rpp-grey-light" />
            <Input
              placeholder="Search for jobs, people, orders or products"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-rpp-grey-border bg-white rounded-lg h-11"
              data-testid="input-search-jobs"
            />
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-rpp-grey-medium">
              <Filter className="w-4 h-4" />
              <span className="font-medium">Filters:</span>
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] h-9 border-rpp-grey-border rounded-lg" data-testid="select-status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {uniqueStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === 'completed' ? 'Delivered' : status === 'scheduled' ? 'Booked' : status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Customer Filter */}
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="w-[200px] h-9 border-rpp-grey-border rounded-lg" data-testid="select-customer-filter">
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customers.map((customer: any) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.firstName} {customer.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Photographer Filter */}
            <Select value={photographerFilter} onValueChange={setPhotographerFilter}>
              <SelectTrigger className="w-[200px] h-9 border-rpp-grey-border rounded-lg" data-testid="select-photographer-filter">
                <SelectValue placeholder="All Photographers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Photographers</SelectItem>
                {users.filter((u: any) => u.role === 'photographer').map((user: any) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear Filters Button */}
            {(statusFilter !== "all" || customerFilter !== "all" || photographerFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter("all");
                  setCustomerFilter("all");
                  setPhotographerFilter("all");
                }}
                className="text-rpp-grey-medium hover:text-rpp-grey-dark text-xs"
                data-testid="button-clear-filters"
              >
                Clear all
              </Button>
            )}
          </div>
        </div>

        {/* Jobs List */}
        <div className="space-y-4">
          {filteredJobs.map((job: any) => (
            <Card 
              key={job.id} 
              className="border-0 hover:shadow-lg transition-shadow cursor-pointer bg-white rounded-2xl shadow-sm"
              onClick={() => {
                const navigationId = job.jobId || job.id;
                if (navigationId) {
                  setLocation(`/jobs/${navigationId}`);
                }
              }}
              data-testid={`card-job-${job.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-5">
                  {/* Property thumbnail */}
                  <div className="w-24 h-24 bg-rpp-grey-bg rounded-xl overflow-hidden flex-shrink-0 relative group">
                    {(job.propertyImageThumbnail || job.propertyImage) ? (
                      <>
                        <img 
                          src={job.propertyImageThumbnail || job.propertyImage} 
                          alt="Property" 
                          className="w-full h-full object-cover"
                          data-testid={`img-job-thumbnail-${job.id}`}
                        />
                        {/* Image menu overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center justify-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 bg-white/90 hover:bg-white focus-visible:bg-white text-gray-700 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#f2572c]"
                                data-testid={`button-image-menu-${job.id}`}
                                aria-label="Image options menu"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem 
                                onClick={(e) => handleDownloadImage(job.propertyImage || job.propertyImageThumbnail, job.address, e)}
                                data-testid={`menuitem-download-${job.id}`}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download Image
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => handleRenameImage(job.id, job.address, e)}
                                data-testid={`menuitem-rename-${job.id}`}
                              >
                                <Edit2 className="h-4 w-4 mr-2" />
                                Rename Image
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => handleDeleteImage(job.id, e)}
                                className="text-red-600 focus:text-red-600"
                                data-testid={`menuitem-delete-${job.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Image
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
                        <span className="text-3xl">🏠</span>
                      </div>
                    )}
                  </div>

                  {/* Job details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-rpp-grey-dark mb-2 text-base">
                      {job.address}
                    </h3>
                    
                    <div className="flex items-center gap-4 text-sm text-rpp-grey-medium">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="font-medium">{formatDate(job.appointmentDate)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-medium">{formatTime(job.appointmentDate)} ({calculateDuration(job.appointmentDate)})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        <span className="font-medium">{getCustomerName(job.customerId)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status and price */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <Badge 
                      variant="outline" 
                      className={`${getStatusColor(job.status || 'booked')} border-0 rounded-lg px-3 py-1.5 text-xs font-semibold`}
                    >
                      {job.status === 'completed' ? 'Delivered' : job.status === 'scheduled' ? 'Booked' : job.status || 'Booked'}
                    </Badge>
                    
                    <div className="text-lg font-bold text-rpp-grey-dark min-w-[90px] text-right">
                      ${(job.totalAmount || 350).toFixed(2)}
                    </div>

                    {/* Team member avatars */}
                    <div className="flex -space-x-2">
                      <div className="w-8 h-8 rounded-full bg-rpp-red-main border-2 border-white flex items-center justify-center text-white text-xs font-semibold">
                        {getCustomerName(job.customerId).split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-white text-xs font-semibold">
                        SJ
                      </div>
                    </div>

                    {/* Deliver Button - Only show for completed jobs */}
                    {job.status === 'completed' && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeliveryModalJob(job);
                        }}
                        className="bg-gradient-to-r from-primary to-primary/90 hover:shadow-lg transition-shadow"
                        size="sm"
                        data-testid={`button-deliver-${job.id}`}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Deliver
                      </Button>
                    )}

                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-rpp-grey-light hover:text-rpp-grey-dark h-8 w-8 p-0"
                      data-testid={`button-menu-${job.id}`}
                    >
                      <MoreVertical className="w-5 h-5" />
                    </Button>

                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-rpp-grey-light hover:text-rpp-grey-dark h-8 w-8 p-0"
                      data-testid={`button-expand-${job.id}`}
                    >
                      <ChevronDown className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredJobs.length === 0 && jobs.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm">
            <div className="text-6xl mb-4">📸</div>
            <h3 className="text-xl font-semibold text-rpp-grey-dark mb-2">No jobs yet</h3>
            <p className="text-rpp-grey-medium mb-6">Create your first photography job to get started</p>
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="bg-rpp-red-main hover:bg-rpp-red-dark text-white rounded-xl font-semibold"
              data-testid="button-create-first-job"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Job
            </Button>
          </div>
        )}

        {/* No search results */}
        {filteredJobs.length === 0 && jobs.length > 0 && (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-rpp-grey-dark mb-2">No jobs found</h3>
            <p className="text-rpp-grey-medium">Try adjusting your search terms</p>
          </div>
        )}

        {showCreateModal && (
          <CreateJobModal onClose={() => setShowCreateModal(false)} />
        )}

        {/* Rename Image Dialog */}
        <Dialog open={!!renamingJob} onOpenChange={() => setRenamingJob(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Image</DialogTitle>
              <DialogDescription>
                Update the display name for this cover image.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="image-name">Image Name</Label>
                <Input
                  id="image-name"
                  value={newImageName}
                  onChange={(e) => setNewImageName(e.target.value)}
                  placeholder="Enter new name"
                  data-testid="input-image-name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRenamingJob(null)}
                data-testid="button-cancel-rename"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // For now, just show a toast - this would need backend implementation
                  toast({
                    title: "Feature coming soon",
                    description: "Image renaming will be available in a future update.",
                  });
                  setRenamingJob(null);
                }}
                className="bg-[#f2572c] hover:bg-[#d94820]"
                data-testid="button-confirm-rename"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Send Delivery Email Modal */}
        {deliveryModalJob && (() => {
          const customer = customers.find((c: any) => c.id === deliveryModalJob.customerId);
          if (!customer) return null;
          
          return (
            <SendDeliveryEmailModal
              open={!!deliveryModalJob}
              onOpenChange={(open) => !open && setDeliveryModalJob(null)}
              job={deliveryModalJob}
              customer={customer}
              onEmailSent={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
              }}
            />
          );
        })()}
      </div>
    </div>
  );
}
