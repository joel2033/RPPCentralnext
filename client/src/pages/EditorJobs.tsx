import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload, FileImage, Calendar, Clock, MapPin } from "lucide-react";

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
  priority: 'low' | 'medium' | 'high';
  files: Array<{
    name: string;
    type: string;
    size: number;
    url?: string;
  }>;
  instructions: string;
}

export default function EditorJobs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Mock data for now - will be replaced with real API calls
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['/api/editor/jobs'],
    queryFn: async () => {
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
          priority: 'high',
          instructions: 'Please enhance the lighting and make the sky more dramatic. Focus on curb appeal.',
          files: [
            { name: 'IMG_001.RAW', type: 'raw', size: 25000000, url: '/mock/file1.raw' },
            { name: 'IMG_002.RAW', type: 'raw', size: 24500000, url: '/mock/file2.raw' }
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
          priority: 'medium',
          instructions: 'Standard high-res editing with color correction and basic retouching.',
          files: [
            { name: 'IMG_003.JPG', type: 'jpeg', size: 15000000, url: '/mock/file3.jpg' }
          ]
        },
        {
          id: '3',
          jobId: 'job_003',
          customerName: 'Mike Wilson',
          address: '789 Pine Dr, Village, State',
          service: 'Virtual Staging',
          quantity: 8,
          status: 'completed',
          uploadDate: '2025-01-05',
          dueDate: '2025-01-08',
          priority: 'low',
          instructions: 'Add modern furniture to empty rooms. Keep it minimal and contemporary.',
          files: [
            { name: 'ROOM_01.JPG', type: 'jpeg', size: 18000000, url: '/mock/file4.jpg' },
            { name: 'ROOM_02.JPG', type: 'jpeg', size: 16000000, url: '/mock/file5.jpg' }
          ]
        }
      ];
      return mockJobs;
    }
  });

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.service.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || job.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'delivered': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-orange-100 text-orange-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStartJob = (jobId: string) => {
    // This will update the job status to in_progress
    console.log('Starting job:', jobId);
  };

  const handleCompleteJob = (jobId: string) => {
    // This will update the job status to completed
    console.log('Completing job:', jobId);
  };

  const handleDownloadFiles = (jobId: string) => {
    // This will trigger file download
    console.log('Downloading files for job:', jobId);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="flex space-x-4">
            <div className="h-10 bg-gray-200 rounded w-64"></div>
            <div className="h-10 bg-gray-200 rounded w-32"></div>
            <div className="h-10 bg-gray-200 rounded w-32"></div>
          </div>
          <div className="space-y-4">
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
          <h1 className="text-2xl font-bold text-gray-900">Job Queue</h1>
          <p className="text-gray-600">Manage your editing projects and workflow</p>
        </div>
        <div className="text-sm text-gray-500">
          {filteredJobs.length} jobs • {filteredJobs.filter(j => j.status === 'pending').length} pending
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search by customer, address, or service..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
          data-testid="input-search-jobs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-priority-filter">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {filteredJobs.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileImage className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
              <p className="text-gray-500">Try adjusting your search or filter criteria</p>
            </CardContent>
          </Card>
        ) : (
          filteredJobs.map((job) => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileImage className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{job.customerName}</h3>
                        <Badge className={getStatusColor(job.status)}>
                          {job.status.replace('_', ' ')}
                        </Badge>
                        <Badge className={getPriorityColor(job.priority)}>
                          {job.priority} priority
                        </Badge>
                      </div>
                      <div className="flex items-center text-sm text-gray-600 mb-2">
                        <MapPin className="w-4 h-4 mr-1" />
                        {job.address}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          Due: {job.dueDate}
                        </span>
                        <span>{job.service}</span>
                        <span>{job.files.length} files • {job.quantity} final images</span>
                      </div>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                        <strong>Instructions:</strong> {job.instructions}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col space-y-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadFiles(job.id)}
                      data-testid={`button-download-${job.id}`}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Files
                    </Button>
                    {job.status === 'pending' && (
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => handleStartJob(job.id)}
                        data-testid={`button-start-${job.id}`}
                      >
                        Start Job
                      </Button>
                    )}
                    {job.status === 'in_progress' && (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleCompleteJob(job.id)}
                        data-testid={`button-complete-${job.id}`}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Results
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}