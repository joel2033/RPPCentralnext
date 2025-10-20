import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { month: 'Jan', revenue: 12400 },
  { month: 'Feb', revenue: 15800 },
  { month: 'Mar', revenue: 18200 },
  { month: 'Apr', revenue: 21500 },
  { month: 'May', revenue: 19800 },
  { month: 'Jun', revenue: 24600 },
  { month: 'Jul', revenue: 28400 },
  { month: 'Aug', revenue: 26900 },
  { month: 'Sep', revenue: 31200 },
  { month: 'Oct', revenue: 29800 },
];

export function RevenueChart() {
  return (
    <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
      <CardHeader className="p-6 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-rpp-grey-dark mb-1">Revenue Overview</h2>
            <p className="text-sm text-rpp-grey-medium font-medium">Monthly performance trends</p>
          </div>
          <div className="text-right">
            <p className="text-[44px] font-bold text-rpp-grey-dark leading-none tracking-tight">$29.8k</p>
            <p className="text-xs text-rpp-grey-light font-semibold uppercase tracking-wider">This Month</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF6B4A" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#FF6B4A" stopOpacity={0} />
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
              tickFormatter={(value) => `$${value / 1000}k`}
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
              formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#FF6B4A"
              strokeWidth={3}
              fill="url(#revenueGradient)"
              dot={{ fill: '#FF6B4A', r: 4, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, strokeWidth: 3, stroke: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
