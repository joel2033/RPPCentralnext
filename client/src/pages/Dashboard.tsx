import { useQuery } from "@tanstack/react-query";
import { FolderOpen, Users, DollarSign, UserCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { StatsCard } from "@/components/StatsCard";
import { NeedsAttention } from "@/components/NeedsAttention";
import { RevenueChart } from "@/components/RevenueChart";
import { TodaysJobs } from "@/components/TodaysJobs";

export default function Dashboard() {
  const { userData } = useAuth();
  const { data: stats, isLoading: statsLoading } = useQuery<{jobs: number, sales: string, orders: number}>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery<any[]>({
    queryKey: ["/api/customers"],
  });

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
  });


  // Calculate stats from actual data - no placeholders
  const activeProjects = stats?.jobs;
  const totalOrders = stats?.orders;
  const monthlyRevenue = stats?.sales ? parseFloat(stats.sales).toFixed(1) : undefined;
  const activeClients = customers.length > 0 ? customers.length : undefined;

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
            value={activeProjects?.toString()}
            change="+12%"
            changeType="positive"
            icon={FolderOpen}
            iconBgColor="bg-gradient-to-br from-rpp-red-lighter to-rpp-red-light"
            iconColor="text-rpp-red-main"
            isLoading={statsLoading}
          />
          <StatsCard
            title="ORDERS"
            value={totalOrders?.toString()}
            change="+23%"
            changeType="positive"
            icon={Users}
            iconBgColor="bg-gradient-to-br from-green-50 to-green-100"
            iconColor="text-support-green"
            isLoading={statsLoading}
          />
          <StatsCard
            title="REVENUE"
            value={monthlyRevenue ? `$${monthlyRevenue}` : undefined}
            change="+8%"
            changeType="positive"
            icon={DollarSign}
            iconBgColor="bg-gradient-to-br from-rpp-red-lighter to-rpp-red-light"
            iconColor="text-rpp-red-main"
            isLoading={statsLoading}
          />
          <StatsCard
            title="ACTIVE CLIENTS"
            value={activeClients?.toString()}
            change="+5%"
            changeType="positive"
            icon={UserCheck}
            iconBgColor="bg-gradient-to-br from-green-50 to-green-100"
            iconColor="text-support-green"
            isLoading={customersLoading}
          />
        </div>

        {/* Needs Your Attention, Revenue Overview & Today's Jobs - 3 Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <NeedsAttention />
          <RevenueChart />
          <TodaysJobs jobs={jobs} isLoading={jobsLoading} />
        </div>
      </div>
    </div>
  );
}
