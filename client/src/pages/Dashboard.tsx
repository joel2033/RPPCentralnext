import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, Users, DollarSign, UserCheck, Clock, AlertCircle, TrendingUp, Circle } from "lucide-react";
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
    },
    {
      id: 2,
      type: 'normal',
      title: 'Photos Ready for Review',
      description: '24 photos edited and ready for client',
      client: '456 Oak Avenue',
      time: '3 hours ago',
      icon: Circle,
    },
    {
      id: 3,
      type: 'urgent',
      title: 'Revision Request - Living Room',
      description: 'Client wants to tone down countertop reflection',
      client: '789 Maple Dr',
      time: '5 hours ago',
      icon: AlertCircle,
    }
  ];

  // Calculate stats from actual data
  const activeProjects = stats?.jobs || 24;
  const totalLeads = customers.length || 1248;
  const monthlyRevenue = parseFloat(stats?.sales || "29.8").toFixed(1);
  const activeClients = customers.length || 42;

  return (
    <div className="p-8 space-y-6 bg-rpp-cream">
      {/* Welcome Section */}
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-rpp-grey-dark">
          Welcome back, {userData?.email?.split('@')[0] || 'Sarah'}! 👋
        </h2>
        <p className="text-sm text-rpp-grey-medium">Here's a snapshot of your media business today</p>
      </div>

      {/* Stats Cards - 4 columns matching Figma */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Active Projects */}
        <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rpp-red-lighter rounded-xl flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-rpp-red-main" />
                </div>
                <span className="text-sm font-medium text-rpp-grey-medium">Active Projects</span>
              </div>
              <div>
                <p className="text-4xl font-bold text-rpp-grey-dark mb-1">{activeProjects}</p>
                <div className="flex items-center gap-1 text-xs font-medium text-support-green">
                  <TrendingUp className="w-4 h-4" />
                  <span>+4 last month</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leads */}
        <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-support-green bg-opacity-10 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-support-green" />
                </div>
                <span className="text-sm font-medium text-rpp-grey-medium">Leads</span>
              </div>
              <div>
                <p className="text-4xl font-bold text-rpp-grey-dark mb-1">{totalLeads}</p>
                <div className="flex items-center gap-1 text-xs font-medium text-support-green">
                  <TrendingUp className="w-4 h-4" />
                  <span>+23%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Revenue */}
        <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rpp-red-lighter rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-rpp-red-main" />
                </div>
                <span className="text-sm font-medium text-rpp-grey-medium">Monthly Revenue</span>
              </div>
              <div>
                <p className="text-4xl font-bold text-rpp-grey-dark mb-1">${monthlyRevenue}k</p>
                <div className="flex items-center gap-1 text-xs font-medium text-support-green">
                  <TrendingUp className="w-4 h-4" />
                  <span>+8%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Clients */}
        <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-support-green bg-opacity-10 rounded-xl flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-support-green" />
                </div>
                <span className="text-sm font-medium text-rpp-grey-medium">Active Clients</span>
              </div>
              <div>
                <p className="text-4xl font-bold text-rpp-grey-dark mb-1">{activeClients}</p>
                <div className="flex items-center gap-1 text-xs font-medium text-support-green">
                  <TrendingUp className="w-4 h-4" />
                  <span>+5 last month</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Grid - Needs Attention & Revenue Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Needs Your Attention - Left Column (2/3 width) */}
        <div className="lg:col-span-2">
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <h3 className="text-lg font-semibold text-rpp-grey-dark">Needs Your Attention</h3>
                <div className="w-6 h-6 bg-rpp-red-main rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{needsAttentionItems.length}</span>
                </div>
              </div>

              <div className="space-y-3">
                {needsAttentionItems.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-start gap-4 p-4 rounded-xl border border-rpp-grey-border hover:border-rpp-red-light hover:bg-rpp-red-lighter hover:bg-opacity-30 transition-all cursor-pointer"
                  >
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.type === 'urgent' ? 'bg-rpp-red-lighter' : 'bg-support-green bg-opacity-10'
                    }`}>
                      <item.icon className={`w-5 h-5 ${
                        item.type === 'urgent' ? 'text-rpp-red-main' : 'text-support-green'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-rpp-grey-dark text-sm">{item.title}</p>
                          {item.type === 'urgent' && (
                            <Badge className="bg-rpp-red-lighter text-rpp-red-main text-xs px-2 py-0.5 font-semibold border-0">
                              Urgent
                            </Badge>
                          )}
                        </div>
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
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-rpp-red-main hover:bg-rpp-red-lighter hover:text-rpp-red-dark font-medium text-sm px-4"
                    >
                      View
                    </Button>
                  </div>
                ))}
              </div>

              <Button 
                variant="link" 
                className="w-full mt-4 text-rpp-grey-medium hover:text-rpp-grey-dark text-sm font-medium"
              >
                Mark All As Read
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Overview - Right Column (1/3 width) */}
        <div>
          <Card className="bg-white border-0 shadow-sm h-full">
            <CardContent className="p-6">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-rpp-grey-dark">Revenue Overview</h3>
                </div>
                <p className="text-sm text-rpp-grey-medium -mt-2">Monthly performance result</p>
                
                <div className="space-y-1">
                  <p className="text-4xl font-bold text-rpp-grey-dark">${monthlyRevenue}k</p>
                  <p className="text-xs text-rpp-grey-light">This month</p>
                </div>

                <div className="h-52 -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fill: '#9CA3AF', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fill: '#9CA3AF', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #E5E5E5',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#FF6B4A" 
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 5, fill: '#FF6B4A' }}
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
      <Card className="bg-white border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-rpp-grey-dark mb-1">Services This Month</h3>
              <p className="text-sm text-rpp-grey-medium">Distribution of services delivered</p>
            </div>
            
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={servicesData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" horizontal={false} />
                  <XAxis 
                    type="number"
                    tick={{ fill: '#9CA3AF', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    type="category"
                    dataKey="name" 
                    tick={{ fill: '#374151', fontSize: 13, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    width={120}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #E5E5E5',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    cursor={{ fill: '#FEF3F0' }}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="#FF6B4A"
                    radius={[0, 12, 12, 0]}
                    barSize={32}
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
