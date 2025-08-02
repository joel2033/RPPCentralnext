import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, DollarSign, ShoppingCart, Check } from "lucide-react";

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["/api/jobs"],
  });

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
                  <span className="text-sm text-rpp-grey-light">{jobs.length || 0}</span>
                </div>
              </div>

              {/* Appointments List */}
              <div className="space-y-4">
                {jobs.slice(0, 4).map((job: any) => (
                  <div key={job.id} className="flex items-center justify-between p-4 border border-rpp-grey-border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-support-green rounded-full flex items-center justify-center text-white font-medium">
                        {job.address?.[0]?.toUpperCase() || 'A'}
                      </div>
                      <div>
                        <p className="font-medium text-rpp-grey-dark">{job.address}</p>
                        <p className="text-sm text-rpp-grey-light">
                          {new Date(job.appointmentDate || job.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        job.status === 'completed' 
                          ? 'bg-green-100 text-green-800'
                          : job.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {job.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                )) || (
                  <div className="text-center py-8">
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
