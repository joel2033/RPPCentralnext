import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload as UploadIcon, FileImage, X, Plus, Minus } from "lucide-react";

export default function Upload() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [orderDetails, setOrderDetails] = useState({
    jobId: "",
    supplier: "",
    service: "",
    quantity: "",
    instructions: [""],
    exportTypes: [""],
  });
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [selectedEditor, setSelectedEditor] = useState("");

  // Get jobs for dropdown
  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
  });

  // Get users (editors/suppliers) for dropdown
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Get editors/suppliers (users with editor role)
  const editors = users.filter(user => user.role === 'editor' || user.role === 'admin');

  // Mock services for now - in real app this would come from selected editor's profile
  useEffect(() => {
    if (selectedEditor) {
      // Mock services based on editor selection
      setAvailableServices([
        "Digital Edits - (Sky To Dusk)",
        "Image Enhancement - Basic",
        "Virtual Staging",
        "Photo Retouching",
        "HDR Processing",
        "Virtual Tour Creation"
      ]);
    } else {
      setAvailableServices([]);
    }
  }, [selectedEditor]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const addInstruction = () => {
    setOrderDetails(prev => ({
      ...prev,
      instructions: [...prev.instructions, ""]
    }));
  };

  const removeInstruction = (index: number) => {
    if (orderDetails.instructions.length > 1) {
      setOrderDetails(prev => ({
        ...prev,
        instructions: prev.instructions.filter((_, i) => i !== index)
      }));
    }
  };

  const updateInstruction = (index: number, value: string) => {
    setOrderDetails(prev => ({
      ...prev,
      instructions: prev.instructions.map((inst, i) => i === index ? value : inst)
    }));
  };

  const addExportType = () => {
    setOrderDetails(prev => ({
      ...prev,
      exportTypes: [...prev.exportTypes, ""]
    }));
  };

  const removeExportType = (index: number) => {
    if (orderDetails.exportTypes.length > 1) {
      setOrderDetails(prev => ({
        ...prev,
        exportTypes: prev.exportTypes.filter((_, i) => i !== index)
      }));
    }
  };

  const updateExportType = (index: number, value: string) => {
    setOrderDetails(prev => ({
      ...prev,
      exportTypes: prev.exportTypes.map((type, i) => i === index ? value : type)
    }));
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-rpp-grey-dark">Upload to Editor</h2>
        <p className="text-rpp-grey-light">Upload your photos and provide editing instructions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Upload Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Information */}
          <Card className="border-rpp-grey-border">
            <CardHeader>
              <CardTitle className="text-rpp-grey-dark">New Order Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Job Dropdown */}
              <div>
                <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                  Job
                </label>
                <p className="text-xs text-rpp-grey-light mb-2">Choose a job for your respective order statement</p>
                <Select 
                  value={orderDetails.jobId} 
                  onValueChange={(value) => setOrderDetails(prev => ({ ...prev, jobId: value }))}
                >
                  <SelectTrigger className="border-rpp-grey-border" data-testid="select-job">
                    <SelectValue placeholder="Select a job..." />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((job: any) => (
                      <SelectItem key={job.jobId} value={job.jobId}>
                        {job.address || `Job ${job.jobId}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Supplier/Editor Dropdown */}
              <div>
                <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                  Supplier
                </label>
                <p className="text-xs text-rpp-grey-light mb-2">Select the supplier who are responsible for this order. Learn more about assigning suppliers here</p>
                <Select 
                  value={selectedEditor} 
                  onValueChange={(value) => {
                    setSelectedEditor(value);
                    setOrderDetails(prev => ({ ...prev, supplier: value, service: "" }));
                  }}
                >
                  <SelectTrigger className="border-rpp-grey-border" data-testid="select-supplier">
                    <SelectValue placeholder="Select a supplier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {editors.map((editor: any) => (
                      <SelectItem key={editor.id} value={editor.id}>
                        {editor.firstName} {editor.lastName} ({editor.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Services Dropdown */}
              <div>
                <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                  Services
                </label>
                <p className="text-xs text-rpp-grey-light mb-2">Choose the services that the suppliers and perform for this order</p>
                <Select 
                  value={orderDetails.service} 
                  onValueChange={(value) => setOrderDetails(prev => ({ ...prev, service: value }))}
                  disabled={!selectedEditor}
                >
                  <SelectTrigger className="border-rpp-grey-border" data-testid="select-service">
                    <SelectValue placeholder={selectedEditor ? "Select a service..." : "Select a supplier first..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableServices.map((service) => (
                      <SelectItem key={service} value={service}>
                        {service}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {orderDetails.service && (
                  <div className="mt-2 p-2 bg-blue-50 rounded border">
                    <span className="text-xs text-blue-600">SERVICE 1</span>
                    <div className="font-medium text-sm">{orderDetails.service}</div>
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                  Quantity
                </label>
                <p className="text-xs text-rpp-grey-light mb-2">How many quantity do you demand?</p>
                <Input
                  type="number"
                  placeholder="Enter total number of final images"
                  value={orderDetails.quantity}
                  onChange={(e) => setOrderDetails(prev => ({ ...prev, quantity: e.target.value }))}
                  className="border-rpp-grey-border"
                  data-testid="input-quantity"
                />
              </div>

              {/* Multiple Instructions */}
              <div>
                <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                  Instructions
                </label>
                <p className="text-xs text-rpp-grey-light mb-2">Use detailed specificity are required to help your supplier deliver the expected results for this service.</p>
                <div className="space-y-2">
                  {orderDetails.instructions.map((instruction, index) => (
                    <div key={index} className="flex space-x-2">
                      <Textarea
                        placeholder={`Instruction ${index + 1}...`}
                        value={instruction}
                        onChange={(e) => updateInstruction(index, e.target.value)}
                        className="border-rpp-grey-border min-h-[80px] flex-1"
                        data-testid={`textarea-instruction-${index}`}
                      />
                      {orderDetails.instructions.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeInstruction(index)}
                          className="self-start mt-2"
                          data-testid={`button-remove-instruction-${index}`}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addInstruction}
                    className="w-full border-dashed"
                    data-testid="button-add-instruction"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Another Instruction
                  </Button>
                </div>
              </div>

              {/* Export Types */}
              <div>
                <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                  Export Types
                </label>
                <p className="text-xs text-rpp-grey-light mb-2">Specify output requirements for your editor, such as watermarks, folder sizes, and other preferences</p>
                <div className="space-y-2">
                  {orderDetails.exportTypes.map((exportType, index) => (
                    <div key={index} className="flex space-x-2">
                      <Select
                        value={exportType}
                        onValueChange={(value) => updateExportType(index, value)}
                      >
                        <SelectTrigger className="border-rpp-grey-border flex-1" data-testid={`select-export-type-${index}`}>
                          <SelectValue placeholder="Choose Export Type..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high-res">High Resolution</SelectItem>
                          <SelectItem value="web-res">Web Resolution</SelectItem>
                          <SelectItem value="print-ready">Print Ready</SelectItem>
                          <SelectItem value="social-media">Social Media Optimized</SelectItem>
                          <SelectItem value="raw-files">RAW Files</SelectItem>
                        </SelectContent>
                      </Select>
                      {orderDetails.exportTypes.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeExportType(index)}
                          className="self-center"
                          data-testid={`button-remove-export-type-${index}`}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addExportType}
                    className="w-full border-dashed"
                    data-testid="button-add-export-type"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Export Type
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card className="border-rpp-grey-border">
            <CardHeader>
              <CardTitle className="text-rpp-grey-dark">Upload Files</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-rpp-grey-border rounded-lg p-8 text-center hover:border-rpp-red-main transition-colors"
              >
                <UploadIcon className="w-12 h-12 text-rpp-grey-light mx-auto mb-4" />
                <p className="text-rpp-grey-dark font-medium mb-2">
                  Drag and drop your files here, or click to browse
                </p>
                <p className="text-sm text-rpp-grey-light mb-4">
                  Supported formats: JPG, PNG, RAW, TIFF (Max 100MB per file)
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload">
                  <Button variant="outline" className="border-rpp-grey-border">
                    Choose Files
                  </Button>
                </label>
              </div>

              {/* Selected Files */}
              {selectedFiles.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-rpp-grey-dark mb-3">
                    Selected Files ({selectedFiles.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border border-rpp-grey-border rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <FileImage className="w-5 h-5 text-rpp-grey-light" />
                          <div>
                            <p className="text-sm font-medium text-rpp-grey-dark">{file.name}</p>
                            <p className="text-xs text-rpp-grey-light">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className="text-rpp-grey-light hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Summary Sidebar */}
        <div>
          <Card className="border-rpp-grey-border sticky top-24">
            <CardHeader>
              <CardTitle className="text-rpp-grey-dark">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {orderDetails.jobId && (
                  <div className="flex justify-between text-sm">
                    <span className="text-rpp-grey-light">Job:</span>
                    <span className="text-rpp-grey-dark">{jobs.find(j => j.jobId === orderDetails.jobId)?.address || orderDetails.jobId}</span>
                  </div>
                )}
                {selectedEditor && (
                  <div className="flex justify-between text-sm">
                    <span className="text-rpp-grey-light">Supplier:</span>
                    <span className="text-rpp-grey-dark">
                      {(() => {
                        const editor = users.find(u => u.id === selectedEditor);
                        return editor ? `${editor.firstName} ${editor.lastName}` : selectedEditor;
                      })()}
                    </span>
                  </div>
                )}
                {orderDetails.service && (
                  <div className="flex justify-between text-sm">
                    <span className="text-rpp-grey-light">Service:</span>
                    <span className="text-rpp-grey-dark">{orderDetails.service}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-rpp-grey-light">Digital Edits - (Sky To Dusk):</span>
                  <span className="text-rpp-grey-dark">$4.50</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-rpp-grey-light">Quantity:</span>
                  <span className="text-rpp-grey-dark">{orderDetails.quantity || '0'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-rpp-grey-light">Service fee (5):</span>
                  <span className="text-rpp-grey-dark">$0.25</span>
                </div>
                <hr className="border-rpp-grey-border" />
                <div className="flex justify-between font-medium">
                  <span className="text-rpp-grey-dark">Total (estimated cost):</span>
                  <span className="text-rpp-grey-dark">
                    ${((parseFloat(orderDetails.quantity) || 0) * 4.50 + 0.25).toFixed(2)}
                  </span>
                </div>
                <div className="text-xs text-rpp-grey-light">
                  User policy: Charges are that may not be added to your current billing period.
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <Button
                  className="w-full bg-rpp-red-main hover:bg-rpp-red-dark text-white"
                  disabled={selectedFiles.length === 0}
                >
                  Submit Order
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-rpp-grey-border text-rpp-grey-dark"
                >
                  Save as Draft
                </Button>
              </div>

              <div className="pt-4 text-xs text-rpp-grey-light">
                <p>
                  By submitting this order, you agree to our{" "}
                  <a href="#" className="text-rpp-red-main hover:underline">
                    terms of service
                  </a>{" "}
                  and{" "}
                  <a href="#" className="text-rpp-red-main hover:underline">
                    editing guidelines
                  </a>
                  .
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
