import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, Users, DollarSign, UserCheck, Clock, AlertCircle, TrendingUp, TrendingDown, Circle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const { userData } = useAuth();
  const { data: stats } = useQuery<{jobs: number, sales: string, orders: number}>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["/api/customers"],
  });

  // Mock data for revenue chart (matching Figma)
  const revenueData = [
    { month: 'Jan', value: 18 },
    { month: 'Feb', value: 22 },
    { month: 'Mar', value: 19 },
    { month: 'Apr', value: 25 },
    { month: 'May', value: 28 },
    { month: 'Jun', value: 32 },
    { month: 'Jul', value: 30 },
    { month: 'Aug', value: 35 },
    { month: 'Sep', value: 33 },
    { month: 'Oct', value: 29 },
  ];

  // Mock data for services distribution (matching Figma)
  const servicesData = [
    { name: 'Photos', value: 45 },
    { name: 'Videos', value: 30 },
    { name: 'Virtual Tours', value: 15 },
    { name: 'Floor Plans', value: 10 },
  ];

  // Mock needs attention items (matching Figma)
  const needsAttentionItems = [
    {
      id: 1,
      type: 'urgent',
      title: 'Revision Request - Kitchen Photo',
      description: 'Client requested brightness adjustment on',
      client: '123 Main St',
      time: '2 hours ago',
      icon: AlertCircle,
      iconBg: 'bg-rpp-red-lighter',
      iconColor: 'text-rpp-red-main'
    },
    {
      id: 2,
      type: 'normal',
      title: 'Photos Ready for Review',
      description: '24 photos edited and ready for client',
      client: '456 Oak Avenue',
      time: '3 hours ago',
      icon: Circle,
      iconBg: 'bg-support-green bg-opacity-20',
      iconColor: 'text-support-green'
    },
    {
      id: 3,
      type: 'urgent',
      title: 'Revision Request - Living Room',
      description: 'Client wants to tone down countertop reflection',
      client: '789 Maple Dr',
      time: '5 hours ago',
      icon: AlertCircle,
      iconBg: 'bg-rpp-red-lighter',
      iconColor: 'text-rpp-red-main'
    }
  ];

  // Calculate stats from actual data
  const activeProjects = stats?.jobs || 0;
  const totalLeads = customers.length || 0;
  const monthlyRevenue = stats?.sales || "0.00";
  const activeClients = customers.filter((c: any) => c.status === 'active').length || customers.length;

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Section */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-rpp-grey-dark">
          Welcome back, {userData?.email?.split('@')[0] || 'User'}! 👋
        </h2>
        <p className="text-rpp-grey-medium">Here's a snapshot of your media business today</p>
      </div>

      {/* Stats Cards - 4 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Projects */}
        <Card className="border-rpp-grey-border">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-rpp-red-lighter rounded-lg flex items-center justify-center">
                    <FolderOpen className="w-4 h-4 text-rpp-red-main" />
                  </div>
                  <span className="text-sm text-rpp-grey-medium">Active Projects</span>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-rpp-grey-dark">{activeProjects}</p>
                  <div className="flex items-center gap-1 text-xs text-support-green">
                    <TrendingUp className="w-3 h-3" />
                    <span>+4% last month</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leads */}
        <Card className="border-rpp-grey-border">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-rpp-red-lighter rounded-lg flex items-center justify-center">
                    <Users className="w-4 h-4 text-rpp-red-main" />
                  </div>
                  <span className="text-sm text-rpp-grey-medium">Leads</span>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-rpp-grey-dark">{totalLeads}</p>
                  <div className="flex items-center gap-1 text-xs text-support-green">
                    <TrendingUp className="w-3 h-3" />
                    <span>+23%</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Revenue */}
        <Card className="border-rpp-grey-border">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-rpp-red-lighter rounded-lg flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-rpp-red-main" />
                  </div>
                  <span className="text-sm text-rpp-grey-medium">Monthly Revenue</span>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-rpp-grey-dark">${monthlyRevenue}k</p>
                  <div className="flex items-center gap-1 text-xs text-support-green">
                    <TrendingUp className="w-3 h-3" />
                    <span>+8%</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Clients */}
        <Card className="border-rpp-grey-border">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-rpp-red-lighter rounded-lg flex items-center justify-center">
                    <UserCheck className="w-4 h-4 text-rpp-red-main" />
                  </div>
                  <span className="text-sm text-rpp-grey-medium">Active Clients</span>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-rpp-grey-dark">{activeClients}</p>
                  <div className="flex items-center gap-1 text-xs text-support-green">
                    <TrendingUp className="w-3 h-3" />
                    <span>+5% last month</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Grid - Needs Attention & Revenue Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Needs Your Attention - Left Column (2/3 width) */}
        <div className="lg:col-span-2">
          <Card className="border-rpp-grey-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <h3 className="text-lg font-semibold text-rpp-grey-dark">Needs Your Attention</h3>
                <Badge className="bg-rpp-red-main text-white rounded-full px-2 py-0.5 text-xs">
                  {needsAttentionItems.length}
                </Badge>
              </div>

              <div className="space-y-4">
                {needsAttentionItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-4 p-4 rounded-lg border border-rpp-grey-border hover:bg-rpp-grey-bg transition-colors">
                    <div className={`w-10 h-10 rounded-full ${item.iconBg} flex items-center justify-center flex-shrink-0`}>
                      <item.icon className={`w-5 h-5 ${item.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-rpp-grey-dark">{item.title}</p>
                            {item.type === 'urgent' && (
                              <Badge className="bg-rpp-red-lighter text-rpp-red-main text-xs">Urgent</Badge>
                            )}
                          </div>
                          <p className="text-sm text-rpp-grey-medium mb-2">{item.description}</p>
                          <div className="flex items-center gap-4 text-xs text-rpp-grey-light">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {item.time}
                            </span>
                            <span>{item.client}</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-rpp-red-main hover:bg-rpp-red-lighter">
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="link" className="w-full mt-4 text-rpp-grey-medium hover:text-rpp-grey-dark">
                Mark All As Read
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Overview - Right Column (1/3 width) */}
        <div>
          <Card className="border-rpp-grey-border h-full">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-rpp-grey-dark">Revenue Overview</h3>
                  <Button variant="ghost" size="sm" className="text-rpp-grey-medium hover:text-rpp-grey-dark text-xs">
                    View All
                  </Button>
                </div>
                <p className="text-sm text-rpp-grey-medium">Monthly performance result</p>
                
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-rpp-grey-dark">${monthlyRevenue}k</p>
                  <p className="text-xs text-rpp-grey-light">This month</p>
                </div>

                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fill: '#9CA3AF', fontSize: 11 }}
                        axisLine={{ stroke: '#E5E5E5' }}
                      />
                      <YAxis 
                        tick={{ fill: '#9CA3AF', fontSize: 11 }}
                        axisLine={{ stroke: '#E5E5E5' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #E5E5E5',
                          borderRadius: '8px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#FF6B4A" 
                        strokeWidth={2}
                        dot={{ fill: '#FF6B4A', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Services This Month */}
      <Card className="border-rpp-grey-border">
        <CardContent className="p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-rpp-grey-dark">Services This Month</h3>
            <p className="text-sm text-rpp-grey-medium">Distribution of services delivered</p>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={servicesData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                  <XAxis 
                    type="number"
                    tick={{ fill: '#9CA3AF', fontSize: 11 }}
                    axisLine={{ stroke: '#E5E5E5' }}
                  />
                  <YAxis 
                    type="category"
                    dataKey="name" 
                    tick={{ fill: '#9CA3AF', fontSize: 12 }}
                    axisLine={{ stroke: '#E5E5E5' }}
                    width={100}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #E5E5E5',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="#FF6B4A"
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
