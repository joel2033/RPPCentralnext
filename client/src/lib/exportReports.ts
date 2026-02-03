import { format } from "date-fns";

// Types for export data
interface JobReportStats {
  totalJobs: number;
  totalRevenue: number;
  averageJobValue: number;
  jobsByStatus: Record<string, number>;
  invoiceStatusBreakdown: Record<string, number>;
  completionRate: number;
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  averageRevisionsPerOrder: number;
  revisionRate: number;
  ordersRequiringRevisions: number;
  ordersCompletedWithoutRevisions: number;
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

interface ReportFilters {
  dateRange: string;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
  customerId: string;
  photographerId: string;
  invoiceStatus: string;
  orderStatus: string;
}

interface ExportCSVParams {
  stats: JobReportStats;
  breakdowns: BreakdownData;
  filters: ReportFilters;
  fileName: string;
}

interface ExportPDFParams {
  stats: JobReportStats;
  breakdowns: BreakdownData;
  performance: PerformanceData;
  filters: ReportFilters;
  fileName: string;
}

// Helper to escape CSV values
const escapeCSV = (value: string | number | undefined): string => {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// Generate CSV content
const generateCSVContent = (stats: JobReportStats, breakdowns: BreakdownData, filters: ReportFilters): string => {
  const lines: string[] = [];
  const now = new Date();
  
  // Header
  lines.push('Job Reports Export');
  lines.push(`Generated: ${format(now, 'PPpp')}`);
  lines.push(`Date Range: ${filters.dateRange}`);
  if (filters.startDate) lines.push(`Start Date: ${format(filters.startDate, 'PPP')}`);
  if (filters.endDate) lines.push(`End Date: ${format(filters.endDate, 'PPP')}`);
  lines.push('');
  
  // Overview Statistics
  lines.push('=== OVERVIEW STATISTICS ===');
  lines.push('');
  
  // Job Metrics
  lines.push('Job Metrics');
  lines.push(`Total Jobs,${stats.totalJobs}`);
  lines.push(`Total Revenue,$${stats.totalRevenue.toLocaleString()}`);
  lines.push(`Average Job Value,$${stats.averageJobValue.toFixed(2)}`);
  lines.push(`Completion Rate,${stats.completionRate.toFixed(1)}%`);
  lines.push('');
  
  // Jobs by Status
  lines.push('Jobs by Status');
  Object.entries(stats.jobsByStatus).forEach(([status, count]) => {
    lines.push(`${status},${count}`);
  });
  lines.push('');
  
  // Invoice Status
  lines.push('Invoice Status');
  Object.entries(stats.invoiceStatusBreakdown).forEach(([status, count]) => {
    lines.push(`${status},${count}`);
  });
  lines.push('');
  
  // Order Metrics
  lines.push('Order Metrics');
  lines.push(`Total Orders,${stats.totalOrders}`);
  lines.push(`Average Revisions per Order,${stats.averageRevisionsPerOrder.toFixed(2)}`);
  lines.push(`Revision Rate,${stats.revisionRate.toFixed(1)}%`);
  lines.push(`Orders Requiring Revisions,${stats.ordersRequiringRevisions}`);
  lines.push(`Orders Completed Without Revisions,${stats.ordersCompletedWithoutRevisions}`);
  lines.push('');
  
  // Orders by Status
  lines.push('Orders by Status');
  Object.entries(stats.ordersByStatus).forEach(([status, count]) => {
    lines.push(`${status},${count}`);
  });
  lines.push('');
  
  // Top Customers
  lines.push('=== TOP CUSTOMERS ===');
  lines.push('Customer Name,Job Count,Total Revenue');
  breakdowns.topCustomers.forEach(customer => {
    lines.push(`${escapeCSV(customer.customerName)},${customer.jobCount},$${customer.totalRevenue.toLocaleString()}`);
  });
  lines.push('');
  
  // Top Photographers
  lines.push('=== TOP PHOTOGRAPHERS ===');
  lines.push('Photographer Name,Job Count,Total Revenue');
  breakdowns.topPhotographers.forEach(photographer => {
    lines.push(`${escapeCSV(photographer.userName)},${photographer.jobCount},$${photographer.totalRevenue.toLocaleString()}`);
  });
  lines.push('');
  
  // Most Common Revision Reasons
  lines.push('=== MOST COMMON REVISION REASONS ===');
  lines.push('Reason,Count,Percentage');
  breakdowns.mostCommonRevisionReasons.forEach(reason => {
    lines.push(`${escapeCSV(reason.reason)},${reason.count},${reason.percentage.toFixed(1)}%`);
  });
  lines.push('');
  
  // Most Common Edit Requests
  lines.push('=== MOST COMMON EDIT REQUESTS ===');
  lines.push('Request,Count,Percentage');
  breakdowns.mostCommonEditRequests.forEach(request => {
    lines.push(`${escapeCSV(request.request)},${request.count},${request.percentage.toFixed(1)}%`);
  });
  lines.push('');
  
  // Orders by Editor
  lines.push('=== ORDERS BY EDITOR ===');
  lines.push('Editor Name,Order Count,Revision Count,Revision Rate');
  breakdowns.ordersByEditor.forEach(editor => {
    lines.push(`${escapeCSV(editor.editorName)},${editor.orderCount},${editor.revisionCount},${editor.revisionRate.toFixed(1)}%`);
  });
  lines.push('');
  
  // Revision Frequency Distribution
  lines.push('=== REVISION FREQUENCY DISTRIBUTION ===');
  lines.push('Revision Count,Order Count,Percentage');
  breakdowns.revisionFrequencyDistribution.forEach(item => {
    lines.push(`${item.revisionCount},${item.orderCount},${item.percentage.toFixed(1)}%`);
  });
  
  return lines.join('\n');
};

// Export to CSV
export const exportToCSV = ({ stats, breakdowns, filters, fileName }: ExportCSVParams): void => {
  const csvContent = generateCSVContent(stats, breakdowns, filters);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
};

// Export to PDF (simplified - creates a printable HTML that opens in new window)
export const exportToPDF = ({ stats, breakdowns, performance, filters, fileName }: ExportPDFParams): void => {
  const now = new Date();
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Job Reports - ${format(now, 'PPP')}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      padding: 40px;
      max-width: 1000px;
      margin: 0 auto;
      color: #333;
      line-height: 1.6;
    }
    h1 {
      color: #FF6B4A;
      border-bottom: 2px solid #FF6B4A;
      padding-bottom: 10px;
    }
    h2 {
      color: #333;
      margin-top: 30px;
      border-bottom: 1px solid #eee;
      padding-bottom: 8px;
    }
    h3 {
      color: #666;
      margin-top: 20px;
    }
    .meta {
      color: #666;
      font-size: 14px;
      margin-bottom: 30px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin: 20px 0;
    }
    .stat-card {
      background: #f9f9f9;
      padding: 16px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #333;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    th {
      background: #f5f5f5;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      color: #666;
    }
    .number {
      text-align: right;
    }
    .status-pill {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }
    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #FF6B4A;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
    }
    .print-button:hover {
      background: #e55a3a;
    }
    @media print {
      .print-button { display: none; }
      body { padding: 20px; }
    }
  </style>
</head>
<body>
  <button class="print-button" onclick="window.print()">Print / Save PDF</button>
  
