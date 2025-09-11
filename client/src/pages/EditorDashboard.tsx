import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Download, Upload, FileImage, Calendar, DollarSign, Package, Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";

interface EditorJob {
  id: string;
  jobId: string;
  orderNumber: string;
  customerName: string;
  address: string;
  service: string;
  quantity: number;
  status: 'pending' | 'processing' | 'in_revision' | 'completed' | 'cancelled';
  uploadDate: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  files: Array<{
    name: string;
    type: string;
    size: number;
    url?: string;
  }>;
  instructions?: any;
}

export default function EditorDashboard() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  const { data: editorJobs = [], isLoading } = useQuery<EditorJob[]>({
    queryKey: ['/api/editor/jobs']
  });

  const pendingJobs = editorJobs.filter(job => job.status === 'pending');
  const inProgressJobs = editorJobs.filter(job => job.status === 'processing');
  const completedThisWeek = editorJobs.filter(job => job.status === 'completed').length;

  const handleDownloadFiles = async (jobId: string) => {
    try {
      console.log('Download button clicked for job:', jobId);
      
      // Show progress dialog
      setIsDownloading(true);
      setDownloadProgress(10);
      
      // Create the API request with authentication headers
      const headers: Record<string, string> = {};
      
      // Add auth header if user is authenticated
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        headers.Authorization = `Bearer ${token}`;
        setDownloadProgress(25);
      } else {
        console.error('No authenticated user found');
        setIsDownloading(false);
        return;
      }

      setDownloadProgress(40);
      
      const response = await fetch(`/api/editor/jobs/${jobId}/download`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      setDownloadProgress(70);

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'job_files.zip';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      setDownloadProgress(85);

      // Convert response to blob
      const blob = await response.blob();
      
      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setDownloadProgress(100);
      
      // Hide dialog after a short delay
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(0);
      }, 1000);
      
    } catch (error) {
      console.error('Error downloading files:', error);
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'in_revision': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
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
      {/* Download Progress Dialog */}
      <Dialog open={isDownloading} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Preparing Download
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Zipping files and preparing your download...
            </p>
            <div className="space-y-2">
              <Progress value={downloadProgress} className="w-full" />
              <p className="text-xs text-gray-500 text-center">
                {downloadProgress}% complete
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDownloadFiles(job.id)}
                      data-testid={`button-download-${job.id}`}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                    {job.status === 'processing' && (
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