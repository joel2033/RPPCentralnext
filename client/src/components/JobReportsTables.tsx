import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Users, DollarSign, RefreshCw, FileText } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface BreakdownData {
  topCustomers: Array<{ customerId: string; customerName: string; jobCount: number; totalRevenue: number }>;
  topPhotographers: Array<{ userId: string; userName: string; jobCount: number; totalRevenue: number }>;
  mostCommonRevisionReasons: Array<{ reason: string; count: number; percentage: number }>;
  mostCommonEditRequests: Array<{ request: string; count: number; percentage: number }>;
  ordersByEditor: Array<{ editorId: string; editorName: string; orderCount: number; revisionCount: number; revisionRate: number }>;
  revisionFrequencyDistribution: Array<{ revisionCount: number; orderCount: number; percentage: number }>;
}

interface JobReportsTablesProps {
  breakdowns?: BreakdownData;
  isLoading: boolean;
}

type SortDirection = 'asc' | 'desc';

const COLORS = ['#FF6B4A', '#22C55E', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#6366F1'];

export function JobReportsTables({ breakdowns, isLoading }: JobReportsTablesProps) {
  const [customerSort, setCustomerSort] = useState<{ key: 'jobCount' | 'totalRevenue'; direction: SortDirection }>({
    key: 'totalRevenue',
    direction: 'desc'
  });
  const [photographerSort, setPhotographerSort] = useState<{ key: 'jobCount' | 'totalRevenue'; direction: SortDirection }>({
    key: 'jobCount',
    direction: 'desc'
  });
  const [editorSort, setEditorSort] = useState<{ key: 'orderCount' | 'revisionRate'; direction: SortDirection }>({
    key: 'orderCount',
    direction: 'desc'
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-white border-0 rounded-3xl shadow-rpp-card">
            <CardHeader className="p-6 pb-4">
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <Skeleton className="h-[200px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Sort functions
  const sortedCustomers = breakdowns?.topCustomers ? [...breakdowns.topCustomers].sort((a, b) => {
    const multiplier = customerSort.direction === 'asc' ? 1 : -1;
    return (a[customerSort.key] - b[customerSort.key]) * multiplier;
  }) : [];

  const sortedPhotographers = breakdowns?.topPhotographers ? [...breakdowns.topPhotographers].sort((a, b) => {
    const multiplier = photographerSort.direction === 'asc' ? 1 : -1;
    return (a[photographerSort.key] - b[photographerSort.key]) * multiplier;
  }) : [];

  const sortedEditors = breakdowns?.ordersByEditor ? [...breakdowns.ordersByEditor].sort((a, b) => {
    const multiplier = editorSort.direction === 'asc' ? 1 : -1;
    return (a[editorSort.key] - b[editorSort.key]) * multiplier;
  }) : [];

  const SortButton = ({ active, direction, onClick }: { active: boolean; direction: SortDirection; onClick: () => void }) => (
    <button onClick={onClick} className="ml-1 inline-flex flex-col">
      <ChevronUp className={`w-3 h-3 -mb-1 ${active && direction === 'asc' ? 'text-rpp-red-main' : 'text-gray-300'}`} />
      <ChevronDown className={`w-3 h-3 ${active && direction === 'desc' ? 'text-rpp-red-main' : 'text-gray-300'}`} />
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers Table */}
        <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-rpp-red-main" />
              <CardTitle className="text-lg font-semibold text-rpp-grey-dark">Top Customers</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {sortedCustomers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-2 text-sm font-semibold text-rpp-grey-medium">Customer</th>
                      <th className="text-right py-3 px-2 text-sm font-semibold text-rpp-grey-medium cursor-pointer"
                        onClick={() => setCustomerSort({
                          key: 'jobCount',
                          direction: customerSort.key === 'jobCount' && customerSort.direction === 'desc' ? 'asc' : 'desc'
                        })}>
                        Jobs
                        <SortButton active={customerSort.key === 'jobCount'} direction={customerSort.direction} onClick={() => {}} />
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-semibold text-rpp-grey-medium cursor-pointer"
                        onClick={() => setCustomerSort({
                          key: 'totalRevenue',
                          direction: customerSort.key === 'totalRevenue' && customerSort.direction === 'desc' ? 'asc' : 'desc'
                        })}>
                        Revenue
                        <SortButton active={customerSort.key === 'totalRevenue'} direction={customerSort.direction} onClick={() => {}} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCustomers.slice(0, 10).map((customer, index) => (
                      <tr key={customer.customerId} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 px-2 text-sm font-medium text-rpp-grey-dark">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-rpp-red-lighter text-rpp-red-main flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </span>
                            {customer.customerName}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-sm text-right text-rpp-grey-dark">{customer.jobCount}</td>
                        <td className="py-3 px-2 text-sm text-right font-medium text-support-green">
                          ${customer.totalRevenue.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-rpp-grey-medium">
                No customer data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Photographers Table */}
        <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg font-semibold text-rpp-grey-dark">Top Photographers</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {sortedPhotographers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-2 text-sm font-semibold text-rpp-grey-medium">Photographer</th>
                      <th className="text-right py-3 px-2 text-sm font-semibold text-rpp-grey-medium cursor-pointer"
                        onClick={() => setPhotographerSort({
                          key: 'jobCount',
                          direction: photographerSort.key === 'jobCount' && photographerSort.direction === 'desc' ? 'asc' : 'desc'
                        })}>
                        Jobs
                        <SortButton active={photographerSort.key === 'jobCount'} direction={photographerSort.direction} onClick={() => {}} />
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-semibold text-rpp-grey-medium cursor-pointer"
                        onClick={() => setPhotographerSort({
                          key: 'totalRevenue',
                          direction: photographerSort.key === 'totalRevenue' && photographerSort.direction === 'desc' ? 'asc' : 'desc'
                        })}>
                        Revenue
                        <SortButton active={photographerSort.key === 'totalRevenue'} direction={photographerSort.direction} onClick={() => {}} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPhotographers.slice(0, 10).map((photographer, index) => (
                      <tr key={photographer.userId} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 px-2 text-sm font-medium text-rpp-grey-dark">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </span>
                            {photographer.userName}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-sm text-right text-rpp-grey-dark">{photographer.jobCount}</td>
                        <td className="py-3 px-2 text-sm text-right font-medium text-support-green">
                          ${photographer.totalRevenue.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-rpp-grey-medium">
                No photographer data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Common Revision Reasons */}
        <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-orange-500" />
              <CardTitle className="text-lg font-semibold text-rpp-grey-dark">Most Common Revision Reasons</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {breakdowns?.mostCommonRevisionReasons && breakdowns.mostCommonRevisionReasons.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={breakdowns.mostCommonRevisionReasons.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" horizontal={false} />
                    <XAxis type="number" stroke="#9CA3AF" style={{ fontSize: '11px' }} tickLine={false} axisLine={false} />
                    <YAxis 
                      type="category" 
                      dataKey="reason" 
                      stroke="#9CA3AF" 
                      style={{ fontSize: '11px' }} 
                      tickLine={false} 
                      axisLine={false}
                      width={100}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value} (${props.payload.percentage.toFixed(1)}%)`,
                        'Count'
                      ]}
                    />
                    <Bar dataKey="count" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-xs text-rpp-grey-light text-center">
                  Top revision reasons help identify areas for editor improvement
                </p>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-rpp-grey-medium">
                No revision data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Most Common Edit Requests */}
        <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-500" />
              <CardTitle className="text-lg font-semibold text-rpp-grey-dark">Most Common Edit Requests</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {breakdowns?.mostCommonEditRequests && breakdowns.mostCommonEditRequests.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={breakdowns.mostCommonEditRequests.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" horizontal={false} />
                    <XAxis type="number" stroke="#9CA3AF" style={{ fontSize: '11px' }} tickLine={false} axisLine={false} />
                    <YAxis 
                      type="category" 
                      dataKey="request" 
                      stroke="#9CA3AF" 
                      style={{ fontSize: '11px' }} 
                      tickLine={false} 
                      axisLine={false}
                      width={100}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value} (${props.payload.percentage.toFixed(1)}%)`,
                        'Count'
                      ]}
                    />
                    <Bar dataKey="count" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-xs text-rpp-grey-light text-center">
                  Common edit requests indicate what services are most in demand
                </p>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-rpp-grey-medium">
                No edit request data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by Editor */}
        <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600" />
              <CardTitle className="text-lg font-semibold text-rpp-grey-dark">Orders by Editor</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {sortedEditors.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-2 text-sm font-semibold text-rpp-grey-medium">Editor</th>
                      <th className="text-right py-3 px-2 text-sm font-semibold text-rpp-grey-medium cursor-pointer"
                        onClick={() => setEditorSort({
                          key: 'orderCount',
                          direction: editorSort.key === 'orderCount' && editorSort.direction === 'desc' ? 'asc' : 'desc'
                        })}>
                        Orders
                        <SortButton active={editorSort.key === 'orderCount'} direction={editorSort.direction} onClick={() => {}} />
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-semibold text-rpp-grey-medium">Revisions</th>
                      <th className="text-right py-3 px-2 text-sm font-semibold text-rpp-grey-medium cursor-pointer"
                        onClick={() => setEditorSort({
                          key: 'revisionRate',
                          direction: editorSort.key === 'revisionRate' && editorSort.direction === 'desc' ? 'asc' : 'desc'
                        })}>
                        Rev. Rate
                        <SortButton active={editorSort.key === 'revisionRate'} direction={editorSort.direction} onClick={() => {}} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEditors.slice(0, 10).map((editor) => (
                      <tr key={editor.editorId} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 px-2 text-sm font-medium text-rpp-grey-dark">{editor.editorName}</td>
                        <td className="py-3 px-2 text-sm text-right text-rpp-grey-dark">{editor.orderCount}</td>
                        <td className="py-3 px-2 text-sm text-right text-rpp-grey-dark">{editor.revisionCount}</td>
                        <td className="py-3 px-2 text-sm text-right">
                          <span className={`font-medium ${
                            editor.revisionRate > 30 ? 'text-red-600' : 
                            editor.revisionRate > 15 ? 'text-yellow-600' : 
                            'text-green-600'
                          }`}>
                            {editor.revisionRate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-rpp-grey-medium">
                No editor data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revision Frequency Distribution */}
        <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-red-500" />
              <CardTitle className="text-lg font-semibold text-rpp-grey-dark">Revision Frequency Distribution</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {breakdowns?.revisionFrequencyDistribution && breakdowns.revisionFrequencyDistribution.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={breakdowns.revisionFrequencyDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="orderCount"
                      label={({ percentage }) => `${percentage.toFixed(0)}%`}
                      labelLine={false}
                    >
                      {breakdowns.revisionFrequencyDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value} orders (${props.payload.percentage.toFixed(1)}%)`,
                        `${props.payload.revisionCount} revisions`
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {breakdowns.revisionFrequencyDistribution.map((item, index) => (
                    <div key={item.revisionCount} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm text-rpp-grey-dark">
                          {item.revisionCount === 0 ? 'No revisions' : 
                           item.revisionCount === 1 ? '1 revision' : 
                           `${item.revisionCount}+ revisions`}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-rpp-grey-dark">
                        {item.orderCount} ({item.percentage.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-rpp-grey-medium">
                No revision frequency data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
