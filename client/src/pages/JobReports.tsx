import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  FolderOpen, 
  Users, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  FileText,
  Download,
  Calendar,
  Filter,
  BarChart3,
  PieChart,
  Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatsCard } from "@/components/StatsCard";
import { useAuth } from "@/contexts/AuthContext";
import { useMasterView } from "@/contexts/MasterViewContext";
import { JobReportsFilters, type ReportFilters } from "@/components/JobReportsFilters";
import { JobReportsCharts } from "@/components/JobReportsCharts";
import { JobReportsTables } from "@/components/JobReportsTables";
import { exportToCSV, exportToPDF } from "@/lib/exportReports";

// Types for report data
interface JobReportStats {
  // Job metrics
  totalJobs: number;
  totalRevenue: number;
  averageJobValue: number;
  jobsByStatus: Record<string, number>;
  invoiceStatusBreakdown: Record<string, number>;
  completionRate: number;
  
  // Order metrics
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  averageRevisionsPerOrder: number;
  revisionRate: number;
  ordersRequiringRevisions: number;
  ordersCompletedWithoutRevisions: number;
  
  // Period comparison
  periodComparison: {
    previousPeriod: {
      totalJobs: number;
      totalRevenue: number;
      totalOrders: number;
      revisionRate: number;
    };
  };
}

interface TimelineData {
  jobsOverTime: Array<{ date: string; count: number }>;
  revenueOverTime: Array<{ date: string; revenue: number }>;
  ordersOverTime: Array<{ date: string; count: number }>;
  revisionsOverTime: Array<{ date: string; count: number }>;
  revisionRateOverTime: Array<{ date: string; rate: number }>;
}

interface BreakdownData {
  topCustomers: Array<{ customerId: string; customerName: string; jobCount: number; totalRevenue: number }>;
  topPhotographers: Array<{ userId: string; userName: string; jobCount: number; totalRevenue: number }>;
  mostCommonRevisionReasons: Array<{ reason: string; count: number; percentage: number }>;
  mostCommonEditRequests: Array<{ request: string; count: number; percentage: number }>;
  ordersByEditor: Array<{ editorId: string; editorName: string; orderCount: number; revisionCount: number; revisionRate: number }>;
  revisionFrequencyDistribution: Array<{ revisionCount: number; orderCount: number; percentage: number }>;
}

interface PerformanceData {
  averageTurnaroundTime: number;
  onTimeDeliveryRate: number;
  revenuePerCustomer: number;
  jobsPerPhotographer: number;
  averageOrderProcessingTime: number;
  ordersCompletedOnFirstTryRate: number;
  editorPerformance: Array<{
    editorId: string;
    editorName: string;
    ordersCompleted: number;
    revisionRate: number;
    averageProcessingTime: number;
  }>;
}

