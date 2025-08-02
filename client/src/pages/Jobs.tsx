import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, MapPin, Calendar, User, Circle, ArrowRight } from "lucide-react";
import CreateJobModal from "@/components/modals/CreateJobModal";

export default function Jobs() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "cards">("list");
  
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["/api/jobs"],
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["/api/customers"],
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Circle className="w-3 h-3 fill-green-500 text-green-500" />;
      case 'in_progress':
        return <Circle className="w-3 h-3 fill-blue-500 text-blue-500" />;
      case 'scheduled':
        return <Circle className="w-3 h-3 fill-yellow-500 text-yellow-500" />;
      case 'cancelled':
        return <Circle className="w-3 h-3 fill-red-500 text-red-500" />;
      default:
        return <Circle className="w-3 h-3 fill-gray-500 text-gray-500" />;
    }
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers.find((c: any) => c.id === customerId);
    return customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown Customer';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'No date set';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const filteredJobs = jobs.filter((job: any) =>
    job.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getCustomerName(job.customerId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-rpp-grey-border rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-80 bg-rpp-grey-border rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-rpp-grey-dark">Jobs</h2>
          <p className="text-rpp-grey-light">Find and track your jobs. Schedule and complete!</p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="bg-rpp-red-main hover:bg-rpp-red-dark text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create new job
        </Button>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex items-center space-x-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-rpp-grey-light" />
          <Input
            placeholder="Search jobs, locations, customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border-rpp-grey-border"
          />
        </div>
        <Button variant="outline" className="border-rpp-grey-border">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>

      {/* Jobs List */}
      <div className="space-y-3">
        {filteredJobs.map((job: any) => (
          <Card key={job.id} className="border-rpp-grey-border hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                {/* Left side - Job info */}
                <div className="flex items-center space-x-4 flex-1">
                  {/* Property thumbnail */}
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    {job.propertyImage ? (
                      <img 
                        src={job.propertyImage} 
                        alt="Property" 
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <span className="text-2xl">🏠</span>
                    )}
                  </div>

                  {/* Job details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-semibold text-rpp-grey-dark truncate">
                        {job.address}
                      </h3>
                      <Badge variant="outline" className={`${getStatusColor(job.status || 'scheduled')} text-xs`}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(job.status || 'scheduled')}
                          <span className="capitalize">{job.status || 'Scheduled'}</span>
                        </div>
                      </Badge>
                    </div>
                    
                    <div className="flex items-center space-x-6 text-sm text-rpp-grey-light">
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-4 h-4" />
                        <span>📍 {formatDate(job.appointmentDate)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <User className="w-4 h-4" />
                        <span>{getCustomerName(job.customerId)}</span>
                      </div>
                      {job.dueDate && (
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>Due: {formatDate(job.dueDate)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side - Action buttons */}
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <div className="flex items-center space-x-1">
                    {/* Status indicators like in mockup */}
                    <Circle className="w-6 h-6 fill-gray-300 text-gray-300" />
                    <Circle className="w-6 h-6 fill-green-500 text-green-500" />
                    <Circle className="w-6 h-6 fill-gray-300 text-gray-300" />
                  </div>
                  <Button variant="ghost" size="sm" className="text-rpp-grey-light hover:text-rpp-grey-dark">
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredJobs.length === 0 && jobs.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📸</div>
          <h3 className="text-xl font-semibold text-rpp-grey-dark mb-2">No jobs yet</h3>
          <p className="text-rpp-grey-light mb-6">Create your first photography job to get started</p>
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
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-rpp-grey-dark mb-2">No jobs found</h3>
          <p className="text-rpp-grey-light">Try adjusting your search terms</p>
        </div>
      )}

      {showCreateModal && (
        <CreateJobModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
