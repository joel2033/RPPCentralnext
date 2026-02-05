import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Loader2, Link2 } from "lucide-react";

interface RevenueChartData {
  monthlyData: Array<{ month: string; revenue: number; revenueLastYear?: number }>;
  thisMonth: number;
  connected: boolean;
  debug?: { summaryRows: Array<{ label: string; firstValue: number }> };
}

function formatCurrency(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toLocaleString()}`;
}

export function RevenueChart() {
  const debugXero = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "xero";
  const { data, isLoading } = useQuery<RevenueChartData>({
    queryKey: [debugXero ? "/api/dashboard/revenue-chart?debug=1" : "/api/dashboard/revenue-chart"],
  });

  const monthlyData = data?.monthlyData ?? [];
  const thisMonth = data?.thisMonth ?? 0;
  const connected = data?.connected ?? false;

  return (
    <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
      <CardHeader className="p-6 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-rpp-grey-dark mb-1">Revenue Overview</h2>
            <p className="text-sm text-rpp-grey-medium font-medium">
              {connected ? "Monthly performance trends from Xero" : "Connect Xero to track revenue"}
            </p>
          </div>
          <div className="text-right">
            {isLoading ? (
              <Loader2 className="w-10 h-10 animate-spin text-rpp-grey-medium" />
            ) : connected ? (
              <>
                <p className="text-[44px] font-bold text-rpp-grey-dark leading-none tracking-tight">
                  {formatCurrency(thisMonth)}
                </p>
                <p className="text-xs text-rpp-grey-light font-semibold uppercase tracking-wider">This Month</p>
              </>
            ) : (
              <a
                href="/settings#integrations"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <Link2 className="w-4 h-4" />
                Connect Xero
              </a>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-[280px]">
            <Loader2 className="w-8 h-8 animate-spin text-rpp-grey-medium" />
          </div>
        ) : !connected ? (
          <div className="flex items-center justify-center h-[280px] rounded-xl bg-gray-50 border border-dashed border-gray-200">
            <p className="text-sm text-rpp-grey-medium text-center max-w-[200px]">
              Link your Xero account in Settings → Integrations to view revenue trends from your accounting data.
            </p>
          </div>
        ) : monthlyData.length === 0 ? (
          <div className="flex items-center justify-center h-[280px] rounded-xl bg-gray-50 border border-dashed border-gray-200">
            <p className="text-sm text-rpp-grey-medium">No revenue data yet for this period.</p>
          </div>
        ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={monthlyData}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF6B4A" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#FF6B4A" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="revenueLastYearGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94A3B8" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#94A3B8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
            <XAxis 
              dataKey="month" 
              stroke="#9CA3AF"
              style={{ fontSize: '11px', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#9CA3AF"
              style={{ fontSize: '11px', fontWeight: 500 }}
              tickFormatter={(value) => value >= 1000 ? `$${value / 1000}k` : `$${value}`}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                fontSize: '12px',
                fontWeight: 600,
              }}
              formatter={(value: number, name: string) => [`$${Number(value).toLocaleString()}`, name === 'revenue' ? 'This year' : 'Last year']}
            />
            <Legend
              wrapperStyle={{ paddingTop: '8px' }}
              formatter={(value: string) => (value === 'revenue' ? 'This year' : 'Last year')}
              iconType="circle"
              iconSize={8}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              name="revenue"
              stroke="#FF6B4A"
              strokeWidth={3}
              fill="url(#revenueGradient)"
              dot={{ fill: '#FF6B4A', r: 4, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, strokeWidth: 3, stroke: '#fff' }}
            />
            <Area
              type="monotone"
              dataKey="revenueLastYear"
              name="revenueLastYear"
              stroke="#94A3B8"
              strokeWidth={2}
              strokeDasharray="5 5"
              fill="url(#revenueLastYearGradient)"
              dot={{ fill: '#94A3B8', r: 3, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
        {data?.debug?.summaryRows && data.debug.summaryRows.length > 0 && (
          <details className="mt-4 text-xs font-mono bg-gray-100 p-3 rounded-lg">
            <summary className="cursor-pointer font-semibold">Xero P&amp;L Summary Rows (debug)</summary>
            <pre className="mt-2 overflow-auto max-h-40">
              {JSON.stringify(
                data.debug.summaryRows.map((r) => ({ label: r.label, firstValue: r.firstValue })),
                null,
                2
              )}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
