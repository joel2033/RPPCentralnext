import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface TimelineData {
  jobsOverTime: Array<{ date: string; count: number }>;
  revenueOverTime: Array<{ date: string; revenue: number }>;
  ordersOverTime: Array<{ date: string; count: number }>;
  revisionsOverTime: Array<{ date: string; count: number }>;
  revisionRateOverTime: Array<{ date: string; rate: number }>;
}

interface JobReportsChartsProps {
  timeline?: TimelineData;
  isLoading: boolean;
}

// Format date for display
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Custom tooltip component
const CustomTooltip = ({ active, payload, label, valuePrefix = '', valueSuffix = '' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-3">
        <p className="text-xs text-rpp-grey-medium mb-1">{formatDate(label)}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.name}: {valuePrefix}{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}{valueSuffix}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function JobReportsCharts({ timeline, isLoading }: JobReportsChartsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-white border-0 rounded-3xl shadow-rpp-card">
            <CardHeader className="p-6 pb-4">
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <Skeleton className="h-[280px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Jobs Over Time Chart */}
      <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
        <CardHeader className="p-6 pb-4">
          <CardTitle className="text-lg font-semibold text-rpp-grey-dark">Jobs Created Over Time</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {timeline?.jobsOverTime && timeline.jobsOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={timeline.jobsOverTime}>
                <defs>
                  <linearGradient id="jobsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF6B4A" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#FF6B4A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#9CA3AF"
                  style={{ fontSize: '11px', fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatDate}
                />
                <YAxis
                  stroke="#9CA3AF"
                  style={{ fontSize: '11px', fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Jobs"
                  stroke="#FF6B4A"
                  strokeWidth={3}
                  fill="url(#jobsGradient)"
                  dot={{ fill: '#FF6B4A', r: 4, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 3, stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-rpp-grey-medium">
              No data available for this period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue Over Time Chart */}
      <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
        <CardHeader className="p-6 pb-4">
          <CardTitle className="text-lg font-semibold text-rpp-grey-dark">Revenue Over Time</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {timeline?.revenueOverTime && timeline.revenueOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={timeline.revenueOverTime}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#9CA3AF"
                  style={{ fontSize: '11px', fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatDate}
                />
                <YAxis
                  stroke="#9CA3AF"
                  style={{ fontSize: '11px', fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip valuePrefix="$" />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#22C55E"
                  strokeWidth={3}
                  fill="url(#revenueGradient)"
                  dot={{ fill: '#22C55E', r: 4, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 3, stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-rpp-grey-medium">
              No data available for this period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders Over Time Chart */}
      <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
        <CardHeader className="p-6 pb-4">
          <CardTitle className="text-lg font-semibold text-rpp-grey-dark">Orders & Revisions Over Time</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {timeline?.ordersOverTime && timeline.ordersOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={timeline.ordersOverTime.map((item, index) => ({
                ...item,
                revisions: timeline.revisionsOverTime?.[index]?.count || 0
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#9CA3AF"
                  style={{ fontSize: '11px', fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatDate}
                />
                <YAxis
                  stroke="#9CA3AF"
                  style={{ fontSize: '11px', fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Orders"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', r: 3, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                />
                <Line
                  type="monotone"
                  dataKey="revisions"
                  name="Revisions"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={{ fill: '#F59E0B', r: 3, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-rpp-grey-medium">
              No data available for this period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revision Rate Over Time Chart */}
      <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
        <CardHeader className="p-6 pb-4">
          <CardTitle className="text-lg font-semibold text-rpp-grey-dark">Revision Rate Trend</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {timeline?.revisionRateOverTime && timeline.revisionRateOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={timeline.revisionRateOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#9CA3AF"
                  style={{ fontSize: '11px', fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatDate}
                />
                <YAxis
                  stroke="#9CA3AF"
                  style={{ fontSize: '11px', fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}%`}
                  domain={[0, 100]}
                />
                <Tooltip content={<CustomTooltip valueSuffix="%" />} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  name="Revision Rate"
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={{ fill: '#EF4444', r: 3, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-rpp-grey-medium">
              No data available for this period
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
