import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowRight } from "lucide-react";
import CreateJobModal from "@/components/modals/CreateJobModal";

export default function Jobs() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["/api/jobs"],
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-rpp-grey-dark">Jobs</h2>
          <p className="text-rpp-grey-light">Manage and track your photography projects</p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="bg-rpp-red-main hover:bg-rpp-red-dark text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Job
        </Button>
      </div>

      {/* Job Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs?.map((job: any) => (
          <Card key={job.id} className="border-rpp-grey-border overflow-hidden">
            {/* Property Image */}
            <div className="h-48 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
              {job.propertyImage ? (
                <img 
                  src={job.propertyImage} 
                  alt="Property" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-rpp-grey-light text-center">
                  <div className="text-4xl mb-2">🏠</div>
                  <p className="text-sm">No image available</p>
                </div>
              )}
            </div>
            
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(job.status)}`}>
                  {job.status.replace('_', ' ')}
                </span>
                <span className="text-sm text-rpp-grey-light">
                  Due: {job.dueDate ? new Date(job.dueDate).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              
              <h3 className="font-semibold text-rpp-grey-dark mb-2">{job.address}</h3>
              <p className="text-sm text-rpp-grey-light mb-4">
                Customer ID: {job.customerId || 'Unassigned'}
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-support-green rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">J</span>
                  </div>
                  <span className="text-sm text-rpp-grey-dark">${job.totalValue || '0.00'}</span>
                </div>
                <button className="text-rpp-red-main hover:text-rpp-red-dark">
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        )) || (
          <div className="col-span-full text-center py-12">
            <div className="text-rpp-grey-light">
              <div className="text-6xl mb-4">📷</div>
              <h3 className="text-lg font-medium mb-2">No jobs yet</h3>
              <p className="text-sm">Create your first photography job to get started</p>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateJobModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
