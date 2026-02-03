import { useState } from "react";
import { format, subDays, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths } from "date-fns";
import { Calendar as CalendarIcon, Filter, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export interface ReportFilters {
  dateRange: string;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
  customerId: string;
  photographerId: string;
  invoiceStatus: string;
  orderStatus: string;
}

interface JobReportsFiltersProps {
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
  customers: Array<{ id: string; firstName: string; lastName: string; company?: string }>;
  users: Array<{ id: string; firstName: string; lastName: string; role: string }>;
}

const dateRangePresets = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'all_time', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
];

const jobStatuses = [
  { value: 'all', label: 'All Statuses' },
  { value: 'booked', label: 'Booked' },
  { value: 'pending', label: 'Pending' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const invoiceStatuses = [
  { value: 'all', label: 'All Invoice Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];

const orderStatuses = [
  { value: 'all', label: 'All Order Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'in_revision', label: 'In Revision' },
  { value: 'human_check', label: 'Human Check' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function JobReportsFilters({ filters, onFiltersChange, customers, users }: JobReportsFiltersProps) {
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);

  // Get date range based on preset
  const getDateRange = (preset: string): { start: Date | null; end: Date | null } => {
    const now = new Date();
    switch (preset) {
      case 'today':
        return { start: new Date(now.setHours(0, 0, 0, 0)), end: new Date() };
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return { 
          start: new Date(yesterday.setHours(0, 0, 0, 0)), 
          end: new Date(yesterday.setHours(23, 59, 59, 999)) 
        };
      case 'last_7_days':
        return { start: subDays(now, 7), end: now };
      case 'last_30_days':
        return { start: subDays(now, 30), end: now };
      case 'this_month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'this_quarter':
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case 'this_year':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'all_time':
        return { start: null, end: null };
      default:
        return { start: null, end: null };
    }
  };

  const handleDateRangeChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomDateOpen(true);
      onFiltersChange({ ...filters, dateRange: value });
    } else {
      const { start, end } = getDateRange(value);
      onFiltersChange({ ...filters, dateRange: value, startDate: start, endDate: end });
    }
  };

  const handleCustomDateChange = (type: 'start' | 'end', date: Date | undefined) => {
    if (type === 'start') {
      onFiltersChange({ ...filters, startDate: date || null });
    } else {
      onFiltersChange({ ...filters, endDate: date || null });
    }
  };

  const clearFilters = () => {
    onFiltersChange({
      dateRange: 'this_month',
      startDate: startOfMonth(new Date()),
      endDate: endOfMonth(new Date()),
      status: 'all',
      customerId: 'all',
      photographerId: 'all',
      invoiceStatus: 'all',
      orderStatus: 'all',
    });
  };

  const hasActiveFilters = 
    filters.status !== 'all' || 
    filters.customerId !== 'all' || 
    filters.photographerId !== 'all' || 
    filters.invoiceStatus !== 'all' ||
    filters.orderStatus !== 'all';

  // Filter users to only show photographers
  const photographers = users.filter(u => u.role === 'photographer' || u.role === 'partner' || u.role === 'admin');

  return (
    <Card className="bg-white border-0 rounded-3xl shadow-rpp-card">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-rpp-grey-medium" />
          <h3 className="text-lg font-semibold text-rpp-grey-dark">Filters</h3>
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters}
              className="ml-auto text-rpp-grey-medium hover:text-rpp-grey-dark"
            >
              <X className="w-4 h-4 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {/* Date Range */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-rpp-grey-medium uppercase tracking-wider">Date Range</label>
            <Select value={filters.dateRange} onValueChange={handleDateRangeChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                {dateRangePresets.map(preset => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Range - Start */}
          {filters.dateRange === 'custom' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-rpp-grey-medium uppercase tracking-wider">Start Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.startDate ? format(filters.startDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.startDate || undefined}
                      onSelect={(date) => handleCustomDateChange('start', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-rpp-grey-medium uppercase tracking-wider">End Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.endDate ? format(filters.endDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.endDate || undefined}
                      onSelect={(date) => handleCustomDateChange('end', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}

          {/* Job Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-rpp-grey-medium uppercase tracking-wider">Job Status</label>
            <Select 
              value={filters.status} 
              onValueChange={(value) => onFiltersChange({ ...filters, status: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {jobStatuses.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Order Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-rpp-grey-medium uppercase tracking-wider">Order Status</label>
            <Select 
              value={filters.orderStatus} 
              onValueChange={(value) => onFiltersChange({ ...filters, orderStatus: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Order Status" />
              </SelectTrigger>
              <SelectContent>
                {orderStatuses.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-rpp-grey-medium uppercase tracking-wider">Customer</label>
            <Select 
              value={filters.customerId} 
              onValueChange={(value) => onFiltersChange({ ...filters, customerId: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customers.map(customer => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.firstName} {customer.lastName}
                    {customer.company && ` (${customer.company})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Photographer */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-rpp-grey-medium uppercase tracking-wider">Photographer</label>
            <Select 
              value={filters.photographerId} 
              onValueChange={(value) => onFiltersChange({ ...filters, photographerId: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Team Members</SelectItem>
                {photographers.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Invoice Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-rpp-grey-medium uppercase tracking-wider">Invoice Status</label>
            <Select 
              value={filters.invoiceStatus} 
              onValueChange={(value) => onFiltersChange({ ...filters, invoiceStatus: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Invoice Status" />
              </SelectTrigger>
              <SelectContent>
                {invoiceStatuses.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Display active date range */}
        {filters.dateRange !== 'custom' && filters.dateRange !== 'all_time' && (
          <div className="mt-4 text-sm text-rpp-grey-medium">
            Showing data from{' '}
            <span className="font-medium text-rpp-grey-dark">
              {filters.startDate ? format(filters.startDate, 'MMM d, yyyy') : 'beginning'}
            </span>
            {' to '}
            <span className="font-medium text-rpp-grey-dark">
              {filters.endDate ? format(filters.endDate, 'MMM d, yyyy') : 'now'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
