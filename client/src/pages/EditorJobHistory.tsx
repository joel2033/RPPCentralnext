import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Loader2, Download, FileText, Calendar, DollarSign, FileImage, Clock, Building2, User, MapPin, ChevronDown, ChevronRight } from "lucide-react";
import { auth } from "@/lib/firebase";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEditorAuth } from "@/contexts/EditorAuthContext";
import { useAuth } from "@/contexts/AuthContext";

interface JobHistoryItem {
  orderId: string;
  orderNumber: string;
  completionDate: string;
  customerName: string;
  customerEmail: string;
  partnerBusinessName: string;
  jobAddress: string;
  services: Array<{
    id: string;
    name: string;
    quantity: number;
    cost: number;
    totalCost: number;
    instructions: string | null;
    exportTypes: string | null;
  }>;
  totalCost: number;
  originalFileCount: number;
  deliveredFileCount: number;
  totalFileCount: number;
  notes: string;
  timeSpent: number | null;
  dateAccepted: string | null;
  createdAt: string | null;
}

export default function EditorJobHistory() {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [partnerFilter, setPartnerFilter] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const { userData: editorData } = useEditorAuth();
  const { userData: partnerData } = useAuth();
  const { toast } = useToast();

  // Determine if user is editor or partner/admin
  const isEditor = editorData?.role === "editor";
  const isPartner = partnerData?.role === "partner" || partnerData?.role === "admin";

  // Build query key with date filters
  const queryKey = [
    '/api/editor/jobs/history',
    startDate || null,
    endDate || null
  ];

  const { data: history = [], isLoading } = useQuery<JobHistoryItem[]>({
    queryKey,
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const url = `/api/editor/jobs/history${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch job history');
      }
      
      return response.json();
    },
  });

  // Unique partners from history for filter options
  const partnerOptions = useMemo(() => {
    const names = Array.from(new Set((history || []).map(h => h.partnerBusinessName).filter(Boolean)));
    return names.sort((a, b) => a.localeCompare(b));
  }, [history]);

  // Apply partner filter client-side
  const filteredHistory = useMemo(() => {
    if (partnerFilter === "all") return history;
    return (history || []).filter(h => h.partnerBusinessName === partnerFilter);
  }, [history, partnerFilter]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalJobs = history.length;
    const totalRevenue = history.reduce((sum, item) => sum + item.totalCost, 0);
    const totalFiles = history.reduce((sum, item) => sum + item.totalFileCount, 0);
    const totalTimeSpent = history.reduce((sum, item) => sum + (item.timeSpent || 0), 0);
    
    return {
      totalJobs,
      totalRevenue,
      totalFiles,
      totalTimeSpent,
      avgRevenuePerJob: totalJobs > 0 ? totalRevenue / totalJobs : 0,
    };
  }, [history]);

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Toggle expand state for a given orderId
  const toggleRow = (orderId: string) => {
    setExpandedRows(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  // Basic HTML stripper for notes rendering
  const stripHtml = (html: string): string => {
    return html
      .replace(/<br\s*\/?>(\n)?/gi, '\n')
      .replace(/<\/(p|div)>/gi, '\n')
      .replace(/<li>/gi, '  • ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  };

  const renderEditingNotes = (item: JobHistoryItem) => {
    return (
      <div className="space-y-3">
        {item.services.map((service) => {
          const instructions = service.instructions as unknown as any;
          const exportTypes = service.exportTypes as unknown as any;

          let instructionsBlock: JSX.Element | null = null;
          if (!instructions) {
            instructionsBlock = null;
          } else if (typeof instructions === 'string') {
            instructionsBlock = (
              <pre className="whitespace-pre-wrap text-xs text-gray-700">{stripHtml(instructions)}</pre>
            );
          } else if (Array.isArray(instructions)) {
            instructionsBlock = (
              <div className="space-y-2">
                {instructions.map((inst: any, idx: number) => (
                  <div key={idx} className="text-xs text-gray-700">
                    {inst.fileName && <div className="font-medium">File: {inst.fileName}</div>}
                    {inst.detail && <pre className="whitespace-pre-wrap">{stripHtml(String(inst.detail))}</pre>}
                  </div>
                ))}
              </div>
            );
          } else {
            instructionsBlock = (
              <pre className="whitespace-pre-wrap text-xs text-gray-700">{stripHtml(JSON.stringify(instructions))}</pre>
            );
          }

          let exportBlock: JSX.Element | null = null;
          if (exportTypes) {
            if (typeof exportTypes === 'string') {
              exportBlock = (
                <div className="text-xs text-gray-600">
                  <span className="font-medium">Export Types:</span> {stripHtml(exportTypes)}
                </div>
              );
            } else if (Array.isArray(exportTypes)) {
              exportBlock = (
                <div className="text-xs text-gray-600">
                  <div className="font-medium">Export Types:</div>
                  <ul className="list-disc ml-4">
                    {exportTypes.map((exp: any, idx: number) => (
                      <li key={idx}>{[exp.type, exp.description].filter(Boolean).join(': ')}</li>
                    ))}
                  </ul>
                </div>
              );
            }
          }

          return (
            <div key={service.id} className="border rounded-md p-2 bg-gray-50">
              <div className="text-xs font-semibold text-gray-900">{service.name} <span className="text-gray-500">(x{service.quantity})</span></div>
              {instructionsBlock}
              {exportBlock}
            </div>
          );
        })}
      </div>
    );
  };

  // Format time for display
  const formatTime = (hours: number | null) => {
    if (hours === null) return 'N/A';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${hours.toFixed(1)}h`;
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredHistory.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no completed jobs in the selected date range.",
        variant: "destructive",
      });
      return;
    }

    // Create CSV headers
    const headers = [
      'Order Number',
      'Completion Date',
      'Customer Name',
      'Customer Email',
      'Partner/Business Name',
      'Job Address',
      'Services',
      'Total Cost',
      'Original Files',
      'Delivered Files',
      'Total Files',
      'Time Spent (hours)',
      'Notes'
    ];

    // Create CSV rows
    const rows = filteredHistory.map(item => {
      const servicesList = item.services.map(s => `${s.name} (x${s.quantity})`).join('; ');
      return [
        item.orderNumber,
        formatDate(item.completionDate),
        item.customerName,
        item.customerEmail,
        item.partnerBusinessName,
        item.jobAddress,
        servicesList,
        item.totalCost.toFixed(2),
        item.originalFileCount.toString(),
        item.deliveredFileCount.toString(),
        item.totalFileCount.toString(),
        item.timeSpent ? item.timeSpent.toFixed(1) : 'N/A',
        item.notes.replace(/\n/g, ' ').replace(/,/g, ';') // Replace commas and newlines
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `job-history-${startDate || 'all'}-${endDate || 'all'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: "CSV file has been downloaded.",
    });
  };

  // Export to PDF
  const handleExportPDF = async () => {
    if (history.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no completed jobs in the selected date range.",
        variant: "destructive",
      });
      return;
    }

    // Dynamically import jsPDF
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    // Page settings
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;

    // Header
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(isEditor ? 'Job History Report' : 'Billing History Report', margin, yPosition);
    yPosition += 10;

    // Date range
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const dateRangeText = startDate && endDate 
      ? `Date Range: ${formatDate(startDate)} - ${formatDate(endDate)}`
      : startDate 
        ? `From: ${formatDate(startDate)}`
        : endDate 
          ? `Until: ${formatDate(endDate)}`
          : 'All Time';
    doc.text(dateRangeText, margin, yPosition);
    yPosition += 5;

    // Generated date
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, margin, yPosition);
    yPosition += 10;

    // Summary section
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Summary', margin, yPosition);
    yPosition += 7;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Total Jobs: ${summary.totalJobs}`, margin, yPosition);
    yPosition += 5;
    doc.text(`Total Revenue: $${summary.totalRevenue.toFixed(2)}`, margin, yPosition);
    yPosition += 5;
    doc.text(`Average per Job: $${summary.avgRevenuePerJob.toFixed(2)}`, margin, yPosition);
    yPosition += 5;
    doc.text(`Total Files: ${summary.totalFiles}`, margin, yPosition);
    yPosition += 5;
    if (summary.totalTimeSpent > 0) {
      doc.text(`Total Time Spent: ${summary.totalTimeSpent.toFixed(1)} hours`, margin, yPosition);
      yPosition += 5;
    }
    yPosition += 5;

    // Table headers
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    const tableHeaders = ['Order', 'Date', 'Customer', 'Services', 'Cost', 'Files'];
    const colWidths = [30, 30, 40, 40, 25, 20];
    let xPosition = margin;
    
    tableHeaders.forEach((header, index) => {
      doc.text(header, xPosition, yPosition);
      xPosition += colWidths[index];
    });
    yPosition += 7;

    // Draw line under headers
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
    yPosition += 3;

    // Table rows
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    
    filteredHistory.forEach((item, index) => {
      // Check if we need a new page
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = margin;
      }

      // Truncate text if too long
      const truncate = (text: string, maxLength: number) => {
        return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
      };

      const servicesText = item.services.map(s => `${s.name} (x${s.quantity})`).join(', ');
      
      const rowData = [
        truncate(item.orderNumber, 15),
        formatDate(item.completionDate),
        truncate(item.customerName, 20),
        truncate(servicesText, 30),
        `$${item.totalCost.toFixed(2)}`,
        item.totalFileCount.toString()
      ];

      xPosition = margin;
      rowData.forEach((cell, cellIndex) => {
        doc.text(cell, xPosition, yPosition);
        xPosition += colWidths[cellIndex];
      });

      yPosition += 7;
    });

    // Save PDF
    const fileName = `job-history-${startDate || 'all'}-${endDate || 'all'}.pdf`;
    doc.save(fileName);

    toast({
      title: "Export Successful",
      description: "PDF report has been downloaded.",
    });
  };

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setPartnerFilter("all");
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditor ? 'Job History' : 'Billing History'}
          </h1>
          <p className="text-gray-600">
            {isEditor 
              ? 'View your completed job history and billing information'
              : 'View completed jobs and generate billing reports'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={isLoading || history.length === 0}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={handleExportPDF}
            disabled={isLoading || history.length === 0}
            data-testid="button-export-pdf"
          >
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Jobs</p>
                <p className="text-2xl font-bold text-gray-900">{summary.totalJobs}</p>
              </div>
              <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">${summary.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Files</p>
                <p className="text-2xl font-bold text-gray-900">{summary.totalFiles}</p>
              </div>
              <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <FileImage className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        {summary.totalTimeSpent > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Time</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.totalTimeSpent.toFixed(1)}h</p>
                </div>
                <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                id="start-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                minDate={startDate}
                id="end-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partner-filter">Partner</Label>
              <select
                id="partner-filter"
                value={partnerFilter}
                onChange={(e) => setPartnerFilter(e.target.value)}
                className="w-full h-9 border border-gray-200 rounded-md px-3 text-sm"
                data-testid="select-partner-filter"
              >
                <option value="all">All</option>
                {partnerOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="w-full"
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Completed Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-2">No completed jobs found</p>
              <p className="text-sm text-gray-500">
                {startDate || endDate 
                  ? 'Try adjusting your date filters'
                  : 'Completed jobs will appear here once they are finished'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold text-sm text-gray-700">Order #</th>
                    <th className="text-left p-3 font-semibold text-sm text-gray-700">Date</th>
                    <th className="text-left p-3 font-semibold text-sm text-gray-700">Partner</th>
                    <th className="text-left p-3 font-semibold text-sm text-gray-700">Address</th>
                    <th className="text-left p-3 font-semibold text-sm text-gray-700">Services</th>
                    <th className="text-right p-3 font-semibold text-sm text-gray-700">Cost</th>
                    <th className="text-center p-3 font-semibold text-sm text-gray-700">Files</th>
                    <th className="text-center p-3 font-semibold text-sm text-gray-700">Time</th>
                    <th className="text-left p-3 font-semibold text-sm text-gray-700">Editing Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item) => (
                    <tr key={item.orderId} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-sm font-medium text-gray-900">{item.orderNumber}</td>
                      <td className="p-3 text-sm text-gray-600">{formatDate(item.completionDate)}</td>
                      <td className="p-3 text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{item.partnerBusinessName || item.customerName}</div>
                            {item.customerEmail && (
                              <div className="text-xs text-gray-500">{item.customerEmail}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span className="max-w-xs truncate">{item.jobAddress}</span>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        <div className="space-y-1">
                          {item.services.map((service) => (
                            <div key={service.id} className="text-xs">
                              {service.name} <span className="text-gray-500">(x{service.quantity})</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-sm font-semibold text-right text-gray-900">
                        ${item.totalCost.toFixed(2)}
                      </td>
                      <td className="p-3 text-sm text-center text-gray-600">
                        <div className="flex items-center justify-center gap-1">
                          <FileImage className="h-4 w-4 text-gray-400" />
                          <span>{item.totalFileCount}</span>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-center text-gray-600">
                        {item.timeSpent ? formatTime(item.timeSpent) : '-'}
                      </td>
                      <td className="p-3 text-sm text-gray-600 align-top">
                        <button
                          type="button"
                          onClick={() => toggleRow(item.orderId)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
                          data-testid={`toggle-notes-${item.orderId}`}
                        >
                          {expandedRows[item.orderId] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {expandedRows[item.orderId] ? 'Hide Editing Notes' : 'View Editing Notes'}
                        </button>
                        {expandedRows[item.orderId] && (
                          <div className="mt-2 max-h-64 overflow-auto pr-1">
                            {renderEditingNotes(item)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

