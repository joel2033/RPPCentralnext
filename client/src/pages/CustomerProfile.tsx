import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  Building, 
  MapPin, 
  Calendar, 
  DollarSign,
  Search,
  Filter,
  Plus,
  MoreHorizontal
} from "lucide-react";
import { format } from "date-fns";

interface CustomerProfileData {
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    company?: string;
    category?: string;
    profileImage?: string;
    totalValue: string;
    averageJobValue: string;
    jobsCompleted: number;
    createdAt: string;
  };
  jobs: Array<{
    id: string;
    jobId: string;
    address: string;
    status: string;
    appointmentDate?: string;
    dueDate?: string;
    totalValue: string;
    createdAt: string;
  }>;
}

export default function CustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: profileData, isLoading } = useQuery<CustomerProfileData>({
    queryKey: [`/api/customers/${id}/profile`],
    enabled: !!id,
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = ['bg-support-green', 'bg-rpp-red-main', 'bg-support-blue', 'bg-support-yellow'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-support-green text-white';
      case 'in_progress':
        return 'bg-support-blue text-white';
      case 'scheduled':
        return 'bg-support-yellow text-black';
      case 'cancelled':
        return 'bg-rpp-red-main text-white';
      default:
        return 'bg-rpp-grey-border text-rpp-grey-dark';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'in_progress':
        return '→';
      case 'scheduled':
        return '○';
      case 'cancelled':
        return '×';
      default:
        return '○';
    }
  };

  const filteredJobs = (profileData?.jobs || []).filter((job) => {
    const matchesSearch = 
      job.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.jobId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-rpp-grey-border rounded w-1/4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-64 bg-rpp-grey-border rounded-xl"></div>
            </div>
            <div className="h-64 bg-rpp-grey-border rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-rpp-grey-light">Customer not found</p>
          <Link href="/customers">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Customers
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { customer, jobs } = profileData;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Link href="/customers">
            <Button variant="outline" size="sm" data-testid="button-back-customers">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Customers
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-rpp-grey-dark" data-testid="text-customer-name">
              {customer.firstName} {customer.lastName}
            </h2>
            <p className="text-rpp-grey-light">Customer Profile</p>
          </div>
        </div>
        <Button className="bg-rpp-red-main hover:bg-rpp-red-dark text-white" data-testid="button-create-job">
          <Plus className="w-4 h-4 mr-2" />
          Create new job
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Jobs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-rpp-grey-border">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-rpp-red-main" data-testid="text-total-value">
                  ${customer.totalValue}
                </div>
                <div className="text-sm text-rpp-grey-light">Total Sales</div>
              </CardContent>
            </Card>
            <Card className="border-rpp-grey-border">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-support-blue" data-testid="text-average-value">
                  ${customer.averageJobValue}
                </div>
                <div className="text-sm text-rpp-grey-light">Average Job Value</div>
              </CardContent>
            </Card>
            <Card className="border-rpp-grey-border">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-support-green" data-testid="text-jobs-completed">
                  {customer.jobsCompleted}
                </div>
                <div className="text-sm text-rpp-grey-light">Jobs Completed</div>
              </CardContent>
            </Card>
          </div>

          {/* Jobs Section */}
          <Card className="border-rpp-grey-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-rpp-grey-dark">
                  Jobs
                </CardTitle>
                <Button variant="outline" size="sm" data-testid="button-create-job-secondary">
                  + Create new job
                </Button>
              </div>
              <p className="text-sm text-rpp-grey-light">
                Easily access and manage upcoming and delivered jobs for this customer.
              </p>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-rpp-grey-light w-4 h-4" />
                    <Input
                      placeholder="Search jobs by address..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                      data-testid="input-search-jobs"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32" data-testid="select-status-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="scheduled">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" data-testid="button-filters">
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </div>

              {/* Jobs List */}
              <div className="space-y-3">
                {filteredJobs.length === 0 ? (
                  <div className="text-center py-8 text-rpp-grey-light">
                    {jobs.length === 0 ? "No jobs found for this customer." : "No jobs match your search criteria."}
                  </div>
                ) : (
                  filteredJobs.map((job) => (
                    <Link key={job.id} href={`/jobs/${job.jobId}`}>
                      <div className="border border-rpp-grey-border rounded-lg p-4 hover:bg-rpp-grey-bg transition-colors cursor-pointer" data-testid={`job-card-${job.id}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${getStatusColor(job.status)}`}>
                              {getStatusIcon(job.status)}
                            </div>
                            <div>
                              <div className="font-medium text-rpp-grey-dark" data-testid={`text-job-address-${job.id}`}>
                                {job.address}
                              </div>
                              <div className="text-sm text-rpp-grey-light">
                                {job.appointmentDate ? format(new Date(job.appointmentDate), 'MMM dd, yyyy') : 'No appointment set'} • 
                                {job.dueDate ? ` Due ${format(new Date(job.dueDate), 'MMM dd')}` : ' No due date'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <Badge variant="outline" className={getStatusColor(job.status)} data-testid={`badge-status-${job.id}`}>
                              {job.status.charAt(0).toUpperCase() + job.status.slice(1).replace('_', ' ')}
                            </Badge>
                            <div className="text-right">
                              <div className="font-medium text-rpp-grey-dark" data-testid={`text-job-value-${job.id}`}>
                                ${job.totalValue}
                              </div>
                              <div className="text-sm text-rpp-grey-light">
                                {format(new Date(job.createdAt), 'MMM dd')}
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" data-testid={`button-job-actions-${job.id}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Customer Details */}
        <div className="space-y-6">
          <Card className="border-rpp-grey-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-rpp-grey-dark">
                Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Section */}
              <div className="text-center">
                <div className="relative inline-block">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={customer.profileImage} alt={`${customer.firstName} ${customer.lastName}`} />
                    <AvatarFallback className={`${getAvatarColor(customer.firstName)} text-white text-xl font-semibold`}>
                      {getInitials(customer.firstName, customer.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-support-green rounded-full border-2 border-white"></div>
                </div>
                <h3 className="mt-3 font-semibold text-rpp-grey-dark" data-testid="text-sidebar-customer-name">
                  {customer.firstName} {customer.lastName}
                </h3>
                {customer.company && (
                  <p className="text-sm text-rpp-grey-light" data-testid="text-customer-company">
                    {customer.company}
                  </p>
                )}
              </div>

              <Separator />

              {/* Contact Information */}
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Mail className="w-4 h-4 text-rpp-grey-light" />
                  <span className="text-sm text-rpp-grey-dark" data-testid="text-customer-email">
                    {customer.email}
                  </span>
                </div>
                {customer.phone && (
                  <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4 text-rpp-grey-light" />
                    <span className="text-sm text-rpp-grey-dark" data-testid="text-customer-phone">
                      {customer.phone}
                    </span>
                  </div>
                )}
                {customer.company && (
                  <div className="flex items-center space-x-3">
                    <Building className="w-4 h-4 text-rpp-grey-light" />
                    <span className="text-sm text-rpp-grey-dark" data-testid="text-sidebar-customer-company">
                      {customer.company}
                    </span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Category */}
              {customer.category && (
                <>
                  <div>
                    <label className="text-sm font-medium text-rpp-grey-dark">Category</label>
                    <div className="mt-1">
                      <Badge variant="outline" data-testid="badge-customer-category">
                        {customer.category}
                      </Badge>
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Customer Notes */}
              <div>
                <label className="text-sm font-medium text-rpp-grey-dark">Customer notes</label>
                <div className="mt-2 text-sm text-rpp-grey-light">
                  No category
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}