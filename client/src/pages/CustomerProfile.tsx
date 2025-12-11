import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Search, Phone, Mail, Building2, ChevronDown } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import CustomerEditingPreferences from "@/components/CustomerEditingPreferences";
import EditCustomerModal from "@/components/modals/EditCustomerModal";
import CreateJobModal from "@/components/modals/CreateJobModal";
import { useRealtimeJobs } from "@/hooks/useFirestoreRealtime";
import { useAuth } from "@/contexts/AuthContext";

export default function CustomerProfile() {
  const [, params] = useRoute("/customers/:id");
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateJobModal, setShowCreateJobModal] = useState(false);
  const [timePeriod, setTimePeriod] = useState<"lifetime" | "this-month" | "last-month" | "last-12-months">("lifetime");
  
  const { userData } = useAuth();
  const partnerId = userData?.partnerId || null;

  // Fetch customer data
  const { data: customer } = useQuery<any>({
    queryKey: [`/api/customers/${params?.id}`],
    enabled: !!params?.id,
  });

  // Real-time jobs for this customer
  const { jobs: realtimeJobs, loading: jobsLoading } = useRealtimeJobs(partnerId, { 
    customerId: params?.id 
  });
  const jobs = realtimeJobs || [];

  // Memoized stats calculation - recalculates when jobs or timePeriod changes
  // Must be called before any early returns to follow Rules of Hooks
  const { totalSales, jobsCompleted, averageJobValue } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Filter delivered jobs by time period
    const filteredDeliveredJobs = jobs.filter((job: any) => {
      // Only include delivered jobs
      if (job.status?.toLowerCase() !== 'delivered') return false;
      
      // For lifetime, include all delivered jobs
      if (timePeriod === "lifetime") return true;
      
      // For time-based filtering, use deliveredAt if available, otherwise fall back to createdAt
      const dateToUse = job.deliveredAt || job.createdAt;
      if (!dateToUse) return false;
      
      const deliveredDate = new Date(dateToUse);
      
      switch (timePeriod) {
        case "this-month": {
          return deliveredDate.getFullYear() === currentYear && 
                 deliveredDate.getMonth() === currentMonth;
        }
        case "last-month": {
          const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
          return deliveredDate.getFullYear() === lastMonthYear && 
                 deliveredDate.getMonth() === lastMonth;
        }
        case "last-12-months": {
          const twelveMonthsAgo = new Date(currentYear, currentMonth - 12, 1);
          return deliveredDate >= twelveMonthsAgo;
        }
        default:
          return true;
      }
    });

    // Calculate total sales from billingItems of filtered delivered jobs
    const totalSales = filteredDeliveredJobs.reduce((sum: number, job: any) => {
      if (!job.billingItems) return sum;
      
      try {
        const billingItems = typeof job.billingItems === 'string' 
          ? JSON.parse(job.billingItems) 
          : job.billingItems;
        
        if (!Array.isArray(billingItems) || billingItems.length === 0) return sum;
        
        const jobRevenue = billingItems.reduce((itemSum: number, item: any) => {
          return itemSum + (parseFloat(item.amount?.toString() || "0"));
        }, 0);
        
        return sum + jobRevenue;
      } catch (e) {
        console.error(`Error parsing billingItems for job ${job.jobId || job.id}:`, e);
        return sum;
      }
    }, 0);

    const jobsCompleted = filteredDeliveredJobs.length;
    const averageJobValue = jobsCompleted > 0 ? totalSales / jobsCompleted : 0;

    return { totalSales, jobsCompleted, averageJobValue };
  }, [jobs, timePeriod]);

  if (!customer || jobsLoading) {
    return <div className="p-6">Loading...</div>;
  }

  const stats = [
    { label: "Total Sales (ex. GST)", value: `$${totalSales.toFixed(2)}`, color: "text-rpp-red-main" },
    { label: "Average Job Value (ex. GST)", value: `$${averageJobValue.toFixed(2)}`, color: "text-rpp-red-main" },
    { label: "Jobs Completed", value: jobsCompleted, color: "text-rpp-grey-dark" },
  ];

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return 'bg-green-50 text-support-green border-support-green';
      case 'pending':
        return 'bg-yellow-50 text-support-yellow border-support-yellow';
      case 'on_hold':
      case 'on hold':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'booked':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'cancelled':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-300';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  const jobsList = jobs
    .map((job: any) => ({
      id: job.id,
      jobId: job.jobId,
      address: job.address,
      date: formatDate(job.appointmentDate || job.createdAt),
      dueDate: job.dueDate ? `Due ${formatDate(job.dueDate)}` : '',
      status: job.status || 'Booked',
      statusColor: getStatusColor(job.status),
      price: job.totalValue ? `$${parseFloat(job.totalValue).toFixed(2)}` : '$0.00',
      propertyImage: job.propertyImageThumbnail || job.propertyImage,
      createdAt: job.createdAt || job.appointmentDate || new Date(0).toISOString()
    }))
    .sort((a, b) => {
      // Sort by createdAt descending (newest first)
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

  const initials = customer.firstName && customer.lastName 
    ? `${customer.firstName[0]}${customer.lastName[0]}`.toUpperCase()
    : "NA";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/customers")}
              className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {customer.firstName} {customer.lastName}
              </h1>
              <p className="text-sm text-gray-600">Customer Profile</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={timePeriod} onValueChange={(value: "lifetime" | "this-month" | "last-month" | "last-12-months") => setTimePeriod(value)}>
              <SelectTrigger className="w-[160px] rounded-xl border-gray-200 bg-white">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lifetime">Lifetime</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-12-months">Last 12 Months</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              className="hover:bg-rpp-red-dark text-white rounded-xl px-5 h-10 shadow-sm font-medium bg-[#f05a2a]"
              onClick={() => setShowCreateJobModal(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create new job
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          {stats.map((stat, index) => (
            <Card key={index} className="bg-white border border-gray-200 rounded-2xl shadow-sm">
              <CardContent className="p-6 text-center">
                <div className="text-3xl mb-1 font-medium text-[#f05a2a]">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Editing Preferences Section */}
        <div className="mb-8">
          <CustomerEditingPreferences 
            customerId={params?.id || ""} 
            customerName={`${customer.firstName} ${customer.lastName}`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Jobs Section */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white border border-gray-100 rounded-3xl shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-rpp-grey-dark mb-1 font-medium text-[22px]">Jobs</h2>
                    <p className="text-sm text-rpp-grey-medium">
                      Easily access and manage upcoming and delivered jobs for this customer.
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    className="text-rpp-red-main hover:bg-rpp-red-lighter text-sm font-semibold"
                    onClick={() => setShowCreateJobModal(true)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Create new job
                  </Button>
                </div>

                {/* Search and Filters */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-rpp-grey-medium" />
                    <Input
                      type="text"
                      placeholder="Search jobs by address..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 border-gray-200 rounded-lg bg-gray-50 focus:bg-white"
                    />
                  </div>
                  <Button variant="outline" className="border-gray-200 rounded-lg text-rpp-grey-dark bg-white hover:bg-gray-50">
                    All Status
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                  <Button variant="outline" className="border-gray-200 rounded-lg text-rpp-grey-dark bg-white hover:bg-gray-50">
                    Filters
                  </Button>
                </div>

                {/* Jobs List */}
                <div className="space-y-3">
                  {jobsList.length === 0 ? (
                    <p className="text-sm text-rpp-grey-medium text-center py-8" data-testid="text-no-jobs">No jobs found for this customer</p>
                  ) : (
                    jobsList.map((job: any) => (
                      <div
                        key={job.id}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all cursor-pointer border border-transparent hover:border-gray-200"
                        data-testid={`job-item-${job.jobId || job.id}`}
                        onClick={() => setLocation(`/jobs/${job.jobId}`)}
                      >
                        <div className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden">
                          {job.propertyImage ? (
                            <img 
                              src={job.propertyImage} 
                              alt={job.address}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-orange-100 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-rpp-red-main"></div>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-rpp-grey-dark mb-1 font-medium" data-testid={`text-job-address-${job.jobId || job.id}`}>{job.address}</p>
                          <p className="text-sm text-rpp-grey-medium" data-testid={`text-job-dates-${job.jobId || job.id}`}>
                            {job.date} • {job.dueDate}
                          </p>
                        </div>
                        <Badge className={`${job.statusColor} border rounded-full px-3 py-1 text-xs font-semibold`} data-testid={`badge-job-status-${job.jobId || job.id}`}>
                          {job.status}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Customer Details Sidebar */}
          <div>
            <Card className="bg-white border border-gray-200 rounded-2xl shadow-sm">
              <CardContent className="p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-6">Customer Details</h3>

                {/* Avatar and Name */}
                <div className="flex flex-col items-center mb-6">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-3 shadow-sm bg-[#f05a2a]">
                    <span className="text-2xl font-bold text-white">{initials}</span>
                  </div>
                  <h4 className="text-gray-900 font-medium text-[20px]">
                    {customer.firstName} {customer.lastName}
                  </h4>
                  <p className="text-sm text-gray-600">{customer.company || 'Wilson Photography Co.'}</p>
                </div>

                {/* Contact Information */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-gray-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-500 mb-1">Email</p>
                      <p className="text-sm text-gray-900">{customer.email || 'emma.wilson@example.com'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-gray-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-500 mb-1">Phone</p>
                      <p className="text-sm text-gray-900">{customer.phone || '+61 488 765 432'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Building2 className="w-4 h-4 text-gray-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-500 mb-1">Company</p>
                      <p className="text-sm text-gray-900">{customer.company || 'Wilson Photography Co.'}</p>
                    </div>
                  </div>
                </div>

                {/* Category */}
                <div className="mb-6">
                  <p className="text-xs font-medium text-gray-500 mb-2">Category</p>
                  <Badge className="bg-gray-100 text-gray-700 border-0 rounded-lg px-3 py-1 font-normal">
                    {customer.category || 'residential'}
                  </Badge>
                </div>

                {/* Customer Notes */}
                <div className="mb-6">
                  <p className="text-xs font-medium text-gray-500 mb-2">Customer notes</p>
                  <p className="text-sm text-gray-600 italic">No category</p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full border-gray-300 text-gray-900 hover:bg-gray-50 rounded-xl font-medium"
                    onClick={() => setShowEditModal(true)}
                  >
                    Edit Customer
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full border-gray-300 text-gray-900 hover:bg-gray-50 rounded-xl font-medium"
                  >
                    Delete Customer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Edit Customer Modal */}
      {showEditModal && customer && params?.id && (
        <EditCustomerModal
          onClose={() => setShowEditModal(false)}
          customer={customer}
          customerId={params.id}
        />
      )}

      {/* Create Job Modal */}
      {showCreateJobModal && params?.id && (
        <CreateJobModal
          onClose={() => setShowCreateJobModal(false)}
          initialCustomerId={params.id}
        />
      )}
    </div>
  );
}