import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectLabel, SelectSeparator, SelectGroup } from "@/components/ui/select";
import { Upload as UploadIcon, FileImage, X, Plus, Minus } from "lucide-react";
import { FileUploadModal } from "@/components/FileUploadModal";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface SelectedService {
  id: string;
  service: any;
  quantity: number;
  instructions: Array<{
    fileName: string;
    detail: string;
  }>;
  exportTypes: Array<{
    type: string;
    description: string;
  }>;
  files: File[];
  uploadedFiles?: Array<{
    file: File;
    url: string;
    path: string;
  }>;
}

export default function Upload() {
  const { userData: user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [orderDetails, setOrderDetails] = useState({
    jobId: "",
    supplier: "",
  });
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [groupedServices, setGroupedServices] = useState<{[key: string]: any[]}>({});
  const [selectedEditor, setSelectedEditor] = useState("");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [currentUploadService, setCurrentUploadService] = useState<SelectedService | null>(null);
  const [reservedOrderNumber, setReservedOrderNumber] = useState<string | null>(null);

  // Get jobs for dropdown
  const { data: allJobs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
  });

  // Get orders to filter jobs that have associated orders
  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["/api/orders"],
  });

  // Filter jobs to only show those with associated orders
  const jobs = allJobs.filter(job => {
    const hasOrder = orders.some(order => 
      order.jobId === job.id || // Match by UUID
      (job.jobId && order.jobId === job.jobId) // Match by NanoID (only if job has NanoID)
    );
    return hasOrder;
  });

  console.log(`[FILTER] Showing ${jobs.length} of ${allJobs.length} jobs (${orders.length} orders available)`);

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
    if (editorServices && editorServices.length > 0) {
      // Group services by category
      const activeServices = editorServices.filter(service => service.isActive !== false);
      const grouped: {[key: string]: any[]} = {};
      
      // Group services by categoryId
      activeServices.forEach(service => {
        const categoryId = service.categoryId || 'uncategorized';
        
        if (!grouped[categoryId]) {
          grouped[categoryId] = [];
        }
        grouped[categoryId].push(service);
      });
      
      setGroupedServices(grouped);
    } else {
      setGroupedServices({});
    }
  }, [editorServices, serviceCategories]);

  const handleFileSelect = (serviceId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedServices(prev => prev.map(s => 
        s.id === serviceId 
          ? { ...s, files: [...s.files, ...newFiles] }
          : s
      ));
    }
  };

  const removeFile = (serviceId: string, fileIndex: number) => {
    setSelectedServices(prev => prev.map(s => 
      s.id === serviceId 
        ? { ...s, files: s.files.filter((_, i) => i !== fileIndex) }
        : s
    ));
  };

  const handleDrop = (serviceId: string, e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    setSelectedServices(prev => prev.map(s => 
      s.id === serviceId 
        ? { ...s, files: [...s.files, ...files] }
        : s
    ));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Handle file uploads for specific service
  const handleServiceFileUpload = (serviceId: string, files: { file: File; url: string; path: string }[], orderNumber: string) => {
    setSelectedServices(prev => 
      prev.map(service => 
        service.id === serviceId 
          ? { ...service, files: files.map(f => f.file), uploadedFiles: files }
          : service
      )
    );
    
    // Store the reserved order number for later use during submission
    setReservedOrderNumber(orderNumber);
    console.log(`Stored reserved order number: ${orderNumber}`);
  };

  // Submit order mutation
  const submitOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await apiRequest("/api/orders/submit", "POST", orderData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Order Submitted Successfully", 
        description: `Order ${data.order.orderNumber} has been submitted for editing.`,
      });
      // Reset form
      setSelectedServices([]);
      setOrderDetails({ jobId: "", supplier: "" });
      setSelectedEditor("");
      setReservedOrderNumber(null);
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error Submitting Order",
        description: error.message || "Failed to submit order. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitOrder = () => {
    if (!user?.partnerId) {
      toast({
        title: "Error",
        description: "User partner ID not found. Please log in again.",
        variant: "destructive",
      });
      return;
    }

    if (selectedServices.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one service before submitting.",
        variant: "destructive",
      });
      return;
    }

    // Check if all services have uploaded files
    const servicesWithoutFiles = selectedServices.filter(service => !service.uploadedFiles || service.uploadedFiles.length === 0);
    if (servicesWithoutFiles.length > 0) {
      toast({
        title: "Error",
        description: "Please upload files for all selected services before submitting.",
        variant: "destructive",
      });
      return;
    }

    // Prepare order data
    const orderData = {
      partnerId: user.partnerId,
      jobId: orderDetails.jobId || null,
      customerId: null, // Will be handled if job has a customer
      createdBy: user.uid,
      orderNumber: reservedOrderNumber, // Include reserved order number
      services: selectedServices.map(service => ({
        serviceId: service.service.id,
        quantity: service.quantity,
        instructions: service.instructions,
        exportTypes: service.exportTypes,
        files: service.uploadedFiles?.map(upload => ({
          fileName: upload.file.name,
          originalName: upload.file.name,
          fileSize: upload.file.size,
          mimeType: upload.file.type,
          firebaseUrl: upload.url,
          downloadUrl: upload.url
        })) || []
      }))
    };

    submitOrderMutation.mutate(orderData);
  };

  // Open upload modal for specific service
  const openUploadModal = (service: SelectedService) => {
    setCurrentUploadService(service);
    setUploadModalOpen(true);
  };

  // Close upload modal
  const closeUploadModal = () => {
    setUploadModalOpen(false);
    setCurrentUploadService(null);
  };

  // Service management functions
  const addService = (service: any) => {
    const newService: SelectedService = {
      id: `service_${Date.now()}`,
      service,
      quantity: 1,
      instructions: [{
        fileName: "",
        detail: ""
      }],
      exportTypes: [{
        type: "",
        description: ""
      }],
      files: []
    };
    setSelectedServices(prev => [...prev, newService]);
  };

  const removeService = (serviceId: string) => {
    setSelectedServices(prev => prev.filter(s => s.id !== serviceId));
  };

  const updateServiceQuantity = (serviceId: string, delta: number) => {
    setSelectedServices(prev => prev.map(s => 
      s.id === serviceId 
        ? { ...s, quantity: Math.max(1, s.quantity + delta) }
        : s
    ));
  };

  const updateServiceInstructions = (serviceId: string, instructionIndex: number, field: 'fileName' | 'detail', value: string) => {
    setSelectedServices(prev => prev.map(s => 
      s.id === serviceId 
        ? { 
            ...s, 
            instructions: s.instructions.map((instruction, index) => 
              index === instructionIndex 
                ? { ...instruction, [field]: value }
                : instruction
            )
          }
        : s
    ));
  };

  // Add new instruction pair to service
  const addServiceInstruction = (serviceId: string) => {
    setSelectedServices(prev => prev.map(s => 
      s.id === serviceId 
        ? { ...s, instructions: [...s.instructions, { fileName: "", detail: "" }] }
        : s
    ));
  };

  // Remove instruction pair from service
  const removeServiceInstruction = (serviceId: string, instructionIndex: number) => {
    setSelectedServices(prev => prev.map(s => 
      s.id === serviceId && s.instructions.length > 1
        ? { ...s, instructions: s.instructions.filter((_, index) => index !== instructionIndex) }
        : s
    ));
  };

  const addExportType = (serviceId: string) => {
    setSelectedServices(prev => prev.map(s => 
      s.id === serviceId 
        ? { ...s, exportTypes: [...s.exportTypes, { type: "", description: "" }] }
        : s
    ));
  };

  const removeExportType = (serviceId: string, index: number) => {
    setSelectedServices(prev => prev.map(s => 
      s.id === serviceId && s.exportTypes.length > 1
        ? { ...s, exportTypes: s.exportTypes.filter((_, i) => i !== index) }
        : s
    ));
  };

  const updateExportType = (serviceId: string, index: number, field: 'type' | 'description', value: string) => {
    setSelectedServices(prev => prev.map(s => 
      s.id === serviceId 
        ? { 
            ...s, 
            exportTypes: s.exportTypes.map((et, i) => 
              i === index ? { ...et, [field]: value } : et
            )
          }
        : s
    ));
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
                      <SelectItem 
                        key={job.id} 
                        value={job.jobId || job.id}
                      >
                        {job.address || `Job ${job.jobId || job.id}`}
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
                <p className="text-xs text-rpp-grey-light mb-2">Choose the services that the supplier will perform for this order.</p>
                <Select 
                  value=""
                  onValueChange={(value) => {
                    // Find the selected service object
                    const allServices = Object.values(groupedServices).flat();
                    const selectedService = allServices.find(service => service.name === value);
                    if (selectedService) {
                      addService(selectedService);
                    }
                  }}
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
                        : "Select services..."
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(groupedServices).length === 0 ? (
                      <SelectItem value="no-services" disabled>
                        No services available
                      </SelectItem>
                    ) : (
                      Object.entries(groupedServices).map(([categoryId, services], categoryIndex) => {
                        const category = serviceCategories?.find(cat => cat.id === categoryId);
                        const categoryName = category ? category.name : 'Uncategorized';
                        
                        return (
                          <SelectGroup key={`${categoryId}-${categoryIndex}`}>
                            {categoryIndex > 0 && <SelectSeparator key={`separator-${categoryIndex}`} />}
                            <SelectLabel key={`label-${categoryId}`} className="font-medium text-gray-900">
                              {categoryName}
                            </SelectLabel>
                            {services.map((service, serviceIndex) => (
                              <SelectItem key={`${service.id}-${serviceIndex}`} value={service.name}>
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

                {/* Selected Services Display */}
                {selectedServices.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedServices.map((selectedService) => (
                      <div key={selectedService.id} className="flex items-center bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm">
                        <span className="mr-2">{selectedService.service.name} - [{selectedService.service.pricePer === 'image' ? 'Day' : selectedService.service.pricePer}]</span>
                        <span className="mr-2">${parseFloat(selectedService.service.basePrice).toFixed(2)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeService(selectedService.id)}
                          className="h-4 w-4 p-0 hover:bg-red-200"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Individual Service Sections */}
              {selectedServices.map((selectedService, serviceIndex) => (
                <Card key={selectedService.id} className="mt-6 border-rpp-grey-border">
                  <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs text-blue-600 uppercase tracking-wider">SERVICE {serviceIndex + 1}</span>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUploadModal(selectedService)}
                        className="border-gray-300"
                        data-testid={`button-upload-${selectedService.id}`}
                      >
                        <UploadIcon className="w-4 h-4 mr-2" />
                        Upload {selectedService.files.length > 0 && `(${selectedService.files.length})`}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeService(selectedService.id)}
                        className="text-red-500 hover:text-red-700"
                        data-testid={`button-delete-service-${selectedService.id}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="text-center mb-6">
                    <div className="font-medium text-lg text-gray-900">{selectedService.service.name} - [{selectedService.service.pricePer === 'image' ? 'Day' : selectedService.service.pricePer}]</div>
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
                        onClick={() => updateServiceQuantity(selectedService.id, -1)}
                        className="w-8 h-8 p-0 border-gray-300"
                        data-testid={`button-decrease-quantity-${selectedService.id}`}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="text-sm font-medium w-8 text-center">{selectedService.quantity}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => updateServiceQuantity(selectedService.id, 1)}
                        className="w-8 h-8 p-0 border-gray-300"
                        data-testid={`button-increase-quantity-${selectedService.id}`}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-gray-500 ml-2">total files expected to be delivered.</span>
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
                    <div className="space-y-3">
                      {selectedService.instructions.map((instruction, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <div className="grid grid-cols-2 gap-4 flex-1">
                            <Input
                              placeholder="File Name"
                              value={instruction.fileName}
                              onChange={(e) => updateServiceInstructions(selectedService.id, index, 'fileName', e.target.value)}
                              className="border-gray-300 h-9"
                              data-testid={`input-file-name-${selectedService.id}-${index}`}
                            />
                            <Textarea
                              placeholder="Detail your instruction"
                              value={instruction.detail}
                              onChange={(e) => updateServiceInstructions(selectedService.id, index, 'detail', e.target.value)}
                              className="border-gray-300 h-9 resize-none text-sm py-2"
                              data-testid={`textarea-instruction-${selectedService.id}-${index}`}
                            />
                          </div>
                          {selectedService.instructions.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeServiceInstruction(selectedService.id, index)}
                              className="text-red-500 hover:text-red-700 mt-0 h-9 w-9 p-0"
                              data-testid={`button-remove-instruction-${selectedService.id}-${index}`}
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
                        onClick={() => addServiceInstruction(selectedService.id)}
                        className="w-full border-dashed border-gray-300 text-gray-600 hover:text-gray-800"
                        data-testid={`button-add-instruction-${selectedService.id}`}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Another Instruction
                      </Button>
                    </div>
                  </div>

                  {/* Export Types Section */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Export Types
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      Specify output requirements for your order, such as watermarks, folder sizes, and other preferences
                    </p>
                    <div className="space-y-3">
                      {selectedService.exportTypes.map((exportType, index) => (
                        <div key={index} className="grid grid-cols-2 gap-4">
                          <Select
                            value={exportType.type}
                            onValueChange={(value) => updateExportType(selectedService.id, index, 'type', value)}
                          >
                            <SelectTrigger className="border-gray-300" data-testid={`select-export-type-${selectedService.id}-${index}`}>
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
                              value={exportType.description}
                              onChange={(e) => updateExportType(selectedService.id, index, 'description', e.target.value)}
                              className="border-gray-300 flex-1"
                              data-testid={`input-export-description-${selectedService.id}-${index}`}
                            />
                            {selectedService.exportTypes.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeExportType(selectedService.id, index)}
                                className="text-red-500 hover:text-red-700"
                                data-testid={`button-remove-export-type-${selectedService.id}-${index}`}
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
                        onClick={() => addExportType(selectedService.id)}
                        className="w-full border-dashed border-gray-300 text-gray-600 hover:text-gray-800"
                        data-testid={`button-add-export-type-${selectedService.id}`}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Export Type
                      </Button>
                    </div>
                  </div>
                  </CardContent>
                </Card>
              ))}

              {/* END OF SERVICES */}
              {selectedServices.length > 0 && (
                <div className="mt-8 text-center">
                  <span className="text-sm text-gray-500 uppercase tracking-wider">END OF SERVICES</span>
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
                {selectedServices.map((service, index) => (
                  <div key={service.id} className="flex justify-between text-sm">
                    <span className="text-rpp-grey-light">{service.service.name} (Qty: {service.quantity}):</span>
                    <span className="text-rpp-grey-dark">${(parseFloat(service.service.basePrice) * service.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm">
                  <span className="text-rpp-grey-light">Service fee:</span>
                  <span className="text-rpp-grey-dark">$0.25</span>
                </div>
                <hr className="border-rpp-grey-border" />
                <div className="flex justify-between font-medium">
                  <span className="text-rpp-grey-dark">Total (estimated cost):</span>
                  <span className="text-rpp-grey-dark">
                    ${(selectedServices.reduce((total, service) => 
                      total + (parseFloat(service.service.basePrice) * service.quantity), 0) + 0.25).toFixed(2)}
                  </span>
                </div>
                <div className="text-xs text-rpp-grey-light">
                  User policy: Charges are that may not be added to your current billing period.
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <Button
                  className="w-full bg-rpp-red-main hover:bg-rpp-red-dark text-white"
                  disabled={selectedServices.length === 0 || submitOrderMutation.isPending}
                  onClick={handleSubmitOrder}
                  data-testid="button-submit-order"
                >
                  {submitOrderMutation.isPending ? "Submitting..." : "Submit Order"}
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

      {/* File Upload Modal */}
      {currentUploadService && user?.uid && orderDetails.jobId && (
        <FileUploadModal
          isOpen={uploadModalOpen}
          onClose={closeUploadModal}
          serviceName={currentUploadService.service.name}
          serviceId={currentUploadService.id}
          userId={user.uid}
          jobId={orderDetails.jobId}
          onFilesUpload={handleServiceFileUpload}
        />
      )}
    </div>
  );
}
