import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MapPin, User, Calendar, DollarSign, Activity, Upload, Image, FileText, Video, Eye, Building } from "lucide-react";
import { format } from "date-fns";

interface JobCardData {
  id: string;
  jobId: string;
  partnerId: string;
  address: string;
  customerId?: string;
  totalValue?: string;
  status?: string;
  assignedTo?: string;
  appointmentDate?: string;
  dueDate?: string;
  propertyImage?: string;
  notes?: string;
  createdAt: string;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    company?: string;
    category?: string;
    profileImage?: string;
  };
}

export default function JobCard() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const jobId = params.jobId;

  const { data: jobData, isLoading, error } = useQuery<JobCardData>({
    queryKey: ['/api/jobs/card', jobId],
    enabled: !!jobId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-48 bg-gray-200 rounded"></div>
            </div>
            <div className="space-y-6">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !jobData) {
    return (
      <div className="container mx-auto p-6">
        <Button 
          variant="outline" 
          onClick={() => setLocation('/jobs')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Jobs
        </Button>
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-500">Job not found or failed to load.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            onClick={() => setLocation('/jobs')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Job Details</h1>
            <p className="text-sm text-gray-500">Job ID: {jobData.jobId}</p>
          </div>
        </div>
        <Badge className={getStatusColor(jobData.status)}>
          {jobData.status || 'scheduled'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Map Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                Property Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-100 h-64 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-600">{jobData.address}</p>
                  <p className="text-sm text-gray-500 mt-2">Map integration coming soon</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Manage Content Tabs */}
          <Card>
            <CardHeader>
              <CardTitle>Manage Content</CardTitle>
              <p className="text-sm text-gray-600">Upload and manage property content for this job</p>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="photos" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="photos">Photos</TabsTrigger>
                  <TabsTrigger value="floorplans">Floor Plans</TabsTrigger>
                  <TabsTrigger value="videos">Videos</TabsTrigger>
                  <TabsTrigger value="tours">Virtual Tours</TabsTrigger>
                  <TabsTrigger value="other">Other Files</TabsTrigger>
                </TabsList>
                
                <TabsContent value="photos" className="mt-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <Image className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Upload Photos</h3>
                    <p className="text-gray-500 mb-4">Drag and drop photos here, or click to select files</p>
                    <Button>
                      <Upload className="h-4 w-4 mr-2" />
                      Select Photos
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="floorplans" className="mt-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Upload Floor Plans</h3>
                    <p className="text-gray-500 mb-4">Add floor plan images or PDFs</p>
                    <Button>
                      <Upload className="h-4 w-4 mr-2" />
                      Select Files
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="videos" className="mt-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <Video className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Upload Videos</h3>
                    <p className="text-gray-500 mb-4">Add property walkthrough videos</p>
                    <Button>
                      <Upload className="h-4 w-4 mr-2" />
                      Select Videos
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="tours" className="mt-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <Eye className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Virtual Tours</h3>
                    <p className="text-gray-500 mb-4">Upload or link virtual tour content</p>
                    <Button>
                      <Upload className="h-4 w-4 mr-2" />
                      Add Tour
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="other" className="mt-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Other Files</h3>
                    <p className="text-gray-500 mb-4">Upload additional documents or files</p>
                    <Button>
                      <Upload className="h-4 w-4 mr-2" />
                      Select Files
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent>
              {jobData.customer ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{jobData.customer.firstName} {jobData.customer.lastName}</p>
                      <p className="text-sm text-gray-500">{jobData.customer.email}</p>
                    </div>
                  </div>
                  {jobData.customer.company && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Building className="h-4 w-4" />
                      <span>{jobData.customer.company}</span>
                    </div>
                  )}
                  {jobData.customer.phone && (
                    <p className="text-sm text-gray-600">{jobData.customer.phone}</p>
                  )}
                  <Button variant="outline" size="sm" className="w-full">
                    View Profile
                  </Button>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No customer assigned</p>
              )}
            </CardContent>
          </Card>

          {/* Appointments Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Appointments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {jobData.appointmentDate && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Scheduled Shoot</span>
                      <Badge variant="outline">Upcoming</Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {format(new Date(jobData.appointmentDate), 'MMM dd, yyyy')}
                    </p>
                    <p className="text-sm text-gray-600">
                      {format(new Date(jobData.appointmentDate), 'h:mm a')}
                    </p>
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Appointment
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Billing Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Billing Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Value</span>
                  <span className="font-medium">${jobData.totalValue || '0.00'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <Badge variant="outline">Draft</Badge>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  View Invoice
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Activity Log */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-l-2 border-green-200 pl-4 py-2">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium">Job Created</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {format(new Date(jobData.createdAt), 'MMM dd, yyyy h:mm a')}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Job ID: {jobData.jobId}
                  </p>
                </div>
                {jobData.appointmentDate && (
                  <div className="border-l-2 border-blue-200 pl-4 py-2">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm font-medium">Appointment Scheduled</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {format(new Date(jobData.appointmentDate), 'MMM dd, yyyy h:mm a')}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}