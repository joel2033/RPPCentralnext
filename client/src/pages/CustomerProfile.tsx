import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Search, Phone, Mail, Building2, ChevronDown } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import CustomerEditingPreferences from "@/components/CustomerEditingPreferences";

export default function CustomerProfile() {
  const [, params] = useRoute("/customers/:id");
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: profileData } = useQuery<any>({
    queryKey: [`/api/customers/${params?.id}/profile`],
  });

  if (!profileData) {
    return <div className="p-6">Loading...</div>;
  }

  const customer = profileData.customer;
  const jobs = profileData.jobs || [];

  const stats = [
    { label: "Total Sales", value: `$${customer.totalValue || 0}`, color: "text-rpp-red-main" },
    { label: "Average Job Value", value: `$${customer.averageJobValue || 0}`, color: "text-rpp-red-main" },
    { label: "Jobs Completed", value: customer.jobsCompleted || 0, color: "text-rpp-grey-dark" },
  ];

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-50 text-support-green border-support-green';
      case 'in_progress':
      case 'in progress':
        return 'bg-yellow-50 text-support-yellow border-support-yellow';
      case 'scheduled':
      case 'pending':
        return 'bg-blue-50 text-support-blue border-support-blue';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-300';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  const jobsList = jobs.map((job: any) => ({
    id: job.id,
    jobId: job.jobId,
    address: job.address,
    date: formatDate(job.appointmentDate || job.createdAt),
    dueDate: job.dueDate ? `Due ${formatDate(job.dueDate)}` : '',
    status: job.status || 'Pending',
    statusColor: getStatusColor(job.status),
    price: job.totalPrice ? `$${parseFloat(job.totalPrice).toFixed(2)}` : '$0.00'
  }));

  const initials = customer.firstName && customer.lastName 
    ? `${customer.firstName[0]}${customer.lastName[0]}`.toUpperCase()
    : "NA";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/customers")}
              className="text-rpp-grey-medium hover:text-rpp-grey-dark"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-rpp-grey-dark">
                {customer.firstName} {customer.lastName}
              </h1>
              <p className="text-sm text-rpp-grey-medium">Customer Profile</p>
            </div>
          </div>
          <Button 
            className="bg-rpp-red-main hover:bg-rpp-red-dark text-white rounded-full px-6"
            onClick={() => setLocation("/jobs/new")}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create new job
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index} className="bg-white border-0 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
              <CardContent className="p-6 text-center">
                <div className={`text-3xl font-semibold ${stat.color} mb-1`}>
                  {stat.value}
                </div>
                <div className="text-sm font-normal text-rpp-grey-medium">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Editing Preferences Section */}
        <div className="mb-8">
          <CustomerEditingPreferences customerId={params?.id || ""} />
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
                    onClick={() => setLocation("/jobs/new")}
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
                    jobsList.map((job) => (
                      <div
                        key={job.id}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all cursor-pointer border border-transparent hover:border-gray-200"
                        data-testid={`job-item-${job.jobId || job.id}`}
                        onClick={() => setLocation(`/jobs/${job.id}`)}
                      >
                        <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <div className="w-2 h-2 rounded-full bg-rpp-red-main"></div>
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
                        <div className="text-lg font-bold text-rpp-grey-dark" data-testid={`text-job-price-${job.jobId || job.id}`}>
                          {job.price}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Customer Details Sidebar */}
          <div className="space-y-6">
            <Card className="bg-white border-0 rounded-2xl shadow-sm">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-rpp-grey-dark mb-6">Customer Details</h3>

                {/* Avatar and Name */}
                <div className="flex flex-col items-center mb-6">
                  <div className="w-20 h-20 rounded-full bg-rpp-red-main flex items-center justify-center mb-3">
                    <span className="text-2xl font-bold text-white">{initials}</span>
                  </div>
                  <h4 className="text-lg font-bold text-rpp-grey-dark">
                    {customer.firstName} {customer.lastName}
                  </h4>
                  <p className="text-sm text-rpp-grey-medium">{customer.company || 'No company'}</p>
                </div>

                {/* Contact Information */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-rpp-grey-medium mt-1" />
                    <div>
                      <p className="text-xs text-rpp-grey-medium mb-1">Email</p>
                      <p className="text-sm text-rpp-grey-dark">{customer.email || 'No email provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-rpp-grey-medium mt-1" />
                    <div>
                      <p className="text-xs text-rpp-grey-medium mb-1">Phone</p>
                      <p className="text-sm text-rpp-grey-dark">{customer.phone || 'No phone provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Building2 className="w-4 h-4 text-rpp-grey-medium mt-1" />
                    <div>
                      <p className="text-xs text-rpp-grey-medium mb-1">Company</p>
                      <p className="text-sm text-rpp-grey-dark">{customer.company || 'No company'}</p>
                    </div>
                  </div>
                </div>

                {/* Category */}
                <div className="mb-6">
                  <p className="text-xs text-rpp-grey-medium mb-2">Category</p>
                  <Badge className="bg-rpp-grey-bg text-rpp-grey-dark border-0 rounded-lg px-3 py-1">
                    {customer.category || 'No category'}
                  </Badge>
                </div>

                {/* Customer Notes */}
                <div className="mb-6">
                  <p className="text-xs text-rpp-grey-medium mb-2">Customer notes</p>
                  <p className="text-sm text-rpp-grey-light italic">No notes available</p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full border-rpp-grey-border text-rpp-grey-dark hover:bg-rpp-grey-bg rounded-lg"
                  >
                    Edit Customer
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full border-rpp-grey-border text-rpp-grey-dark hover:bg-rpp-grey-bg rounded-lg"
                  >
                    Delete Customer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}