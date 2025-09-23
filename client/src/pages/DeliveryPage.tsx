import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Image, File, MapPin, Calendar, User, Building } from "lucide-react";
import { format } from "date-fns";

interface DeliveryPageData {
  job: {
    id: string;
    jobId: string;
    address: string;
    status?: string;
    appointmentDate?: string;
    customer?: {
      firstName: string;
      lastName: string;
      company?: string;
    };
  };
  completedFiles: Array<{
    orderId: string;
    orderNumber: string;
    files: Array<{
      id: string;
      fileName: string;
      originalName: string;
      fileSize: number;
      mimeType: string;
      downloadUrl: string;
      uploadedAt: string;
      notes?: string;
    }>;
  }>;
}

export default function DeliveryPage() {
  const params = useParams();
  const jobId = params.jobId;

  const { data: deliveryData, isLoading, error } = useQuery<DeliveryPageData>({
    queryKey: [`/api/delivery/${jobId}`],
    enabled: !!jobId,
  });

  const handleDownload = (url: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-gray-200 rounded w-3/4 mx-auto"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-48 bg-gray-200 rounded"></div>
              <div className="h-48 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !deliveryData) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card>
            <CardContent className="p-12 text-center">
              <h1 className="text-2xl font-bold mb-4">Delivery Not Found</h1>
              <p className="text-gray-500">The requested delivery could not be found or has been removed.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { job, completedFiles } = deliveryData;
  const totalFiles = completedFiles.reduce((acc, order) => acc + order.files.length, 0);

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4" data-testid="text-delivery-title">
            Your Completed Deliverables
          </h1>
          <p className="text-lg text-gray-600">
            Property photography and content for {job.address}
          </p>
        </div>

        {/* Job Details */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building className="h-5 w-5 mr-2" />
              Project Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium">Property Address</p>
                    <p className="text-gray-600" data-testid="text-property-address">{job.address}</p>
                  </div>
                </div>
                {job.appointmentDate && (
                  <div className="flex items-start space-x-3">
                    <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="font-medium">Shoot Date</p>
                      <p className="text-gray-600" data-testid="text-shoot-date">
                        {format(new Date(job.appointmentDate), 'PPP')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {job.customer && (
                  <div className="flex items-start space-x-3">
                    <User className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="font-medium">Contact</p>
                      <p className="text-gray-600" data-testid="text-customer-name">
                        {job.customer.firstName} {job.customer.lastName}
                      </p>
                      {job.customer.company && (
                        <p className="text-sm text-gray-500" data-testid="text-customer-company">
                          {job.customer.company}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-start space-x-3">
                  <File className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium">Deliverables</p>
                    <p className="text-gray-600" data-testid="text-files-count">
                      {totalFiles} files ready for download
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Files by Order */}
        {completedFiles.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <File className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium mb-2">No Files Available</h3>
              <p className="text-gray-500">
                Your completed files are being processed and will appear here once ready.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {completedFiles.map((order) => (
              <Card key={order.orderId}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">
                      Order #{order.orderNumber}
                    </CardTitle>
                    <Badge variant="secondary" data-testid={`badge-order-${order.orderNumber}`}>
                      {order.files.length} files
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {order.files.map((file) => (
                      <Card key={file.id} className="border border-gray-200">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              {getFileIcon(file.mimeType)}
                              <span className="text-sm font-medium truncate">
                                {file.originalName}
                              </span>
                            </div>
                          </div>
                          
                          {file.mimeType.startsWith('image/') && (
                            <div className="mb-3">
                              <img
                                src={file.downloadUrl}
                                alt={file.originalName}
                                className="w-full h-32 object-cover rounded"
                                data-testid={`img-preview-${file.id}`}
                              />
                            </div>
                          )}
                          
                          <div className="space-y-2 text-sm text-gray-500">
                            <p>Size: {formatFileSize(file.fileSize)}</p>
                            <p>Uploaded: {format(new Date(file.uploadedAt), 'MMM d, yyyy')}</p>
                            {file.notes && (
                              <p className="text-xs bg-gray-50 p-2 rounded">
                                {file.notes}
                              </p>
                            )}
                          </div>
                          
                          <Button
                            onClick={() => handleDownload(file.downloadUrl, file.originalName)}
                            className="w-full mt-3"
                            size="sm"
                            data-testid={`button-download-${file.id}`}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 py-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Files are available for download for 30 days. For questions or support, please contact your photographer.
          </p>
        </div>
      </div>
    </div>
  );
}