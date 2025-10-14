
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Calendar, User, MoreVertical } from "lucide-react";
import CreateJobModal from "@/components/modals/CreateJobModal";

export default function Jobs() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "on_time" | "overdue">("all");
  const [, setLocation] = useLocation();
  
  const { data: jobs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["/api/customers"],
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

  const filteredJobs = jobs.filter((job: any) => {
    const matchesSearch = job.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getCustomerName(job.customerId).toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === "all") return matchesSearch;
    // Add logic for on_time/overdue filtering based on your business logic
    return matchesSearch;
  });

  const successfulJobsCount = jobs.filter(j => j.status === 'completed' || j.status === 'delivered').length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white rounded-xl border border-gray-200"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Jobs</h1>
            <p className="text-sm text-gray-600">
              on time · ({successfulJobsCount}) successful
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Find any job you've ever booked, delivered or completed.
            </p>
          </div>
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="bg-rpp-red-main hover:bg-rpp-red-dark text-white rounded-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create new job
          </Button>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search for jobs, people, orders or products"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-gray-200 bg-white rounded-lg"
            />
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
            <Button
              variant={statusFilter === "on_time" ? "default" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("on_time")}
              className={statusFilter === "on_time" ? "bg-rpp-red-main text-white rounded-md" : "text-gray-600 rounded-md"}
            >
              On time
            </Button>
            <Button
              variant={statusFilter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("all")}
              className={statusFilter === "all" ? "bg-rpp-red-main text-white rounded-md" : "text-gray-600 rounded-md"}
            >
              All
            </Button>
            <Button
              variant={statusFilter === "overdue" ? "default" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("overdue")}
              className={statusFilter === "overdue" ? "bg-rpp-red-main text-white rounded-md" : "text-gray-600 rounded-md"}
            >
              Overdue
            </Button>
          </div>
        </div>

        {/* Jobs List */}
        <div className="space-y-3">
          {filteredJobs.map((job: any) => (
            <Card 
              key={job.id} 
              className="border border-gray-200 hover:shadow-md transition-shadow cursor-pointer bg-white rounded-xl"
              onClick={() => {
                const navigationId = job.jobId || job.id;
                if (navigationId) {
                  setLocation(`/jobs/${navigationId}`);
                }
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Property thumbnail */}
                  <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {job.propertyImage ? (
                      <img 
                        src={job.propertyImage} 
                        alt="Property" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
                        <span className="text-2xl">🏠</span>
                      </div>
                    )}
                  </div>

                  {/* Job details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-2 text-base">
                      {job.address}
                    </h3>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(job.appointmentDate)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>{formatTime(job.appointmentDate)} ({calculateDuration(job.appointmentDate)})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span>{getCustomerName(job.customerId)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status and price */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <Badge 
                      variant="outline" 
                      className={`${getStatusColor(job.status || 'booked')} border rounded-full px-3 py-1 text-xs font-medium`}
                    >
                      {job.status === 'completed' ? 'Delivered' : job.status === 'scheduled' ? 'Booked' : job.status || 'Booked'}
                    </Badge>
                    
                    <div className="text-lg font-bold text-gray-900">
                      ${(job.totalAmount || 350).toFixed(2)}
                    </div>

                    {/* Team member avatars */}
                    <div className="flex -space-x-2">
                      <div className="w-8 h-8 rounded-full bg-orange-500 border-2 border-white flex items-center justify-center text-white text-xs font-semibold">
                        {getCustomerName(job.customerId).split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-white text-xs font-semibold">
                        SJ
                      </div>
                    </div>

                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600">
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredJobs.length === 0 && jobs.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <div className="text-6xl mb-4">📸</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No jobs yet</h3>
            <p className="text-gray-500 mb-6">Create your first photography job to get started</p>
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="bg-rpp-red-main hover:bg-rpp-red-dark text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Job
            </Button>
          </div>
        )}

        {/* No search results */}
        {filteredJobs.length === 0 && jobs.length > 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs found</h3>
            <p className="text-gray-500">Try adjusting your search terms</p>
          </div>
        )}

        {showCreateModal && (
          <CreateJobModal onClose={() => setShowCreateModal(false)} />
        )}
      </div>
    </div>
  );
}
