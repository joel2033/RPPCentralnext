import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  DollarSign,
  TrendingUp,
  FileText,
  ExternalLink,
  Settings,
  Loader2,
  BarChart3,
  Calendar,
} from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subMonths,
} from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatsCard } from "@/components/StatsCard";

const DATE_RANGE_PRESETS = [
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "all_time", label: "All Time" },
  { value: "custom", label: "Custom Range" },
];

const INVOICE_STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "no_invoice", label: "No invoice generated" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

function getResolvedDateRange(
  dateRange: string,
  customStart: Date | null,
  customEnd: Date | null
): { start: Date | null; end: Date | null } {
  const now = new Date();
  if (dateRange === "custom" && customStart && customEnd) {
    return { start: customStart, end: customEnd };
  }
  switch (dateRange) {
    case "this_month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last_month": {
      const last = subMonths(now, 1);
      return { start: startOfMonth(last), end: endOfMonth(last) };
    }
    case "this_quarter":
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case "this_year":
      return { start: startOfYear(now), end: endOfYear(now) };
    case "all_time":
    default:
      return { start: null, end: null };
  }
}

interface RevenueOverviewData {
  xero: {
    totalIncome: number;
    totalExpenses: number;
    operatingExpenses: number;
    netProfit: number;
    averageOrder: number;
    fromDate: string;
    toDate: string;
  } | null;
  jobRevenue: number;
  totalEditingSpend: number;
  grossMargin: number;
  invoiceStatusBreakdown: Record<string, number>;
  jobCount: number;
  orderCount: number;
  fromDate: string;
  toDate: string;
}

interface JobByInvoiceItem {
  id: string;
  jobId: string;
  jobName: string | null;
  address: string;
  customerName: string;
  status: string;
  invoiceStatus: string;
  revenue: number;
  totalValue: string | number;
  deliveredAt: string | null;
  createdAt: string | null;
  appointmentDate: string | null;
}

