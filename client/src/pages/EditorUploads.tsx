import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileImage, X, Check, Clock, AlertCircle, FolderOpen } from "lucide-react";
import { uploadCompletedFileToFirebase, UploadProgress } from "@/lib/firebase-storage";
import { auth } from "@/lib/firebase";

interface CompletedJob {
  id: string;
  jobId: string;
  orderNumber: string;
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
  const [useFolder, setUseFolder] = useState(false);
  const [folderName, setFolderName] = useState("");

  const { data: completedJobs = [], isLoading } = useQuery<CompletedJob[]>({
    queryKey: ['/api/editor/jobs-ready-for-upload'],
  });

  const sortedJobs = [...completedJobs].sort((a, b) => {
    const dateA = new Date(a.completedDate || a.dueDate || 0).getTime();
    const dateB = new Date(b.completedDate || b.dueDate || 0).getTime();
    return dateB - dateA;
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
      return <FileImage className="w-5 h-5 text-rpp-orange" />;
    }
    return <FileImage className="w-5 h-5 text-rpp-grey" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-rpp-grey-light" />;
      case 'uploading': return <div className="w-4 h-4 border-2 border-rpp-orange border-t-transparent rounded-full animate-spin" />;
      case 'completed': return <Check className="w-4 h-4 text-semantic-green" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-semantic-red" />;
      default: return <Clock className="w-4 h-4 text-rpp-grey-light" />;
    }
  };

  const performActualUpload = async (uploadFile: UploadFile, jobId: string, orderNumber?: string) => {
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

      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const result = await uploadCompletedFileToFirebase(
        uploadFile.file,
        jobId,
        orderNumber,
        (progress: UploadProgress) => updateProgress(progress.progress),
        useFolder && folderName ? {
          folderPath: folderName,
          editorFolderName: folderName
        } : undefined
      );

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

    const selectedJobData = sortedJobs.find(job => job.id === selectedJob);
    if (!selectedJobData) {
      console.error('Selected job not found');
      return;
    }

    if (!useFolder || !folderName.trim()) {
      console.error('Folder path and name are required for completed file uploads');
      return;
    }

    setIsUploading(true);

    try {
      for (const file of uploadFiles) {
        await performActualUpload(file, selectedJobData.jobId, selectedJobData.orderNumber);
      }
      
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

  const selectedJobData = sortedJobs.find(job => job.id === selectedJob);
  const allFilesCompleted = uploadFiles.every(file => file.status === 'completed');
  const hasFiles = uploadFiles.length > 0;

  if (isLoading) {
    return (
      <div className="p-6 bg-rpp-grey-pale min-h-screen">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-rpp-grey-lighter rounded-xl w-1/3"></div>
          <div className="h-48 bg-rpp-grey-lighter rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-rpp-grey-pale min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-rpp-grey-darkest">Upload Completed Work</h1>
        <p className="text-rpp-grey">Submit your finished editing work back to the job owner</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Selection */}
          <Card className="card-hover border border-rpp-grey-lighter rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-rpp-grey-darkest">Select Job</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedJob} onValueChange={setSelectedJob}>
                <SelectTrigger className="rounded-xl border-rpp-grey-lighter focus:border-rpp-orange" data-testid="select-job">
                  <SelectValue placeholder="Choose a completed job to upload results..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {sortedJobs.map((job) => (
                    <SelectItem key={job.id} value={job.id} className="rounded-lg">
                      {job.customerName} - {job.services?.[0]?.name || 'Unknown Service'} (Job {job.jobId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedJobData && (
                <div className="mt-4 p-4 bg-rpp-orange-subtle rounded-xl border border-rpp-orange/20">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-rpp-orange">Customer:</span>
                      <p className="text-rpp-grey-darkest">{selectedJobData.customerName}</p>
                    </div>
                    <div>
                      <span className="font-medium text-rpp-orange">Service:</span>
                      <p className="text-rpp-grey-darkest">{selectedJobData.services?.[0]?.name || 'Unknown Service'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-rpp-orange">Original Files:</span>
                      <p className="text-rpp-grey-darkest">{selectedJobData.originalFiles?.length || 0}</p>
                    </div>
                    <div>
                      <span className="font-medium text-rpp-orange">Expected Deliverables:</span>
                      <p className="text-rpp-grey-darkest">{selectedJobData.services?.[0]?.quantity || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Folder Options */}
          <Card className="card-hover border border-rpp-grey-lighter rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-rpp-grey-darkest flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-rpp-orange" />
                Organization Options
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="use-folder-uploads"
                    checked={useFolder}
                    onCheckedChange={(checked) => setUseFolder(checked as boolean)}
                    className="border-rpp-grey-lighter data-[state=checked]:bg-rpp-orange data-[state=checked]:border-rpp-orange"
                    data-testid="checkbox-use-folder-uploads"
                  />
                  <label htmlFor="use-folder-uploads" className="text-sm font-medium text-rpp-grey-darkest">
                    Organize files in a folder
                  </label>
                </div>
                
                {useFolder && (
                  <div className="space-y-2 pl-7">
                    <label htmlFor="folder-name-uploads" className="text-sm font-medium text-rpp-grey-darkest">
                      Folder Name
                    </label>
                    <Input
                      id="folder-name-uploads"
                      placeholder="Enter folder name (e.g., 'High Resolution', 'Web Ready')"
                      value={folderName}
                      onChange={(e) => setFolderName(e.target.value)}
                      className="text-sm rounded-xl border-rpp-grey-lighter focus:border-rpp-orange"
                      data-testid="input-folder-name-uploads"
                    />
                    <p className="text-xs text-rpp-grey">
                      Files will be organized in this folder for easier client browsing
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card className="card-hover border border-rpp-grey-lighter rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-rpp-grey-darkest">Upload Files</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-rpp-grey-lighter rounded-xl p-8 text-center hover:border-rpp-orange transition-colors bg-rpp-grey-lightest/50"
              >
                <div className="w-16 h-16 bg-rpp-orange-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-rpp-orange" />
                </div>
                <p className="text-rpp-grey-darkest font-medium mb-2">
                  Drag and drop your edited files here, or click to browse
                </p>
                <p className="text-sm text-rpp-grey mb-4">
                  Supported formats: JPG, PNG, TIFF, PSD, MP4, MOV (Max 500MB per file)
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/*,.psd,video/mp4,video/quicktime,.mp4,.mov,.MOV"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload-editor"
                  disabled={isUploading}
                />
                <label htmlFor="file-upload-editor">
                  <Button 
                    variant="outline" 
                    disabled={isUploading}
                    className="rounded-xl border-rpp-grey-lighter hover:border-rpp-orange hover:text-rpp-orange"
                  >
                    Choose Files
                  </Button>
                </label>
              </div>

              {/* Upload Files List */}
              {hasFiles && (
                <div className="mt-6">
                  <h4 className="font-medium text-rpp-grey-darkest mb-3">
                    Files to Upload ({uploadFiles.length})
                  </h4>
                  <div className="space-y-3">
                    {uploadFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 border border-rpp-grey-lighter rounded-xl bg-white"
                      >
                        <div className="flex items-center space-x-3">
                          {getFileIcon(file.type)}
                          <div>
                            <p className="text-sm font-medium text-rpp-grey-darkest">{file.name}</p>
                            <div className="flex items-center space-x-2 text-xs text-rpp-grey">
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
                              <div className="mt-2 w-full">
                                <Progress value={file.progress} className="h-1" />
                              </div>
                            )}
                          </div>
                        </div>
                        {!isUploading && (
                          <button
                            onClick={() => removeFile(file.id)}
                            className="text-rpp-grey-light hover:text-semantic-red transition-colors"
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
          <Card className="card-hover border border-rpp-grey-lighter rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-rpp-grey-darkest">Upload Notes (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add any notes about the completed work, special considerations, or additional information for the client..."
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                className="min-h-[100px] rounded-xl border-rpp-grey-lighter focus:border-rpp-orange"
                disabled={isUploading}
                data-testid="textarea-upload-notes"
              />
            </CardContent>
          </Card>
        </div>

        {/* Upload Summary Sidebar */}
        <div>
          <Card className="sticky top-24 border border-rpp-grey-lighter rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-rpp-grey-darkest">Upload Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-rpp-grey">Selected Job:</span>
                  <span className="text-rpp-grey-darkest font-medium">
                    {selectedJobData ? selectedJobData.jobId : 'None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rpp-grey">Files to Upload:</span>
                  <span className="text-rpp-grey-darkest font-medium">{uploadFiles.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rpp-grey">Total Size:</span>
                  <span className="text-rpp-grey-darkest font-medium">
                    {formatFileSize(uploadFiles.reduce((sum, file) => sum + file.size, 0))}
                  </span>
                </div>
                {isUploading && (
                  <div className="flex justify-between">
                    <span className="text-rpp-grey">Progress:</span>
                    <span className="text-rpp-grey-darkest font-medium">
                      {uploadFiles.filter(f => f.status === 'completed').length} / {uploadFiles.length}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-4 space-y-3">
                {!allFilesCompleted ? (
                  <Button
                    onClick={handleStartUpload}
                    className="w-full btn-primary-gradient rounded-xl"
                    disabled={!selectedJob || !hasFiles || isUploading || !useFolder || !folderName.trim()}
                    data-testid="button-start-upload"
                  >
                    {isUploading ? 'Uploading...' : 'Start Upload'}
                  </Button>
                ) : (
                  <div className="text-center py-4">
                    <div className="w-14 h-14 bg-semantic-green-light rounded-full flex items-center justify-center mx-auto mb-3">
                      <Check className="w-7 h-7 text-semantic-green" />
                    </div>
                    <p className="text-sm font-semibold text-semantic-green">Upload Complete!</p>
                    <p className="text-xs text-rpp-grey mt-1">Files have been delivered to the client</p>
                  </div>
                )}
              </div>

              <div className="pt-4 text-xs text-rpp-grey">
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
