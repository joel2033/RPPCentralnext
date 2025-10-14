import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, Users, DollarSign, UserCheck, Clock, AlertCircle, TrendingUp, Circle, ChevronRight } from "lucide-react";
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
    <div className="min-h-screen" style={{ backgroundColor: '#FDF7F2' }}>
      <div className="max-w-[1400px] mx-auto px-16 py-10">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-rpp-grey-dark tracking-tight">
              Welcome back, {userData?.email?.split('@')[0] || 'Sarah'}! 👋
            </h1>
            <p className="text-sm text-rpp-grey-medium font-medium">Here's a snapshot of your media business today</p>
          </div>

          {/* Stats Cards - 4 columns with horizontal layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Active Projects */}
            <Card 
              className="bg-white border border-gray-100 rounded-2xl shadow-[0_4px_12px_rgba(17,24,39,0.08)] hover:shadow-[0_8px_20px_rgba(17,24,39,0.12)] transition-all duration-300 hover:-translate-y-0.5"
              data-testid="card-active-projects"
            >
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFE7E0', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}>
                      <FolderOpen className="w-6 h-6 text-rpp-red-main" />
                    </div>
                    <span className="text-xs font-semibold text-rpp-grey-medium uppercase" style={{ letterSpacing: '0.08em' }}>Active Projects</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[52px] font-semibold text-rpp-grey-dark leading-none" style={{ letterSpacing: '-0.02em' }}>{activeProjects}</p>
                    <div className="flex items-center justify-end gap-1 mt-2 text-xs font-semibold text-support-green">
                      <TrendingUp className="w-4 h-4" />
                      <span>+4 last month</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Leads */}
            <Card 
              className="bg-white border border-gray-100 rounded-2xl shadow-[0_4px_12px_rgba(17,24,39,0.08)] hover:shadow-[0_8px_20px_rgba(17,24,39,0.12)] transition-all duration-300 hover:-translate-y-0.5"
              data-testid="card-leads"
            >
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EEF9F2', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}>
                      <Users className="w-6 h-6 text-support-green" />
                    </div>
                    <span className="text-xs font-semibold text-rpp-grey-medium uppercase" style={{ letterSpacing: '0.08em' }}>Leads</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[52px] font-semibold text-rpp-grey-dark leading-none" style={{ letterSpacing: '-0.02em' }}>{totalLeads}</p>
                    <div className="flex items-center justify-end gap-1 mt-2 text-xs font-semibold text-support-green">
                      <TrendingUp className="w-4 h-4" />
                      <span>+23%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Revenue */}
            <Card 
              className="bg-white border border-gray-100 rounded-2xl shadow-[0_4px_12px_rgba(17,24,39,0.08)] hover:shadow-[0_8px_20px_rgba(17,24,39,0.12)] transition-all duration-300 hover:-translate-y-0.5"
              data-testid="card-revenue"
            >
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFE7E0', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}>
                      <DollarSign className="w-6 h-6 text-rpp-red-main" />
                    </div>
                    <span className="text-xs font-semibold text-rpp-grey-medium uppercase" style={{ letterSpacing: '0.08em' }}>Monthly Revenue</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[52px] font-semibold text-rpp-grey-dark leading-none" style={{ letterSpacing: '-0.02em' }}>${monthlyRevenue}k</p>
                    <div className="flex items-center justify-end gap-1 mt-2 text-xs font-semibold text-support-green">
                      <TrendingUp className="w-4 h-4" />
                      <span>+8%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Clients */}
            <Card 
              className="bg-white border border-gray-100 rounded-2xl shadow-[0_4px_12px_rgba(17,24,39,0.08)] hover:shadow-[0_8px_20px_rgba(17,24,39,0.12)] transition-all duration-300 hover:-translate-y-0.5"
              data-testid="card-clients"
            >
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EEF9F2', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}>
                      <UserCheck className="w-6 h-6 text-support-green" />
                    </div>
                    <span className="text-xs font-semibold text-rpp-grey-medium uppercase" style={{ letterSpacing: '0.08em' }}>Active Clients</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[52px] font-semibold text-rpp-grey-dark leading-none" style={{ letterSpacing: '-0.02em' }}>{activeClients}</p>
                    <div className="flex items-center justify-end gap-1 mt-2 text-xs font-semibold text-support-green">
                      <TrendingUp className="w-4 h-4" />
                      <span>+5 last month</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Needs Your Attention - Left Column (2/3 width) */}
            <div className="lg:col-span-2">
              <Card className="bg-white border border-gray-100 rounded-2xl shadow-[0_4px_12px_rgba(17,24,39,0.08)]" data-testid="card-needs-attention">
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-rpp-grey-dark">Needs Your Attention</h2>
                      <div className="w-7 h-7 bg-rpp-red-main rounded-full flex items-center justify-center">
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

                  <div className="space-y-0">
                    {needsAttentionItems.map((item, index) => (
                      <div 
                        key={item.id} 
                        className={`flex items-start gap-4 px-6 py-5 hover:bg-gray-50 transition-colors cursor-pointer ${
                          index < needsAttentionItems.length - 1 ? 'border-b' : ''
                        }`}
                        style={{ borderColor: '#F3E7DD' }}
                        data-testid={`attention-item-${item.id}`}
                      >
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0`} style={{
                          backgroundColor: item.type === 'urgent' ? '#FFE7E0' : '#EEF9F2',
                          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)'
                        }}>
                          <item.icon className={`w-5 h-5 ${
                            item.type === 'urgent' ? 'text-rpp-red-main' : 'text-support-green'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-rpp-grey-dark text-sm">{item.title}</p>
                            {item.type === 'urgent' && (
                              <Badge className="bg-rpp-red-lighter text-rpp-red-main text-xs px-2 py-0.5 font-bold border-0 rounded-full">
                                Urgent
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-rpp-grey-medium font-medium mb-2" style={{ lineHeight: '150%' }}>{item.description}</p>
                          <div className="flex items-center gap-2 text-[13px] text-rpp-grey-light font-medium">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {item.time}
                            </span>
                            <span>·</span>
                            <span>{item.client}</span>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-rpp-grey-light hover:text-rpp-red-main hover:bg-transparent"
                          data-testid={`button-view-${item.id}`}
                        >
                          <ChevronRight className="w-5 h-5" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button 
                    variant="link" 
                    className="w-full mt-4 text-rpp-grey-medium hover:text-rpp-grey-dark text-sm font-bold"
                    data-testid="button-mark-all-read"
                  >
                    Mark All As Read
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Overview - Right Column (1/3 width) */}
            <div>
              <Card className="bg-white border border-gray-100 rounded-2xl shadow-[0_4px_12px_rgba(17,24,39,0.08)] h-full" data-testid="card-revenue-overview">
                <CardContent className="p-8">
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-rpp-grey-dark mb-1">Revenue Overview</h2>
                      <p className="text-sm text-rpp-grey-medium font-medium">Monthly performance result</p>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-[52px] font-semibold text-rpp-grey-dark leading-none" style={{ letterSpacing: '-0.02em' }}>${monthlyRevenue}k</p>
                      <p className="text-xs text-rpp-grey-light font-semibold uppercase tracking-wider">This month</p>
                    </div>

                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={revenueData} margin={{ left: 24, right: 24 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F5EDE4" vertical={false} />
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
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#FF6B4A" 
                            strokeWidth={2}
                            dot={{ fill: '#FF6B4A', r: 5, strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 6, fill: '#FF6B4A', strokeWidth: 2, stroke: '#fff' }}
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
          <Card className="bg-white border border-gray-100 rounded-2xl shadow-[0_4px_12px_rgba(17,24,39,0.08)]" data-testid="card-services">
            <CardContent className="p-8">
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-rpp-grey-dark mb-1">Services This Month</h2>
                  <p className="text-sm text-rpp-grey-medium font-medium">Distribution of services delivered</p>
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
                      margin={{ left: 24, right: 24 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#F5EDE4" horizontal={false} />
                      <XAxis 
                        type="number"
                        tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 500 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        type="category"
                        dataKey="name" 
                        tick={{ fill: '#374151', fontSize: 13, fontWeight: 600 }}
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
                        radius={[0, 12, 12, 0]}
                        barSize={36}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
