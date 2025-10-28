import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderOpen, Users, DollarSign, UserCheck } from "lucide-react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from "@/contexts/AuthContext";
import { StatsCard } from "@/components/StatsCard";
import { NeedsAttention } from "@/components/NeedsAttention";
import { RevenueChart } from "@/components/RevenueChart";

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
          <h1 className="text-3xl text-rpp-grey-dark tracking-tight font-medium">
            Welcome back, {settings?.personalProfile?.firstName || userData?.email?.split('@')[0] || 'there'}! 👋
          </h1>
          <p className="text-rpp-grey-medium font-medium text-[18px]">Here's a snapshot of your media business today</p>
        </div>

        {/* Stats Cards - 4 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="JOBS"
            value={activeProjects.toString()}
            change="+12%"
            changeType="positive"
            icon={FolderOpen}
            iconBgColor="bg-gradient-to-br from-rpp-red-lighter to-rpp-red-light"
            iconColor="text-rpp-red-main"
          />
          <StatsCard
            title="ORDERS"
            value={totalLeads.toString()}
            change="+23%"
            changeType="positive"
            icon={Users}
            iconBgColor="bg-gradient-to-br from-green-50 to-green-100"
            iconColor="text-support-green"
          />
          <StatsCard
            title="REVENUE"
            value={`$${monthlyRevenue}`}
            change="+8%"
            changeType="positive"
            icon={DollarSign}
            iconBgColor="bg-gradient-to-br from-rpp-red-lighter to-rpp-red-light"
            iconColor="text-rpp-red-main"
          />
          <StatsCard
            title="ACTIVE CLIENTS"
            value={activeClients.toString()}
            change="+5%"
            changeType="positive"
            icon={UserCheck}
            iconBgColor="bg-gradient-to-br from-green-50 to-green-100"
            iconColor="text-support-green"
          />
        </div>

        {/* Needs Your Attention & Revenue Overview - 2 Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <NeedsAttention />
          <RevenueChart />
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
