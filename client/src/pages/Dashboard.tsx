import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Camera, DollarSign, ShoppingCart, Check, MapPin, Calendar, User, Circle, MoreHorizontal } from "lucide-react";

export default function Dashboard() {
  const { data: stats } = useQuery<{jobs: number, sales: string, orders: number}>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["/api/customers"],
  });

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get upcoming jobs sorted by appointment date
  const upcomingJobs = jobs
    .filter((job: any) => job.appointmentDate || job.createdAt)
    .sort((a: any, b: any) => new Date(a.appointmentDate || a.createdAt).getTime() - new Date(b.appointmentDate || b.createdAt).getTime())
    .slice(0, 4);

  return (
    <div className="p-6">
      {/* Welcome Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-rpp-grey-dark mb-2">Hello, Joel 👋</h2>
        <p className="text-rpp-grey-light">Here's a snapshot of your business performance</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="border-rpp-grey-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Camera className="w-5 h-5 text-purple-600" />
                </div>
                <span className="font-medium text-rpp-grey-dark">Jobs</span>
              </div>
              <span className="text-2xl font-bold text-rpp-grey-dark">{stats?.jobs || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-rpp-grey-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <span className="font-medium text-rpp-grey-dark">Sales</span>
              </div>
              <span className="text-2xl font-bold text-rpp-grey-dark">${stats?.sales || "0.00"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-rpp-grey-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                </div>
                <span className="font-medium text-rpp-grey-dark">Orders</span>
              </div>
              <span className="text-2xl font-bold text-rpp-grey-dark">{stats?.orders || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Appointments */}
        <div className="lg:col-span-2">
          <Card className="border-rpp-grey-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-rpp-grey-dark">Upcoming appointments</h3>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <button className="px-3 py-1 bg-rpp-grey-dark text-white rounded-lg text-sm">Today</button>
                    <button className="px-3 py-1 bg-rpp-grey-bg text-rpp-grey-dark rounded-lg text-sm">Tomorrow</button>
                  </div>
                  <span className="text-sm text-rpp-grey-light">{upcomingJobs.length}</span>
                </div>
              </div>

              {/* Appointments List */}
              <div className="space-y-4">
                {upcomingJobs.length > 0 ? upcomingJobs.map((job: any) => (
                  <div key={job.id} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="flex items-center space-x-4">
                      {/* Status Circle */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                        job.status === 'completed' ? 'bg-green-500' :
                        job.status === 'in_progress' ? 'bg-blue-500' : 'bg-yellow-500'
                      }`}>
                        {job.address?.[0]?.toUpperCase() || 'J'}
                      </div>
                      
                      {/* Job Info */}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="font-medium text-rpp-grey-dark">{job.address}</p>
                          <Badge variant="outline" className={`${getStatusColor(job.status || 'scheduled')} text-xs`}>
                            {job.status || 'Scheduled'}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-rpp-grey-light">
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDate(job.appointmentDate)}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <User className="w-3 h-3" />
                            <span>{getCustomerName(job.customerId)}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Menu */}
                    <Button variant="ghost" size="sm" className="text-rpp-grey-light hover:text-rpp-grey-dark">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">📅</div>
                    <p className="text-rpp-grey-light">No upcoming appointments</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Needs Attention */}
        <div>
          <Card className="border-rpp-grey-border">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-rpp-grey-dark mb-6">Needs your attention (0)</h3>
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-support-green rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-rpp-grey-light">You're all caught up!</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