export default function JobReports() {
  const { userData } = useAuth();
  const { isReadOnly } = useMasterView();
  
  // Filters state
  const [filters, setFilters] = useState<ReportFilters>({
    dateRange: 'this_month',
    startDate: null,
    endDate: null,
    status: 'all',
    customerId: 'all',
    photographerId: 'all',
    invoiceStatus: 'all',
    orderStatus: 'all',
  });

  // Build query string from filters
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.dateRange) params.append('dateRange', filters.dateRange);
    if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
    if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
    if (filters.status !== 'all') params.append('status', filters.status);
    if (filters.customerId !== 'all') params.append('customerId', filters.customerId);
    if (filters.photographerId !== 'all') params.append('photographerId', filters.photographerId);
    if (filters.invoiceStatus !== 'all') params.append('invoiceStatus', filters.invoiceStatus);
    if (filters.orderStatus !== 'all') params.append('orderStatus', filters.orderStatus);
    return params.toString();
  }, [filters]);

  // Fetch report data
  const { data: stats, isLoading: statsLoading } = useQuery<JobReportStats>({
    queryKey: [`/api/jobs/reports/stats?${queryString}`],
  });

  const { data: timeline, isLoading: timelineLoading } = useQuery<TimelineData>({
    queryKey: [`/api/jobs/reports/timeline?${queryString}`],
  });

  const { data: breakdowns, isLoading: breakdownsLoading } = useQuery<BreakdownData>({
    queryKey: [`/api/jobs/reports/breakdowns?${queryString}`],
  });

  const { data: performance, isLoading: performanceLoading } = useQuery<PerformanceData>({
    queryKey: [`/api/jobs/reports/performance?${queryString}`],
  });

  // Fetch customers and users for filter dropdowns
  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["/api/customers"],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Calculate change percentages
  const calculateChange = (current: number | undefined, previous: number | undefined): { value: string; type: 'positive' | 'negative' } => {
    if (!current || !previous || previous === 0) return { value: '+0%', type: 'positive' };
    const change = ((current - previous) / previous) * 100;
    return {
      value: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
      type: change >= 0 ? 'positive' : 'negative'
    };
  };

  const jobsChange = calculateChange(stats?.totalJobs, stats?.periodComparison?.previousPeriod?.totalJobs);
  const revenueChange = calculateChange(stats?.totalRevenue, stats?.periodComparison?.previousPeriod?.totalRevenue);
  const ordersChange = calculateChange(stats?.totalOrders, stats?.periodComparison?.previousPeriod?.totalOrders);
  const revisionRateChange = calculateChange(stats?.revisionRate, stats?.periodComparison?.previousPeriod?.revisionRate);

  // Handle export
  const handleExportCSV = () => {
    if (!stats || !breakdowns) return;
    exportToCSV({
      stats,
      breakdowns,
      filters,
      fileName: `job-reports-${new Date().toISOString().split('T')[0]}.csv`
    });
  };

  const handleExportPDF = () => {
    if (!stats || !breakdowns || !performance) return;
    exportToPDF({
      stats,
      breakdowns,
      performance,
      filters,
      fileName: `job-reports-${new Date().toISOString().split('T')[0]}.pdf`
    });
  };

  const isLoading = statsLoading || timelineLoading || breakdownsLoading || performanceLoading;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl text-rpp-grey-dark tracking-tight font-medium flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-rpp-red-main" />
              Job Reports
            </h1>
            <p className="text-rpp-grey-medium font-medium text-[18px]">
              Comprehensive analytics and insights for your jobs and orders
            </p>
          </div>
          
          {/* Export Buttons */}
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={handleExportCSV}
              disabled={isLoading}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <Button 
              variant="outline" 
              onClick={handleExportPDF}
              disabled={isLoading}
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Filters */}
        <JobReportsFilters 
          filters={filters}
          onFiltersChange={setFilters}
          customers={customers}
          users={users}
        />

        {/* Overview Statistics Cards */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-rpp-grey-dark">Overview</h2>
          
          {/* Job Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="TOTAL JOBS"
              value={stats?.totalJobs?.toString()}
              change={jobsChange.value}
              changeType={jobsChange.type}
              icon={FolderOpen}
              iconBgColor="bg-gradient-to-br from-rpp-red-lighter to-rpp-red-light"
              iconColor="text-rpp-red-main"
              isLoading={statsLoading}
            />
            <StatsCard
              title="TOTAL REVENUE"
              value={stats?.totalRevenue ? `$${stats.totalRevenue.toLocaleString()}` : undefined}
              change={revenueChange.value}
              changeType={revenueChange.type}
              icon={DollarSign}
              iconBgColor="bg-gradient-to-br from-green-50 to-green-100"
              iconColor="text-support-green"
              isLoading={statsLoading}
            />
            <StatsCard
              title="AVG JOB VALUE"
              value={stats?.averageJobValue ? `$${stats.averageJobValue.toFixed(0)}` : undefined}
              icon={TrendingUp}
              iconBgColor="bg-gradient-to-br from-blue-50 to-blue-100"
              iconColor="text-blue-600"
              isLoading={statsLoading}
            />
            <StatsCard
              title="COMPLETION RATE"
              value={stats?.completionRate ? `${stats.completionRate.toFixed(1)}%` : undefined}
              icon={CheckCircle}
              iconBgColor="bg-gradient-to-br from-purple-50 to-purple-100"
              iconColor="text-purple-600"
              isLoading={statsLoading}
            />
          </div>
          
          {/* Order Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="TOTAL ORDERS"
              value={stats?.totalOrders?.toString()}
              change={ordersChange.value}
              changeType={ordersChange.type}
              icon={Users}
              iconBgColor="bg-gradient-to-br from-orange-50 to-orange-100"
              iconColor="text-orange-600"
              isLoading={statsLoading}
            />
            <StatsCard
              title="REVISION RATE"
              value={stats?.revisionRate ? `${stats.revisionRate.toFixed(1)}%` : undefined}
              change={revisionRateChange.value}
              changeType={revisionRateChange.type === 'positive' ? 'negative' : 'positive'}
              icon={RefreshCw}
              iconBgColor="bg-gradient-to-br from-yellow-50 to-yellow-100"
              iconColor="text-yellow-600"
              isLoading={statsLoading}
            />
            <StatsCard
              title="AVG REVISIONS/ORDER"
              value={stats?.averageRevisionsPerOrder?.toFixed(2)}
              icon={Activity}
              iconBgColor="bg-gradient-to-br from-red-50 to-red-100"
              iconColor="text-red-600"
              isLoading={statsLoading}
            />
            <StatsCard
              title="FIRST-TRY SUCCESS"
              value={stats?.ordersCompletedWithoutRevisions ? 
                `${((stats.ordersCompletedWithoutRevisions / (stats.totalOrders || 1)) * 100).toFixed(1)}%` : 
                undefined}
              icon={CheckCircle}
              iconBgColor="bg-gradient-to-br from-emerald-50 to-emerald-100"
              iconColor="text-emerald-600"
              isLoading={statsLoading}
            />
          </div>
        </div>

        {/* Job Status Breakdown */}
        {stats?.jobsByStatus && (
          <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-lg font-semibold text-rpp-grey-dark">Jobs by Status</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="flex flex-wrap gap-4">
                {Object.entries(stats.jobsByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl">
                    <span className={`w-3 h-3 rounded-full ${
                      status === 'delivered' ? 'bg-green-500' :
                      status === 'booked' ? 'bg-blue-500' :
                      status === 'pending' ? 'bg-yellow-500' :
                      status === 'on_hold' ? 'bg-orange-500' :
                      status === 'cancelled' ? 'bg-red-500' : 'bg-gray-500'
                    }`} />
                    <span className="text-sm font-medium text-rpp-grey-dark capitalize">
                      {status.replace('_', ' ')}: {count}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Status Breakdown */}
        {stats?.ordersByStatus && (
          <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-lg font-semibold text-rpp-grey-dark">Orders by Status</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="flex flex-wrap gap-4">
                {Object.entries(stats.ordersByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl">
                    <span className={`w-3 h-3 rounded-full ${
                      status === 'completed' ? 'bg-green-500' :
                      status === 'processing' ? 'bg-blue-500' :
                      status === 'pending' ? 'bg-yellow-500' :
                      status === 'in_revision' ? 'bg-orange-500' :
                      status === 'human_check' ? 'bg-purple-500' :
                      status === 'cancelled' ? 'bg-red-500' : 'bg-gray-500'
                    }`} />
                    <span className="text-sm font-medium text-rpp-grey-dark capitalize">
                      {status.replace('_', ' ')}: {count}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for different report sections */}
        <Tabs defaultValue="charts" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
            <TabsTrigger value="charts">Charts</TabsTrigger>
            <TabsTrigger value="breakdowns">Breakdowns</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="charts" className="space-y-6">
            <JobReportsCharts 
              timeline={timeline}
              isLoading={timelineLoading}
            />
          </TabsContent>

          <TabsContent value="breakdowns" className="space-y-6">
            <JobReportsTables 
              breakdowns={breakdowns}
              isLoading={breakdownsLoading}
            />
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
                <CardContent className="p-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-rpp-grey-medium">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-medium">Avg Turnaround Time</span>
                    </div>
                    <p className="text-3xl font-bold text-rpp-grey-dark">
                      {performanceLoading ? '...' : 
                        performance?.averageTurnaroundTime ? 
                          `${performance.averageTurnaroundTime.toFixed(1)} days` : 
                          'N/A'}
                    </p>
                    <p className="text-xs text-rpp-grey-light">Job creation to delivery</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
                <CardContent className="p-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-rpp-grey-medium">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">On-Time Delivery Rate</span>
                    </div>
                    <p className="text-3xl font-bold text-rpp-grey-dark">
                      {performanceLoading ? '...' : 
                        performance?.onTimeDeliveryRate ? 
                          `${performance.onTimeDeliveryRate.toFixed(1)}%` : 
                          'N/A'}
                    </p>
                    <p className="text-xs text-rpp-grey-light">Delivered by due date</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
                <CardContent className="p-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-rpp-grey-medium">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-sm font-medium">Revenue per Customer</span>
                    </div>
                    <p className="text-3xl font-bold text-rpp-grey-dark">
                      {performanceLoading ? '...' : 
                        performance?.revenuePerCustomer ? 
                          `$${performance.revenuePerCustomer.toFixed(0)}` : 
                          'N/A'}
                    </p>
                    <p className="text-xs text-rpp-grey-light">Average lifetime value</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
                <CardContent className="p-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-rpp-grey-medium">
                      <Activity className="w-4 h-4" />
                      <span className="text-sm font-medium">Avg Order Processing</span>
                    </div>
                    <p className="text-3xl font-bold text-rpp-grey-dark">
                      {performanceLoading ? '...' : 
                        performance?.averageOrderProcessingTime ? 
                          `${performance.averageOrderProcessingTime.toFixed(1)} days` : 
                          'N/A'}
                    </p>
                    <p className="text-xs text-rpp-grey-light">Creation to completion</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
                <CardContent className="p-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-rpp-grey-medium">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">First-Try Success Rate</span>
                    </div>
                    <p className="text-3xl font-bold text-rpp-grey-dark">
                      {performanceLoading ? '...' : 
                        performance?.ordersCompletedOnFirstTryRate ? 
                          `${performance.ordersCompletedOnFirstTryRate.toFixed(1)}%` : 
                          'N/A'}
                    </p>
                    <p className="text-xs text-rpp-grey-light">No revisions needed</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
                <CardContent className="p-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-rpp-grey-medium">
                      <Users className="w-4 h-4" />
                      <span className="text-sm font-medium">Jobs per Photographer</span>
                    </div>
                    <p className="text-3xl font-bold text-rpp-grey-dark">
                      {performanceLoading ? '...' : 
                        performance?.jobsPerPhotographer ? 
                          performance.jobsPerPhotographer.toFixed(1) : 
                          'N/A'}
                    </p>
                    <p className="text-xs text-rpp-grey-light">Average per team member</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Editor Performance Table */}
            {performance?.editorPerformance && performance.editorPerformance.length > 0 && (
              <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
                <CardHeader className="p-6 pb-4">
                  <CardTitle className="text-lg font-semibold text-rpp-grey-dark">Editor Performance</CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-rpp-grey-medium">Editor</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-rpp-grey-medium">Orders Completed</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-rpp-grey-medium">Revision Rate</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-rpp-grey-medium">Avg Processing Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {performance.editorPerformance.map((editor) => (
                          <tr key={editor.editorId} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-3 px-4 text-sm font-medium text-rpp-grey-dark">{editor.editorName}</td>
                            <td className="py-3 px-4 text-sm text-right text-rpp-grey-dark">{editor.ordersCompleted}</td>
                            <td className="py-3 px-4 text-sm text-right">
                              <span className={`font-medium ${editor.revisionRate > 30 ? 'text-red-600' : editor.revisionRate > 15 ? 'text-yellow-600' : 'text-green-600'}`}>
                                {editor.revisionRate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-rpp-grey-dark">
                              {editor.averageProcessingTime.toFixed(1)} days
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
