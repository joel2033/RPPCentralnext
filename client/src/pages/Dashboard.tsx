import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, Users, DollarSign, UserCheck, Clock, AlertCircle, TrendingUp, Circle, ChevronRight } from "lucide-react";
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
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

  // Mock needs attention items
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
    <div className="min-h-screen bg-rpp-cream p-8">
      <div className="max-w-[1400px] mx-auto space-y-8">
        {/* Welcome Section */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-rpp-grey-dark tracking-tight">
            Welcome back, {userData?.email?.split('@')[0] || 'Sarah'}! 👋
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
            <CardContent className="p-7">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-rpp-red-lighter to-rpp-red-light rounded-2xl flex items-center justify-center shadow-lg">
                    <FolderOpen className="w-6 h-6 text-rpp-red-main" />
                  </div>
                  <span className="text-xs font-semibold text-rpp-grey-medium uppercase tracking-[0.08em]">Active Projects</span>
                </div>
                <div className="h-1 w-16 bg-gradient-to-r from-rpp-red-main to-rpp-red-light rounded-full"></div>
                <div>
                  <p className="text-[44px] font-bold text-rpp-grey-dark leading-none tracking-tight mb-2">{activeProjects}</p>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-support-green">
                    <TrendingUp className="w-4 h-4" />
                    <span>+4 last month</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leads */}
          <Card 
            className="bg-white border-0 rounded-3xl shadow-rpp-card hover:shadow-rpp-card-hover transition-all duration-300 hover:-translate-y-1"
            data-testid="card-leads"
          >
            <CardContent className="p-7">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl flex items-center justify-center shadow-lg">
                    <Users className="w-6 h-6 text-support-green" />
                  </div>
                  <span className="text-xs font-semibold text-rpp-grey-medium uppercase tracking-[0.08em]">Leads</span>
                </div>
                <div className="h-1 w-16 bg-gradient-to-r from-support-green to-green-400 rounded-full"></div>
                <div>
                  <p className="text-[44px] font-bold text-rpp-grey-dark leading-none tracking-tight mb-2">{totalLeads}</p>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-support-green">
                    <TrendingUp className="w-4 h-4" />
                    <span>+23%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Revenue */}
          <Card 
            className="bg-white border-0 rounded-3xl shadow-rpp-card hover:shadow-rpp-card-hover transition-all duration-300 hover:-translate-y-1"
            data-testid="card-revenue"
          >
            <CardContent className="p-7">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-rpp-red-lighter to-rpp-red-light rounded-2xl flex items-center justify-center shadow-lg">
                    <DollarSign className="w-6 h-6 text-rpp-red-main" />
                  </div>
                  <span className="text-xs font-semibold text-rpp-grey-medium uppercase tracking-[0.08em]">Monthly Revenue</span>
                </div>
                <div className="h-1 w-16 bg-gradient-to-r from-rpp-red-main to-rpp-red-light rounded-full"></div>
                <div>
                  <p className="text-[44px] font-bold text-rpp-grey-dark leading-none tracking-tight mb-2">${monthlyRevenue}k</p>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-support-green">
                    <TrendingUp className="w-4 h-4" />
                    <span>+8%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Clients */}
          <Card 
            className="bg-white border-0 rounded-3xl shadow-rpp-card hover:shadow-rpp-card-hover transition-all duration-300 hover:-translate-y-1"
            data-testid="card-clients"
          >
            <CardContent className="p-7">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl flex items-center justify-center shadow-lg">
                    <UserCheck className="w-6 h-6 text-support-green" />
                  </div>
                  <span className="text-xs font-semibold text-rpp-grey-medium uppercase tracking-[0.08em]">Active Clients</span>
                </div>
                <div className="h-1 w-16 bg-gradient-to-r from-support-green to-green-400 rounded-full"></div>
                <div>
                  <p className="text-[44px] font-bold text-rpp-grey-dark leading-none tracking-tight mb-2">{activeClients}</p>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-support-green">
                    <TrendingUp className="w-4 h-4" />
                    <span>+5 last month</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Needs Your Attention - Left Column (1/3 width) */}
          <div className="lg:col-span-1">
            <Card className="bg-white border-0 rounded-3xl shadow-rpp-card" data-testid="card-needs-attention">
              <CardContent className="p-7">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-rpp-grey-dark">Needs Your Attention</h2>
                    <div className="w-7 h-7 bg-rpp-red-main rounded-full flex items-center justify-center shadow-md">
                      <span className="text-xs font-bold text-white">{needsAttentionItems.length}</span>
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

                <div className="space-y-4">
                  {needsAttentionItems.map((item, index) => (
                    <div 
                      key={item.id} 
                      className={`group relative flex items-start gap-4 p-5 rounded-2xl border-2 border-transparent hover:border-rpp-red-light hover:bg-rpp-red-lighter hover:bg-opacity-20 transition-all cursor-pointer ${
                        index < needsAttentionItems.length - 1 ? 'after:absolute after:inset-x-5 after:bottom-0 after:h-px after:bg-rpp-grey-border after:opacity-50' : ''
                      }`}
                      data-testid={`attention-item-${item.id}`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md ${
                        item.type === 'urgent' 
                          ? 'bg-gradient-to-br from-rpp-red-lighter to-rpp-red-light' 
                          : 'bg-gradient-to-br from-green-50 to-green-100'
                      }`}>
                        <item.icon className={`w-6 h-6 ${
                          item.type === 'urgent' ? 'text-rpp-red-main' : 'text-support-green'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-rpp-grey-dark text-base">{item.title}</p>
                            {item.type === 'urgent' && (
                              <Badge className="bg-rpp-red-lighter text-rpp-red-main text-xs px-2.5 py-0.5 font-bold border-0 rounded-full">
                                Urgent
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-rpp-grey-medium font-medium mb-3">{item.description}</p>
                        <div className="flex items-center gap-5 text-xs text-rpp-grey-light font-semibold">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {item.time}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Circle className="w-1.5 h-1.5 fill-current" />
                            {item.client}
                          </span>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-rpp-red-main hover:bg-rpp-red-lighter font-bold text-sm px-5 rounded-xl"
                        data-testid={`button-view-${item.id}`}
                      >
                        View
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button 
                  variant="link" 
                  className="w-full mt-6 text-rpp-grey-medium hover:text-rpp-grey-dark text-sm font-bold"
                  data-testid="button-mark-all-read"
                >
                  Mark All As Read
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Overview - Right Column (2/3 width) */}
          <div className="lg:col-span-2">
            <Card className="bg-white border-0 rounded-3xl shadow-rpp-card h-full" data-testid="card-revenue-overview">
              <CardContent className="p-7">
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-rpp-grey-dark mb-1">Revenue Overview</h2>
                    <p className="text-sm text-rpp-grey-medium font-medium">Monthly performance result</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[44px] font-bold text-rpp-grey-dark leading-none tracking-tight">${monthlyRevenue}k</p>
                    <p className="text-xs text-rpp-grey-light font-semibold uppercase tracking-wider">This month</p>
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
                          dot={false}
                          activeDot={{ r: 6, fill: '#FF6B4A', strokeWidth: 3, stroke: '#fff' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

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
                      { name: 'Photos', value: 45 },
                      { name: 'Videos', value: 30 },
                      { name: 'Virtual Tours', value: 15 },
                      { name: 'Floor Plans', value: 10 },
                    ]} 
                    layout="vertical"
                    margin={{ left: 20, right: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" horizontal={false} />
                    <XAxis 
                      type="number"
                      tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      type="category"
                      dataKey="name" 
                      tick={{ fill: '#374151', fontSize: 14, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      width={140}
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
                      fill="#FF6B4A"
                      radius={[0, 16, 16, 0]}
                      barSize={40}
                    />
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