export default function RevenueOverview() {
  const [dateRange, setDateRange] = useState("this_month");
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");

  const resolved = useMemo(
    () => getResolvedDateRange(dateRange, customStart, customEnd),
    [dateRange, customStart, customEnd]
  );

  const overviewQueryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("dateRange", dateRange);
    if (dateRange === "custom" && customStart && customEnd) {
      params.set("startDate", customStart.toISOString());
      params.set("endDate", customEnd.toISOString());
    }
    return params.toString();
  }, [dateRange, customStart, customEnd]);

  const jobsByInvoiceQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (resolved.start) params.set("startDate", resolved.start.toISOString());
    if (resolved.end) params.set("endDate", resolved.end.toISOString());
    if (invoiceStatusFilter !== "all") params.set("invoiceStatus", invoiceStatusFilter);
    return params.toString();
  }, [resolved.start, resolved.end, invoiceStatusFilter]);

  const { data: overview, isLoading: overviewLoading } = useQuery<RevenueOverviewData>({
    queryKey: [`/api/reports/revenue/overview?${overviewQueryString}`],
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery<{
    jobs: JobByInvoiceItem[];
    total: number;
  }>({
    queryKey: [`/api/reports/revenue/jobs-by-invoice?${jobsByInvoiceQueryString}`],
  });

  const jobs = jobsData?.jobs ?? [];
  const totalJobs = jobsData?.total ?? 0;

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-rpp-grey-dark flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />
            Revenue Overview
          </h1>
          <p className="text-sm text-rpp-grey-medium mt-1">
            Xero metrics, job revenue, editing spend, and jobs by invoice status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-rpp-grey-medium" />
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGE_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Section 1: Xero metrics */}
      <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-lg font-semibold text-rpp-grey-dark flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Xero profit & loss
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-2">
          {overviewLoading ? (
            <div className="flex items-center gap-2 text-rpp-grey-medium py-6">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading Xero data...</span>
            </div>
          ) : overview?.xero ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard
                title="Total income"
                value={`$${overview.xero.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={TrendingUp}
                iconBgColor="bg-gradient-to-br from-green-50 to-green-100"
                iconColor="text-support-green"
              />
              <StatsCard
                title="Operating expenses"
                value={`$${(overview.xero.operatingExpenses ?? overview.xero.totalExpenses).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={DollarSign}
                iconBgColor="bg-gradient-to-br from-orange-50 to-orange-100"
                iconColor="text-orange-600"
              />
              <StatsCard
                title="Net profit"
                value={
                  overview.xero.netProfit < 0
                    ? `-$${Math.abs(overview.xero.netProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : `$${overview.xero.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }
                icon={BarChart3}
                iconBgColor="bg-gradient-to-br from-blue-50 to-blue-100"
                iconColor="text-blue-600"
              />
              <StatsCard
                title="Average order"
                value={`$${(overview.xero.averageOrder ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={FileText}
                iconBgColor="bg-gradient-to-br from-purple-50 to-purple-100"
                iconColor="text-purple-600"
              />
            </div>
          ) : (
            <div className="rounded-2xl bg-rpp-grey-bg border border-rpp-grey-light/50 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-rpp-grey-dark">
                Connect Xero to see profit and loss for the selected period.
              </p>
              <Link href="/settings">
                <Button variant="outline" className="gap-2">
                  <Settings className="w-4 h-4" />
                  Connect Xero in Settings
                </Button>
              </Link>
            </div>
          )}
          {overview?.xero && (
            <p className="text-xs text-rpp-grey-light mt-2">
              All values from Xero Profit and Loss. Average order = Total income ÷ invoice count.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Internal metrics */}
      <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-lg font-semibold text-rpp-grey-dark">
            Internal metrics (this period)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-2">
          {overviewLoading ? (
            <div className="flex items-center gap-2 text-rpp-grey-medium py-6">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StatsCard
                title="Total editing spend"
                value={
                  overview
                    ? `$${overview.totalEditingSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : undefined
                }
                icon={FileText}
                iconBgColor="bg-gradient-to-br from-orange-50 to-orange-100"
                iconColor="text-orange-600"
              />
              <StatsCard
                title="Gross margin"
                value={
                  overview
                    ? `$${overview.grossMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : undefined
                }
                icon={TrendingUp}
                iconBgColor="bg-gradient-to-br from-blue-50 to-blue-100"
                iconColor="text-blue-600"
              />
            </div>
          )}
          {overview && (
            <p className="text-xs text-rpp-grey-light mt-2">
              Gross margin = job revenue − editing spend (before other costs).
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Jobs by invoice status */}
      <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
        <CardHeader className="p-6 pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-lg font-semibold text-rpp-grey-dark flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Jobs by invoice status
          </CardTitle>
          <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {INVOICE_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-6 pt-2">
          {overview?.invoiceStatusBreakdown && Object.keys(overview.invoiceStatusBreakdown).length > 0 && (
            <div className="flex flex-wrap gap-3 mb-6">
              {Object.entries(overview.invoiceStatusBreakdown).map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center gap-2 px-4 py-2 bg-rpp-grey-bg rounded-xl"
                >
                  <span
                    className={`w-3 h-3 rounded-full ${
                      status === "no_invoice"
                        ? "bg-amber-500"
                        : status === "paid"
                          ? "bg-green-500"
                          : status === "sent"
                            ? "bg-blue-500"
                            : status === "overdue"
                              ? "bg-red-500"
                              : "bg-gray-500"
                    }`}
                  />
                  <span className="text-sm font-medium text-rpp-grey-dark capitalize">
                    {status === "no_invoice" ? "No invoice" : status}: {count}
                  </span>
                </div>
              ))}
            </div>
          )}

          {jobsLoading ? (
            <div className="flex items-center gap-2 text-rpp-grey-medium py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading jobs...</span>
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-rpp-grey-medium py-8">No jobs match the selected filter.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-rpp-grey-light/50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-rpp-grey-bg border-b border-rpp-grey-light/50">
                    <th className="text-left py-3 px-4 font-medium text-rpp-grey-dark">Job</th>
                    <th className="text-left py-3 px-4 font-medium text-rpp-grey-dark">Customer</th>
                    <th className="text-left py-3 px-4 font-medium text-rpp-grey-dark">Address</th>
                    <th className="text-left py-3 px-4 font-medium text-rpp-grey-dark">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-rpp-grey-dark">Invoice</th>
                    <th className="text-right py-3 px-4 font-medium text-rpp-grey-dark">Revenue</th>
                    <th className="text-right py-3 px-4 font-medium text-rpp-grey-dark">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      className="border-b border-rpp-grey-light/30 hover:bg-rpp-grey-bg/50"
                    >
                      <td className="py-3 px-4">
                        <span className="font-medium text-rpp-grey-dark">
                          {job.jobName || job.jobId}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-rpp-grey-medium">{job.customerName}</td>
                      <td className="py-3 px-4 text-rpp-grey-medium max-w-[180px] truncate" title={job.address}>
                        {job.address}
                      </td>
                      <td className="py-3 px-4 capitalize text-rpp-grey-dark">{job.status}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`capitalize ${
                            job.invoiceStatus === "no_invoice"
                              ? "text-amber-600 font-medium"
                              : job.invoiceStatus === "paid"
                                ? "text-support-green"
                                : job.invoiceStatus === "overdue"
                                  ? "text-red-600"
                                  : "text-rpp-grey-medium"
                          }`}
                        >
                          {job.invoiceStatus === "no_invoice" ? "No invoice" : job.invoiceStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-rpp-grey-dark">
                        ${typeof job.revenue === "number" ? job.revenue.toFixed(2) : job.revenue}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link href={`/jobs/${job.jobId}`}>
                          <Button variant="ghost" size="sm" className="gap-1">
                            View
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalJobs > (jobsData?.jobs?.length ?? 0) && (
            <p className="text-xs text-rpp-grey-light mt-2">
              Showing {jobs.length} of {totalJobs} jobs.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
