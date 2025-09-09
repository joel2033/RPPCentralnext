import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Download, FileImage, Folder, Archive, Calendar, Clock } from "lucide-react";

interface DownloadableFile {
  id: string;
  jobId: string;
  customerName: string;
  service: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  downloadUrl: string;
  instructions: string;
}

interface JobDownload {
  jobId: string;
  customerName: string;
  service: string;
  uploadDate: string;
  totalFiles: number;
  totalSize: number;
  files: DownloadableFile[];
  instructions: string;
}

export default function EditorDownloads() {
  const [searchTerm, setSearchTerm] = useState("");

  // Mock data for now - will be replaced with real API calls
  const { data: downloads = [], isLoading } = useQuery({
    queryKey: ['/api/editor/downloads'],
    queryFn: async () => {
      const mockDownloads: JobDownload[] = [
        {
          jobId: 'job_001',
          customerName: 'John Smith',
          service: 'Digital Edits - (Day To Dusk)',
          uploadDate: '2025-01-07',
          totalFiles: 3,
          totalSize: 75000000, // 75MB
          instructions: 'Please enhance the lighting and make the sky more dramatic. Focus on curb appeal.',
          files: [
            {
              id: 'file_001',
              jobId: 'job_001',
              customerName: 'John Smith',
              service: 'Digital Edits - (Day To Dusk)',
              fileName: 'IMG_001.RAW',
              fileType: 'raw',
              fileSize: 25000000,
              uploadDate: '2025-01-07',
              downloadUrl: '/mock/download/file1.raw',
              instructions: 'Main exterior shot - enhance lighting'
            },
            {
              id: 'file_002',
              jobId: 'job_001',
              customerName: 'John Smith',
              service: 'Digital Edits - (Day To Dusk)',
              fileName: 'IMG_002.RAW',
              fileType: 'raw',
              fileSize: 24000000,
              uploadDate: '2025-01-07',
              downloadUrl: '/mock/download/file2.raw',
              instructions: 'Back yard view - sunset effect'
            },
            {
              id: 'file_003',
              jobId: 'job_001',
              customerName: 'John Smith',
              service: 'Digital Edits - (Day To Dusk)',
              fileName: 'IMG_003.RAW',
              fileType: 'raw',
              fileSize: 26000000,
              uploadDate: '2025-01-07',
              downloadUrl: '/mock/download/file3.raw',
              instructions: 'Side angle - dramatic sky'
            }
          ]
        },
        {
          jobId: 'job_002',
          customerName: 'Sarah Johnson',
          service: 'High Resolution Photos',
          uploadDate: '2025-01-06',
          totalFiles: 2,
          totalSize: 45000000, // 45MB
          instructions: 'Standard high-res editing with color correction and basic retouching.',
          files: [
            {
              id: 'file_004',
              jobId: 'job_002',
              customerName: 'Sarah Johnson',
              service: 'High Resolution Photos',
              fileName: 'IMG_004.JPG',
              fileType: 'jpeg',
              fileSize: 22000000,
              uploadDate: '2025-01-06',
              downloadUrl: '/mock/download/file4.jpg',
              instructions: 'Living room - brighten and enhance colors'
            },
            {
              id: 'file_005',
              jobId: 'job_002',
              customerName: 'Sarah Johnson',
              service: 'High Resolution Photos',
              fileName: 'IMG_005.JPG',
              fileType: 'jpeg',
              fileSize: 23000000,
              uploadDate: '2025-01-06',
              downloadUrl: '/mock/download/file5.jpg',
              instructions: 'Kitchen - standard processing'
            }
          ]
        }
      ];
      return mockDownloads;
    }
  });

  const filteredDownloads = downloads.filter(download => {
    return download.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           download.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
           download.jobId.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownloadFile = (file: DownloadableFile) => {
    // This will trigger individual file download
    console.log('Downloading file:', file.fileName);
    // In a real app, this would create a download link or fetch the file
  };

  const handleDownloadAllFiles = (job: JobDownload) => {
    // This will trigger download of all files for a job (as ZIP)
    console.log('Downloading all files for job:', job.jobId);
    // In a real app, this would create a ZIP file and download it
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded w-64"></div>
          <div className="space-y-4">
            <div className="h-40 bg-gray-200 rounded"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
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
          <h1 className="text-2xl font-bold text-gray-900">Downloads</h1>
          <p className="text-gray-600">Access files uploaded by partners for editing</p>
        </div>
        <div className="text-sm text-gray-500">
          {downloads.length} jobs • {downloads.reduce((sum, job) => sum + job.totalFiles, 0)} files available
        </div>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <Input
          placeholder="Search by customer, job ID, or service..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
          data-testid="input-search-downloads"
        />
      </div>

      {/* Downloads List */}
      <div className="space-y-6">
        {filteredDownloads.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Folder className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
              <p className="text-gray-500">Try adjusting your search criteria or check back later for new uploads</p>
            </CardContent>
          </Card>
        ) : (
          filteredDownloads.map((job) => (
            <Card key={job.jobId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900">
                      {job.customerName} - {job.service}
                    </CardTitle>
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        Uploaded: {job.uploadDate}
                      </span>
                      <span>{job.totalFiles} files</span>
                      <span>{formatFileSize(job.totalSize)}</span>
                      <Badge variant="outline">Job ID: {job.jobId}</Badge>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleDownloadAllFiles(job)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    data-testid={`button-download-all-${job.jobId}`}
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Download All (ZIP)
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Job Instructions */}
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border">
                  <h4 className="text-sm font-medium text-blue-900 mb-1">Instructions</h4>
                  <p className="text-sm text-blue-800">{job.instructions}</p>
                </div>

                {/* Individual Files */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Individual Files</h4>
                  {job.files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-blue-100 rounded flex items-center justify-center">
                          <FileImage className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            <span>{formatFileSize(file.fileSize)}</span>
                            <span>•</span>
                            <span className="uppercase">{file.fileType}</span>
                            {file.instructions && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-xs">{file.instructions}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadFile(file)}
                        data-testid={`button-download-file-${file.id}`}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}