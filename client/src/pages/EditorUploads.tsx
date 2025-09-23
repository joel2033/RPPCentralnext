import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, FileImage, X, Plus, Check, Clock, AlertCircle } from "lucide-react";
import { uploadCompletedFileToFirebase, UploadProgress } from "@/lib/firebase-storage";
import { auth } from "@/lib/firebase";

interface CompletedJob {
  id: string;
  jobId: string;
  customerName: string;
  service: string;
  originalFiles: number;
  deliverables: number;
  status: 'ready_to_upload' | 'uploading' | 'completed' | 'delivered';
  completedDate: string;
  dueDate: string;
}

interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
}

export default function EditorUploads() {
  const [selectedJob, setSelectedJob] = useState<string>("");
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [uploadNotes, setUploadNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Get real jobs ready for upload from the API
  const { data: completedJobs = [], isLoading } = useQuery({
    queryKey: ['/api/editor/jobs-ready-for-upload'],
    // Default fetcher will be used - it automatically handles authentication
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const newUploadFiles: UploadFile[] = files.map((file, index) => ({
      id: `upload_${Date.now()}_${index}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
      status: 'pending'
    }));
    
    setUploadFiles(prev => [...prev, ...newUploadFiles]);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    const newUploadFiles: UploadFile[] = files.map((file, index) => ({
      id: `upload_${Date.now()}_${index}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
      status: 'pending'
    }));
    
    setUploadFiles(prev => [...prev, ...newUploadFiles]);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const removeFile = (fileId: string) => {
    setUploadFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <FileImage className="w-5 h-5 text-blue-600" />;
    }
    return <FileImage className="w-5 h-5 text-gray-600" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-gray-500" />;
      case 'uploading': return <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
      case 'completed': return <Check className="w-4 h-4 text-green-600" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const performActualUpload = async (uploadFile: UploadFile, jobId: string) => {
    const updateProgress = (progress: number) => {
      setUploadFiles(prev => prev.map(file => 
        file.id === uploadFile.id 
          ? { ...file, progress, status: progress === 100 ? 'completed' : 'uploading' }
          : file
      ));
    };

    const updateStatus = (status: 'pending' | 'uploading' | 'completed' | 'error') => {
      setUploadFiles(prev => prev.map(file => 
        file.id === uploadFile.id ? { ...file, status } : file
      ));
    };

    try {
      updateStatus('uploading');
      
      // Get current user for authentication check
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      console.log(`Starting upload for ${uploadFile.file.name} to job ${jobId}...`);
      
      // Upload file - server will auto-detect appropriate order
      const result = await uploadCompletedFileToFirebase(
        uploadFile.file,
        jobId,
        undefined, // No orderNumber - let server auto-detect
        (progress: UploadProgress) => updateProgress(progress.progress)
      );
      
      console.log(`Upload completed for ${uploadFile.file.name}:`, result);
      updateStatus('completed');
      
      return result;
    } catch (error) {
      console.error(`Upload failed for ${uploadFile.file.name}:`, error);
      updateStatus('error');
      throw error;
    }
  };

  const handleStartUpload = async () => {
    if (!selectedJob || uploadFiles.length === 0) return;

    const selectedJobData = completedJobs.find(job => job.id === selectedJob);
    if (!selectedJobData) {
      console.error('Selected job not found');
      return;
    }
    
    console.log('[DEBUG] Selected job data:', {
      selectedJob,
      selectedJobData: {
        id: selectedJobData.id,
        jobId: selectedJobData.jobId,
        customerName: selectedJobData.customerName
      }
    });

    setIsUploading(true);
    
    try {
      // Upload all files sequentially to avoid overwhelming the server
      for (const file of uploadFiles) {
        console.log(`[DEBUG] Uploading file ${file.file.name} for job UUID: ${selectedJobData.id}`);
        await performActualUpload(file, selectedJobData.id); // Use job.id (UUID) instead of job.jobId (display string)
      }
      
      console.log('All uploads completed for job:', selectedJobData.id);
      
      // Reset form after successful upload
      setTimeout(() => {
        setUploadFiles([]);
        setUploadNotes("");
        setSelectedJob("");
        setIsUploading(false);
      }, 1500);
      
    } catch (error) {
      console.error('Upload failed:', error);
      setIsUploading(false);
    }
  };

  const selectedJobData = completedJobs.find(job => job.id === selectedJob);
  const allFilesCompleted = uploadFiles.every(file => file.status === 'completed');
  const hasFiles = uploadFiles.length > 0;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Completed Work</h1>
        <p className="text-gray-600">Submit your finished editing work back to the job owner</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Job</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedJob} onValueChange={setSelectedJob}>
                <SelectTrigger data-testid="select-job">
                  <SelectValue placeholder="Choose a completed job to upload results..." />
                </SelectTrigger>
                <SelectContent>
                  {completedJobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.customerName} - {job.services?.[0]?.name || 'Unknown Service'} (Job {job.jobId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedJobData && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-blue-900">Customer:</span>
                      <p className="text-blue-800">{selectedJobData.customerName}</p>
                    </div>
                    <div>
                      <span className="font-medium text-blue-900">Service:</span>
                      <p className="text-blue-800">{selectedJobData.services?.[0]?.name || 'Unknown Service'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-blue-900">Original Files:</span>
                      <p className="text-blue-800">{selectedJobData.originalFiles?.length || 0}</p>
                    </div>
                    <div>
                      <span className="font-medium text-blue-900">Expected Deliverables:</span>
                      <p className="text-blue-800">{selectedJobData.services?.[0]?.quantity || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Upload Files</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors"
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium mb-2">
                  Drag and drop your edited files here, or click to browse
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Supported formats: JPG, PNG, TIFF, PSD (Max 200MB per file)
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/*,.psd"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload-editor"
                  disabled={isUploading}
                />
                <label htmlFor="file-upload-editor">
                  <Button variant="outline" disabled={isUploading}>
                    Choose Files
                  </Button>
                </label>
              </div>

              {/* Upload Files List */}
              {hasFiles && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-3">
                    Files to Upload ({uploadFiles.length})
                  </h4>
                  <div className="space-y-3">
                    {uploadFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          {getFileIcon(file.type)}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{file.name}</p>
                            <div className="flex items-center space-x-2 text-xs text-gray-500">
                              <span>{formatFileSize(file.size)}</span>
                              <span>•</span>
                              <span className="flex items-center space-x-1">
                                {getStatusIcon(file.status)}
                                <span className="capitalize">{file.status.replace('_', ' ')}</span>
                              </span>
                              {file.status === 'uploading' && (
                                <>
                                  <span>•</span>
                                  <span>{file.progress}%</span>
                                </>
                              )}
                            </div>
                            {file.status === 'uploading' && (
                              <Progress value={file.progress} className="mt-2 h-1" />
                            )}
                          </div>
                        </div>
                        {!isUploading && (
                          <button
                            onClick={() => removeFile(file.id)}
                            className="text-gray-400 hover:text-red-500"
                            data-testid={`button-remove-${file.id}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upload Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Upload Notes (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add any notes about the completed work, special considerations, or additional information for the client..."
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                className="min-h-[100px]"
                disabled={isUploading}
                data-testid="textarea-upload-notes"
              />
            </CardContent>
          </Card>
        </div>

        {/* Upload Summary Sidebar */}
        <div>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Upload Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Selected Job:</span>
                  <span className="text-gray-900">
                    {selectedJobData ? selectedJobData.jobId : 'None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Files to Upload:</span>
                  <span className="text-gray-900">{uploadFiles.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Size:</span>
                  <span className="text-gray-900">
                    {formatFileSize(uploadFiles.reduce((sum, file) => sum + file.size, 0))}
                  </span>
                </div>
                {isUploading && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Progress:</span>
                    <span className="text-gray-900">
                      {uploadFiles.filter(f => f.status === 'completed').length} / {uploadFiles.length}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-4 space-y-3">
                {!allFilesCompleted ? (
                  <Button
                    onClick={handleStartUpload}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    disabled={!selectedJob || !hasFiles || isUploading}
                    data-testid="button-start-upload"
                  >
                    {isUploading ? 'Uploading...' : 'Start Upload'}
                  </Button>
                ) : (
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Check className="w-6 h-6 text-green-600" />
                    </div>
                    <p className="text-sm font-medium text-green-600">Upload Complete!</p>
                    <p className="text-xs text-gray-500 mt-1">Files have been delivered to the client</p>
                  </div>
                )}
              </div>

              <div className="pt-4 text-xs text-gray-500">
                <p>
                  Files will be delivered directly to the job owner and added to their project gallery.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}