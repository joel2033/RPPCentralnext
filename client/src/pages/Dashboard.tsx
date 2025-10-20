import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/StatsCard";
import { NeedsAttention } from "@/components/NeedsAttention";
import { RevenueChart } from "@/components/RevenueChart";
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

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
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
            Welcome back, {settings?.personalProfile?.firstName || userData?.email?.split('@')[0] || 'there'}! 👋
          </h1>
          <p className="text-sm text-rpp-grey-medium font-medium">Here's a snapshot of your media business today</p>
        </div>

        {/* Stats Cards - 4 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Active Projects"
            value={String(activeProjects)}
            change="+12%"
            changeType="positive"
            icon={FolderOpen}
          />
          <StatsCard
            title="Media Assets"
            value={String(totalLeads)}
            change="+23%"
            changeType="positive"
            icon={Users}
          />
          <StatsCard
            title="Monthly Revenue"
            value={`$${monthlyRevenue}k`}
            change="+8%"
            changeType="positive"
            icon={DollarSign}
          />
          <StatsCard
            title="Active Clients"
            value={String(activeClients)}
            change="+5%"
            changeType="positive"
            icon={UserCheck}
          />
        </div>

        {/* Needs Your Attention */}
        <NeedsAttention />

        {/* Revenue Overview */}
        <RevenueChart />

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
