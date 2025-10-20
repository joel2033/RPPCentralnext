import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

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
    <Card className="border-border/50 shadow-lg shadow-black/5 rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Revenue Overview</CardTitle>
            <CardDescription className="text-xs">Monthly performance trends</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xl">$29.8k</p>
            <p className="text-xs text-muted-foreground">This Month</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F05A2A" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F05A2A" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E9EA" vertical={false} />
            <XAxis 
              dataKey="month" 
              stroke="#82878C"
              style={{ fontSize: '12px' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#82878C"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => `$${value / 1000}k`}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #E8E9EA',
                borderRadius: '12px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#F05A2A"
              strokeWidth={3}
              fill="url(#revenueGradient)"
              dot={{ fill: '#F05A2A', r: 4, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
