import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, Users, DollarSign, UserCheck, Clock, AlertCircle, TrendingUp, Circle, ChevronRight, CheckCircle, RefreshCw, Package } from "lucide-react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
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

  // Mock data for revenue chart
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

  // Mock attention metrics
  const attentionMetrics = [
    {
      id: 1,
      label: 'Ready to Deliver',
      count: 8,
      icon: Package,
      color: 'bg-gradient-to-br from-green-50 to-green-100',
      iconColor: 'text-support-green',
      description: 'Orders ready for client',
    },
    {
      id: 2,
      label: 'Requested Revisions',
      count: 3,
      icon: RefreshCw,
      color: 'bg-gradient-to-br from-rpp-red-lighter to-rpp-red-light',
      iconColor: 'text-rpp-red-main',
      description: 'Client revision requests',
    },
    {
      id: 3,
      label: 'Pending Review',
      count: 5,
      icon: Clock,
      color: 'bg-gradient-to-br from-amber-50 to-amber-100',
      iconColor: 'text-amber-500',
      description: 'Awaiting client approval',
    },
    {
      id: 4,
      label: 'Urgent Tasks',
      count: 2,
      icon: AlertCircle,
      color: 'bg-gradient-to-br from-rpp-red-lighter to-rpp-red-light',
      iconColor: 'text-rpp-red-main',
      description: 'High priority items',
    },
    {
      id: 5,
      label: 'In Progress',
      count: 12,
      icon: Circle,
      color: 'bg-gradient-to-br from-blue-50 to-blue-100',
      iconColor: 'text-support-blue',
      description: 'Currently being edited',
    },
    {
      id: 6,
      label: 'Completed Today',
      count: 6,
      icon: CheckCircle,
      color: 'bg-gradient-to-br from-green-50 to-green-100',
      iconColor: 'text-support-green',
      description: 'Finished deliveries',
    },
  ];

  // Calculate stats from actual data
  const activeProjects = stats?.jobs || 24;
  const totalLeads = customers.length || 1248;
  const monthlyRevenue = parseFloat(stats?.sales || "29.8").toFixed(1);
  const activeClients = customers.length || 42;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-[1400px] mx-auto space-y-8">
        {/* Welcome Section */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-rpp-grey-dark tracking-tight">
            Welcome back, {(userData as any)?.firstName || userData?.email?.split('@')[0] || 'there'}! 👋
          </h1>
          <p className="text-sm text-rpp-grey-medium font-medium">Here's a snapshot of your media business today</p>
        </div>

        {/* Stats Cards - 4 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Active Projects */}
          <Card 
            className="bg-white border-0 rounded-3xl shadow-rpp-card hover:shadow-rpp-card-hover transition-all duration-300 hover:-translate-y-1"
            data-testid="card-active-projects"
          >
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 bg-gradient-to-br from-rpp-red-lighter to-rpp-red-light rounded-2xl flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-rpp-red-main" />
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-support-green">
                    <TrendingUp className="w-3 h-3" />
                    <span>+12%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-rpp-grey-medium uppercase tracking-wider">Active Projects</p>
                  <p className="text-3xl font-bold text-rpp-grey-dark leading-none">{activeProjects}</p>
                  <p className="text-xs text-rpp-grey-light">vs last month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leads */}
          <Card 
            className="bg-white border-0 rounded-3xl shadow-rpp-card hover:shadow-rpp-card-hover transition-all duration-300 hover:-translate-y-1"
            data-testid="card-leads"
          >
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-support-green" />
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-support-green">
                    <TrendingUp className="w-3 h-3" />
                    <span>+23%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-rpp-grey-medium uppercase tracking-wider">Media Assets</p>
                  <p className="text-3xl font-bold text-rpp-grey-dark leading-none">{totalLeads}</p>
                  <p className="text-xs text-rpp-grey-light">vs last month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Revenue */}
          <Card 
            className="bg-white border-0 rounded-3xl shadow-rpp-card hover:shadow-rpp-card-hover transition-all duration-300 hover:-translate-y-1"
            data-testid="card-revenue"
          >
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 bg-gradient-to-br from-rpp-red-lighter to-rpp-red-light rounded-2xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-rpp-red-main" />
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-support-green">
                    <TrendingUp className="w-3 h-3" />
                    <span>+8%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-rpp-grey-medium uppercase tracking-wider">Monthly Revenue</p>
                  <p className="text-3xl font-bold text-rpp-grey-dark leading-none">${monthlyRevenue}k</p>
                  <p className="text-xs text-rpp-grey-light">vs last month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Clients */}
          <Card 
            className="bg-white border-0 rounded-3xl shadow-rpp-card hover:shadow-rpp-card-hover transition-all duration-300 hover:-translate-y-1"
            data-testid="card-clients"
          >
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl flex items-center justify-center">
                    <UserCheck className="w-5 h-5 text-support-green" />
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-support-green">
                    <TrendingUp className="w-3 h-3" />
                    <span>+5%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-rpp-grey-medium uppercase tracking-wider">Active Clients</p>
                  <p className="text-3xl font-bold text-rpp-grey-dark leading-none">{activeClients}</p>
                  <p className="text-xs text-rpp-grey-light">vs last month</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Needs Your Attention - 3 Rows Layout */}
        <Card className="bg-white border-0 rounded-3xl shadow-rpp-card" data-testid="card-needs-attention">
          <CardContent className="p-7">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-rpp-grey-dark">Needs Your Attention</h2>
                <div className="w-7 h-7 bg-rpp-red-main rounded-full flex items-center justify-center shadow-md">
                  <span className="text-xs font-bold text-white">{attentionMetrics.reduce((sum, item) => sum + item.count, 0)}</span>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-sm font-semibold text-rpp-red-main hover:bg-rpp-red-lighter"
                data-testid="button-view-all"
              >
                View All
              </Button>
            </div>

            {/* Row 1: Ready to Deliver & Requested Revisions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {attentionMetrics.slice(0, 2).map((metric) => (
                <div
                  key={metric.id}
                  className="group relative flex items-center gap-4 p-5 rounded-2xl border-2 border-transparent hover:border-rpp-red-light hover:bg-rpp-red-lighter hover:bg-opacity-20 transition-all cursor-pointer"
                  data-testid={`attention-metric-${metric.id}`}
                >
                  <div className={`w-14 h-14 ${metric.color} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md`}>
                    <metric.icon className={`w-7 h-7 ${metric.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-2xl font-bold text-rpp-grey-dark mb-0.5">{metric.count}</p>
                    <p className="font-semibold text-rpp-grey-dark text-sm mb-1">{metric.label}</p>
                    <p className="text-xs text-rpp-grey-light">{metric.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-rpp-grey-light opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>

            {/* Row 2: Pending Review & Urgent Tasks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {attentionMetrics.slice(2, 4).map((metric) => (
                <div
                  key={metric.id}
                  className="group relative flex items-center gap-4 p-5 rounded-2xl border-2 border-transparent hover:border-rpp-red-light hover:bg-rpp-red-lighter hover:bg-opacity-20 transition-all cursor-pointer"
                  data-testid={`attention-metric-${metric.id}`}
                >
                  <div className={`w-14 h-14 ${metric.color} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md`}>
                    <metric.icon className={`w-7 h-7 ${metric.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-2xl font-bold text-rpp-grey-dark mb-0.5">{metric.count}</p>
                    <p className="font-semibold text-rpp-grey-dark text-sm mb-1">{metric.label}</p>
                    <p className="text-xs text-rpp-grey-light">{metric.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-rpp-grey-light opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>

            {/* Row 3: In Progress & Completed Today */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attentionMetrics.slice(4, 6).map((metric) => (
                <div
                  key={metric.id}
                  className="group relative flex items-center gap-4 p-5 rounded-2xl border-2 border-transparent hover:border-rpp-red-light hover:bg-rpp-red-lighter hover:bg-opacity-20 transition-all cursor-pointer"
                  data-testid={`attention-metric-${metric.id}`}
                >
                  <div className={`w-14 h-14 ${metric.color} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md`}>
                    <metric.icon className={`w-7 h-7 ${metric.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-2xl font-bold text-rpp-grey-dark mb-0.5">{metric.count}</p>
                    <p className="font-semibold text-rpp-grey-dark text-sm mb-1">{metric.label}</p>
                    <p className="text-xs text-rpp-grey-light">{metric.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-rpp-grey-light opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Revenue Overview - Full Width */}
        <Card className="bg-white border-0 rounded-3xl shadow-rpp-card" data-testid="card-revenue-overview">
          <CardContent className="p-7">
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-rpp-grey-dark mb-1">Revenue Overview</h2>
                  <p className="text-sm text-rpp-grey-medium font-medium">Monthly performance result</p>
                </div>
                
                <div className="space-y-1 text-right">
                  <p className="text-[44px] font-bold text-rpp-grey-dark leading-none tracking-tight">${monthlyRevenue}k</p>
                  <p className="text-xs text-rpp-grey-light font-semibold uppercase tracking-wider">This month</p>
                </div>
              </div>

              <div className="h-56 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF6B4A" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#FF6B4A" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#FF6B4A"
                      strokeWidth={3}
                      fill="url(#colorRevenue)"
                      dot={{ r: 4, fill: '#FF6B4A', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, fill: '#FF6B4A', strokeWidth: 3, stroke: '#fff' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Services This Month */}
        <Card className="bg-white border-0 rounded-3xl shadow-rpp-card" data-testid="card-services">
          <CardContent className="p-7">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-rpp-grey-dark mb-1">Services This Month</h2>
                <p className="text-sm text-rpp-grey-medium font-medium">Distribution of services delivered</p>
              </div>
              
              <div className="flex gap-3 flex-wrap">
                <Button variant="ghost" size="sm" className="bg-rpp-red-main text-white hover:bg-rpp-red-dark rounded-xl px-4 font-bold" data-testid="filter-30d">
                  30d
                </Button>
                <Button variant="ghost" size="sm" className="text-rpp-grey-medium hover:bg-rpp-grey-bg rounded-xl px-4 font-semibold" data-testid="filter-60d">
                  60d
                </Button>
                <Button variant="ghost" size="sm" className="text-rpp-grey-medium hover:bg-rpp-grey-bg rounded-xl px-4 font-semibold" data-testid="filter-90d">
                  90d
                </Button>
              </div>
              
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={[
                      { name: 'Photography', value: 150, color: '#E87854' },
                      { name: 'Video Tours', value: 85, color: '#EA9772' },
                      { name: 'Drone', value: 65, color: '#F0B79D' },
                      { name: '3D Tours', value: 50, color: '#F5D0C4' },
                      { name: 'Editing', value: 140, color: '#F5D0C4' },
                    ]} 
                    layout="horizontal"
                    margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      type="number"
                      tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, 160]}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '13px',
                        fontWeight: 600,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                      cursor={{ fill: 'rgba(255, 107, 74, 0.05)' }}
                    />
                    <Bar 
                      dataKey="value" 
                      radius={[8, 8, 0, 0]}
                      barSize={60}
                    >
                      {[
                        { name: 'Photography', value: 150, color: '#E87854' },
                        { name: 'Video Tours', value: 85, color: '#EA9772' },
                        { name: 'Drone', value: 65, color: '#F0B79D' },
                        { name: '3D Tours', value: 50, color: '#F5D0C4' },
                        { name: 'Editing', value: 140, color: '#F5D0C4' },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