  <h1>Job Reports</h1>
  <div class="meta">
    <p>Generated: ${format(now, 'PPpp')}</p>
    <p>Date Range: ${filters.dateRange}${filters.startDate ? ` (${format(filters.startDate, 'PPP')}` : ''}${filters.endDate ? ` - ${format(filters.endDate, 'PPP')})` : ')'}</p>
    ${filters.status !== 'all' ? `<p>Job Status Filter: ${filters.status}</p>` : ''}
    ${filters.orderStatus !== 'all' ? `<p>Order Status Filter: ${filters.orderStatus}</p>` : ''}
  </div>

  <h2>Overview Statistics</h2>
  
  <h3>Job Metrics</h3>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">${stats.totalJobs}</div>
      <div class="stat-label">Total Jobs</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">$${stats.totalRevenue.toLocaleString()}</div>
      <div class="stat-label">Total Revenue</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">$${stats.averageJobValue.toFixed(0)}</div>
      <div class="stat-label">Avg Job Value</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.completionRate.toFixed(1)}%</div>
      <div class="stat-label">Completion Rate</div>
    </div>
  </div>
  
  <h3>Order Metrics</h3>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">${stats.totalOrders}</div>
      <div class="stat-label">Total Orders</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.revisionRate.toFixed(1)}%</div>
      <div class="stat-label">Revision Rate</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.averageRevisionsPerOrder.toFixed(2)}</div>
      <div class="stat-label">Avg Revisions/Order</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.ordersCompletedWithoutRevisions}</div>
      <div class="stat-label">First-Try Success</div>
    </div>
  </div>

  <h3>Performance Metrics</h3>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">${performance.averageTurnaroundTime.toFixed(1)} days</div>
      <div class="stat-label">Avg Turnaround</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${performance.onTimeDeliveryRate.toFixed(1)}%</div>
      <div class="stat-label">On-Time Rate</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">$${performance.revenuePerCustomer.toFixed(0)}</div>
      <div class="stat-label">Revenue/Customer</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${performance.ordersCompletedOnFirstTryRate.toFixed(1)}%</div>
      <div class="stat-label">First-Try Rate</div>
    </div>
  </div>

  <h2>Top Customers</h2>
  <table>
    <thead>
      <tr>
        <th>Customer</th>
        <th class="number">Jobs</th>
        <th class="number">Revenue</th>
      </tr>
    </thead>
    <tbody>
      ${breakdowns.topCustomers.slice(0, 10).map(c => `
        <tr>
          <td>${c.customerName}</td>
          <td class="number">${c.jobCount}</td>
          <td class="number">$${c.totalRevenue.toLocaleString()}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>Top Photographers</h2>
  <table>
    <thead>
      <tr>
        <th>Photographer</th>
        <th class="number">Jobs</th>
        <th class="number">Revenue</th>
      </tr>
    </thead>
    <tbody>
      ${breakdowns.topPhotographers.slice(0, 10).map(p => `
        <tr>
          <td>${p.userName}</td>
          <td class="number">${p.jobCount}</td>
          <td class="number">$${p.totalRevenue.toLocaleString()}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${breakdowns.mostCommonRevisionReasons.length > 0 ? `
  <h2>Most Common Revision Reasons</h2>
  <table>
    <thead>
      <tr>
        <th>Reason</th>
        <th class="number">Count</th>
        <th class="number">Percentage</th>
      </tr>
    </thead>
    <tbody>
      ${breakdowns.mostCommonRevisionReasons.slice(0, 10).map(r => `
        <tr>
          <td>${r.reason}</td>
          <td class="number">${r.count}</td>
          <td class="number">${r.percentage.toFixed(1)}%</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  ${breakdowns.mostCommonEditRequests.length > 0 ? `
  <h2>Most Common Edit Requests</h2>
  <table>
    <thead>
      <tr>
        <th>Request</th>
        <th class="number">Count</th>
        <th class="number">Percentage</th>
      </tr>
    </thead>
    <tbody>
      ${breakdowns.mostCommonEditRequests.slice(0, 10).map(e => `
        <tr>
          <td>${e.request}</td>
          <td class="number">${e.count}</td>
          <td class="number">${e.percentage.toFixed(1)}%</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  ${breakdowns.ordersByEditor.length > 0 ? `
  <h2>Orders by Editor</h2>
  <table>
    <thead>
      <tr>
        <th>Editor</th>
        <th class="number">Orders</th>
        <th class="number">Revisions</th>
        <th class="number">Revision Rate</th>
      </tr>
    </thead>
    <tbody>
      ${breakdowns.ordersByEditor.slice(0, 10).map(e => `
        <tr>
          <td>${e.editorName}</td>
          <td class="number">${e.orderCount}</td>
          <td class="number">${e.revisionCount}</td>
          <td class="number">${e.revisionRate.toFixed(1)}%</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  ${performance.editorPerformance.length > 0 ? `
  <h2>Editor Performance</h2>
  <table>
    <thead>
      <tr>
        <th>Editor</th>
        <th class="number">Orders Completed</th>
        <th class="number">Revision Rate</th>
        <th class="number">Avg Processing Time</th>
      </tr>
    </thead>
    <tbody>
      ${performance.editorPerformance.slice(0, 10).map(e => `
        <tr>
          <td>${e.editorName}</td>
          <td class="number">${e.ordersCompleted}</td>
          <td class="number">${e.revisionRate.toFixed(1)}%</td>
          <td class="number">${e.averageProcessingTime.toFixed(1)} days</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

</body>
</html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
};
