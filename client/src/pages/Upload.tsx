import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectLabel, SelectSeparator, SelectGroup } from "@/components/ui/select";
import { Upload as UploadIcon, FileImage, X, Plus, Minus } from "lucide-react";

export default function Upload() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [orderDetails, setOrderDetails] = useState({
    jobId: "",
    supplier: "",
    service: "",
    quantity: "",
    fileName: "",
    instructions: [""],
    exportTypes: [""],
  });
  const [groupedServices, setGroupedServices] = useState<{[key: string]: any[]}>({});
  const [selectedEditor, setSelectedEditor] = useState("");

  // Get jobs for dropdown
  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
  });

  // Get partnered editors (suppliers) for dropdown
  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useQuery<any[]>({
    queryKey: ["/api/partnerships/suppliers"],
    retry: false
  });

  // Fetch real services from selected editor
  const { data: editorServices = [], isLoading: isLoadingServices } = useQuery<any[]>({
    queryKey: ["/api/editor", selectedEditor, "services"],
    enabled: !!selectedEditor,
    retry: false
  });

  // Fetch service categories from selected editor
  const { data: serviceCategories = [], isLoading: isLoadingCategories } = useQuery<any[]>({
    queryKey: ["/api/editor", selectedEditor, "service-categories"],
    enabled: !!selectedEditor,
    retry: false
  });

  useEffect(() => {
    console.log('Effect triggered - services:', editorServices?.length, 'categories:', serviceCategories?.length);
    
    if (editorServices && editorServices.length > 0) {
      console.log('Processing services:', editorServices);
      console.log('Available categories:', serviceCategories);
      
      // Group services by category
      const activeServices = editorServices.filter(service => service.isActive);
      console.log('Active services:', activeServices);
      
      const grouped: {[key: string]: any[]} = {};
      
      // Group services by categoryId
      activeServices.forEach(service => {
        const categoryId = service.categoryId || 'uncategorized';
        console.log('Service:', service.name, 'categoryId:', categoryId);
        
        if (!grouped[categoryId]) {
          grouped[categoryId] = [];
        }
        grouped[categoryId].push(service);
      });
      
      console.log('Final grouped services:', grouped);
      setGroupedServices(grouped);
    } else {
      console.log('No services to process');
      setGroupedServices({});
    }
  }, [editorServices, serviceCategories]);

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
                    {isLoadingSuppliers ? (
                      <SelectItem value="loading" disabled>
                        Loading editors...
                      </SelectItem>
                    ) : suppliers.length === 0 ? (
                      <SelectItem value="no-editors" disabled>
                        No partner editors available
                      </SelectItem>
                    ) : (
                      suppliers.map((supplier: any) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.studioName} ({supplier.email})
                        </SelectItem>
                      ))
                    )}
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
                  disabled={!selectedEditor || isLoadingServices || isLoadingCategories}
                >
                  <SelectTrigger className="border-rpp-grey-border" data-testid="select-service">
                    <SelectValue placeholder={
                      !selectedEditor 
                        ? "Select a supplier first..."
                        : (isLoadingServices || isLoadingCategories) 
                        ? "Loading services..."
                        : Object.keys(groupedServices).length === 0
                        ? "No services available"
                        : "Select a service..."
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(groupedServices).length === 0 ? (
                      <SelectItem value="no-services" disabled>
                        No services available
                      </SelectItem>
                    ) : (
                      Object.entries(groupedServices).map(([categoryId, services], categoryIndex) => {
                        const category = serviceCategories.find(cat => cat.id === categoryId);
                        const categoryName = category ? category.name : 'Uncategorized';
                        
                        return (
                          <SelectGroup key={categoryId}>
                            {categoryIndex > 0 && <SelectSeparator />}
                            <SelectLabel className="font-medium text-gray-900">
                              {categoryName}
                            </SelectLabel>
                            {services.map((service) => (
                              <SelectItem key={service.id} value={service.name}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{service.name}</span>
                                  {service.basePrice && (
                                    <span className="text-xs text-gray-500">
                                      ${parseFloat(service.basePrice).toFixed(2)} per {service.pricePer || 'image'}
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
                {orderDetails.service && (
                  <div className="mt-4 p-6 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-center mb-6">
                      <span className="text-xs text-blue-600 uppercase tracking-wider">SERVICE 1</span>
                      <div className="font-medium text-lg text-gray-900 mt-1">{orderDetails.service}</div>
                    </div>

                    {/* Quantity Section */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quantity
                      </label>
                      <div className="flex items-center space-x-4">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const currentQty = parseInt(orderDetails.quantity) || 0;
                            const newQty = Math.max(0, currentQty - 1);
                            setOrderDetails(prev => ({ ...prev, quantity: newQty.toString() }));
                          }}
                          className="w-8 h-8 p-0 border-gray-300"
                          data-testid="button-decrease-quantity"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <Input
                          type="number"
                          min="0"
                          value={orderDetails.quantity}
                          onChange={(e) => {
                            const value = Math.max(0, parseInt(e.target.value) || 0);
                            setOrderDetails(prev => ({ ...prev, quantity: value.toString() }));
                          }}
                          className="w-16 text-center border-gray-300"
                          data-testid="input-quantity"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const currentQty = parseInt(orderDetails.quantity) || 0;
                            setOrderDetails(prev => ({ ...prev, quantity: (currentQty + 1).toString() }));
                          }}
                          className="w-8 h-8 p-0 border-gray-300"
                          data-testid="button-increase-quantity"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <span className="text-sm text-gray-500 ml-2">final files expected to be delivered.</span>
                      </div>
                    </div>

                    {/* Instructions Section */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Instructions
                      </label>
                      <p className="text-xs text-gray-500 mb-3">
                        Offer detailed guidance as needed to help your supplier deliver the expected results for this service.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          placeholder="File Name"
                          value={orderDetails.fileName}
                          onChange={(e) => setOrderDetails(prev => ({ ...prev, fileName: e.target.value }))}
                          className="border-gray-300"
                          data-testid="input-file-name"
                        />
                        <Textarea
                          placeholder="Detail your instruction"
                          value={orderDetails.instructions[0] || ""}
                          onChange={(e) => updateInstruction(0, e.target.value)}
                          className="border-gray-300 min-h-[100px] resize-none"
                          data-testid="textarea-instruction-0"
                        />
                      </div>
                      {orderDetails.instructions.length > 1 && (
                        <div className="mt-3 space-y-2">
                          {orderDetails.instructions.slice(1).map((instruction, index) => (
                            <div key={index + 1} className="flex space-x-2">
                              <Textarea
                                placeholder={`Additional instruction ${index + 2}...`}
                                value={instruction}
                                onChange={(e) => updateInstruction(index + 1, e.target.value)}
                                className="border-gray-300 min-h-[80px] flex-1 resize-none"
                                data-testid={`textarea-instruction-${index + 1}`}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeInstruction(index + 1)}
                                className="self-start mt-2 text-red-500 hover:text-red-700"
                                data-testid={`button-remove-instruction-${index + 1}`}
                              >
                                <Minus className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addInstruction}
                        className="mt-3 w-full border-dashed border-gray-300 text-gray-600 hover:text-gray-800"
                        data-testid="button-add-instruction"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Another Instruction
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Export Types - only show when service is selected */}
              {orderDetails.service && (
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Export Types
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Specify output requirements for your order, such as watermarks, folder sizes, and other preferences
                  </p>
                  <div className="space-y-3">
                    {orderDetails.exportTypes.map((exportType, index) => (
                      <div key={index} className="grid grid-cols-2 gap-4">
                        <Select
                          value={exportType}
                          onValueChange={(value) => updateExportType(index, value)}
                        >
                          <SelectTrigger className="border-gray-300" data-testid={`select-export-type-${index}`}>
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
                        <div className="flex items-center space-x-2">
                          <Input
                            placeholder="Provide description"
                            className="border-gray-300 flex-1"
                            data-testid={`input-export-description-${index}`}
                          />
                          {orderDetails.exportTypes.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeExportType(index)}
                              className="text-red-500 hover:text-red-700"
                              data-testid={`button-remove-export-type-${index}`}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addExportType}
                      className="w-full border-dashed border-gray-300 text-gray-600 hover:text-gray-800"
                      data-testid="button-add-export-type"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Export Type
                    </Button>
                  </div>
                </div>
              )}
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
                        const supplier = suppliers.find(s => s.id === selectedEditor);
                        return supplier ? supplier.studioName : selectedEditor;
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
