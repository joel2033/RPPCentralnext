import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, FileImage, Calendar, DollarSign, Package } from "lucide-react";

interface EditorJob {
  id: string;
  jobId: string;
  customerName: string;
  address: string;
  service: string;
  quantity: number;
  status: 'pending' | 'in_progress' | 'completed' | 'delivered';
  uploadDate: string;
  dueDate: string;
  files: Array<{
    name: string;
    type: string;
    size: number;
  }>;
}

export default function EditorDashboard() {
  // Mock data for now - will be replaced with real API calls
  const mockJobs: EditorJob[] = [
    {
      id: '1',
      jobId: 'job_001',
      customerName: 'John Smith',
      address: '123 Main St, City, State',
      service: 'Digital Edits - (Day To Dusk)',
      quantity: 25,
      status: 'pending',
      uploadDate: '2025-01-07',
      dueDate: '2025-01-10',
      files: [
        { name: 'IMG_001.RAW', type: 'raw', size: 25000000 },
        { name: 'IMG_002.RAW', type: 'raw', size: 24500000 }
      ]
    },
    {
      id: '2',
      jobId: 'job_002',
      customerName: 'Sarah Johnson',
      address: '456 Oak Ave, Town, State',
      service: 'High Resolution Photos',
      quantity: 15,
      status: 'in_progress',
      uploadDate: '2025-01-06',
      dueDate: '2025-01-09',
      files: [
        { name: 'IMG_003.JPG', type: 'jpeg', size: 15000000 }
      ]
    }
  ];
  
  const editorJobs = mockJobs;
  const isLoading = false;

  const pendingJobs = editorJobs.filter(job => job.status === 'pending');
  const inProgressJobs = editorJobs.filter(job => job.status === 'in_progress');
  const completedThisWeek = editorJobs.filter(job => job.status === 'completed').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'delivered': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editor Dashboard</h1>
          <p className="text-gray-600">Manage your editing projects and deliverables</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
          <Package className="w-4 h-4 mr-2" />
          My Products
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Jobs</p>
                <p className="text-2xl font-bold text-gray-900">{pendingJobs.length}</p>
              </div>
              <div className="h-8 w-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Download className="h-4 w-4 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-gray-900">{inProgressJobs.length}</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileImage className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed This Week</p>
                <p className="text-2xl font-bold text-gray-900">{completedThisWeek}</p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Upload className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Earnings This Month</p>
                <p className="text-2xl font-bold text-gray-900">$1,245</p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Recent Jobs</span>
            <Button variant="outline" size="sm">
              View All Jobs
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {editorJobs.slice(0, 5).map((job) => (
              <div key={job.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileImage className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{job.customerName}</h4>
                    <p className="text-sm text-gray-600">{job.address}</p>
                    <p className="text-xs text-gray-500">{job.service} • {job.quantity} files</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <Badge className={getStatusColor(job.status)}>
                      {job.status.replace('_', ' ')}
                    </Badge>
                    <p className="text-xs text-gray-500 mt-1">Due: {job.dueDate}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline">
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                    {job.status === 'in_progress' && (
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Upload className="w-4 h-4 mr-1" />
                        Upload
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}