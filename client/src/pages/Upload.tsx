import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectLabel, SelectSeparator, SelectGroup } from "@/components/ui/select";
import { Upload as UploadIcon, FileImage, X, Plus, Minus, MapPin, Building2, FileText, Camera, Sparkles, Palette, Home, Cloud, Plane, Video, Check } from "lucide-react";
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

  // Get jobs for dropdown - show ALL jobs
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

    // Check if an editor is selected
    if (!selectedEditor) {
      toast({
        title: "Error",
        description: "Please select an editor before submitting the order.",
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
      assignedTo: selectedEditor, // Add selected editor assignment
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
          {/* Job Card */}
          <Card className="border-gray-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-5 h-5 text-orange-500" />
                <label className="font-medium text-gray-900 text-[20px]">
                  Job
                </label>
              </div>
              <p className="text-sm text-gray-600 mb-3">Choose a job for your finished asset placement</p>
              <Select 
                value={orderDetails.jobId} 
                onValueChange={(value) => setOrderDetails(prev => ({ ...prev, jobId: value }))}
              >
                <SelectTrigger className="border-gray-300" data-testid="select-job">
                  <SelectValue placeholder="Select a job..." />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((job: any) => (
                    <SelectItem 
                      key={job.id} 
                      value={job.jobId || job.id}
                    >
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          <div className="font-medium">{job.address?.split(',')[0] || job.address}</div>
                          <div className="text-xs text-gray-500">{job.address}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          
          {/* Supplier Card */}
          <Card className="border-gray-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-orange-500" />
                <label className="font-medium text-gray-900 text-[20px]">
                  Supplier
                </label>
              </div>
              <p className="text-sm text-gray-600 mb-3">Select the supplier who will be responsible for this order</p>
              <Select 
                value={selectedEditor} 
                onValueChange={(value) => {
                  setSelectedEditor(value);
                  setOrderDetails(prev => ({ ...prev, supplier: value, service: "" }));
                }}
              >
                <SelectTrigger className="border-gray-300" data-testid="select-supplier">
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
                        <div className="flex items-start gap-2">
                          <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <div className="font-medium">{supplier.studioName}</div>
                            <div className="text-xs text-gray-500">{supplier.studioName}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Services Card */}
          <Card className="border-gray-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-orange-500" />
                <h3 className="font-medium text-gray-900 text-[20px]">Select Services</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">Click on services to add them to your order</p>
              
              {!selectedEditor ? (
                <p className="text-sm text-gray-500 text-center py-8">Select a supplier first to view available services</p>
              ) : isLoadingServices || isLoadingCategories ? (
                <p className="text-sm text-gray-500 text-center py-8">Loading services...</p>
              ) : Object.keys(groupedServices).length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No services available</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {Object.values(groupedServices).flat().map((service: any) => {
                    const isSelected = selectedServices.some(s => s.service.id === service.id);
                    const iconProps = { className: "w-5 h-5" };
                    
                    // Map service names to icons and colors
                    const getServiceIcon = (name: string) => {
                      const lowerName = name.toLowerCase();
                      if (lowerName.includes('enhancement') || lowerName.includes('photography')) return <Camera {...iconProps} />;
                      if (lowerName.includes('floor')) return <FileText {...iconProps} />;
                      if (lowerName.includes('edit') || lowerName.includes('dusk')) return <Sparkles {...iconProps} />;
                      if (lowerName.includes('color') || lowerName.includes('correction')) return <Palette {...iconProps} />;
                      if (lowerName.includes('staging') || lowerName.includes('virtual')) return <Home {...iconProps} />;
                      if (lowerName.includes('sky') || lowerName.includes('replacement')) return <Cloud {...iconProps} />;
                      if (lowerName.includes('drone') || lowerName.includes('aerial')) return <Plane {...iconProps} />;
                      if (lowerName.includes('video')) return <Video {...iconProps} />;
                      return <Camera {...iconProps} />;
                    };
                    
                    const getServiceColor = (name: string) => {
                      const lowerName = name.toLowerCase();
                      if (lowerName.includes('enhancement') || lowerName.includes('photography')) return 'bg-blue-100 text-blue-600';
                      if (lowerName.includes('floor')) return 'bg-purple-100 text-purple-600';
                      if (lowerName.includes('edit') || lowerName.includes('dusk')) return 'bg-yellow-100 text-yellow-600';
                      if (lowerName.includes('color') || lowerName.includes('correction')) return 'bg-pink-100 text-pink-600';
                      if (lowerName.includes('staging') || lowerName.includes('virtual')) return 'bg-green-100 text-green-600';
                      if (lowerName.includes('sky') || lowerName.includes('replacement')) return 'bg-cyan-100 text-cyan-600';
                      if (lowerName.includes('drone') || lowerName.includes('aerial')) return 'bg-indigo-100 text-indigo-600';
                      if (lowerName.includes('video')) return 'bg-orange-100 text-orange-600';
                      return 'bg-gray-100 text-gray-600';
                    };
                    
                    return (
                      <button
                        key={service.id}
                        onClick={() => {
                          if (isSelected) {
                            const selectedService = selectedServices.find(s => s.service.id === service.id);
                            if (selectedService) removeService(selectedService.id);
                          } else {
                            addService(service);
                          }
                        }}
                        className="relative p-2.5 rounded-lg border-2 transition-all text-left border-gray-200 hover:border-gray-300 bg-white ml-[0px] mr-[0px] mt-[0px] mb-[0px] pt-[14px] pb-[14px] pl-[14px] pr-[14px]"
                        data-testid={`service-card-${service.id}`}
                      >
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 bg-orange-500 rounded-full p-0.5">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                        <div className={`w-8 h-8 rounded-lg ${getServiceColor(service.name)} flex items-center justify-center mb-1.5`}>
                          {getServiceIcon(service.name)}
                        </div>
                        <div className="font-medium text-gray-900 text-xs mb-0.5">{service.name}</div>
                        <div className="text-[10px] text-gray-500 mb-1 line-clamp-1">{service.description || service.pricePer}</div>
                        <div className="text-orange-600 font-semibold text-xs">
                          ${parseFloat(service.basePrice).toFixed(2)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configure Services Section */}
          {selectedServices.length > 0 && (
            <Card className="border-gray-200">
              <CardContent className="pt-6">
                <h3 className="text-base font-semibold text-gray-900 mb-1">Configure Services</h3>
                <p className="text-sm text-gray-600 mb-4">Upload files and set preferences for each service</p>
                
                {/* Selected Services Pills */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedServices.map((selectedService) => (
                    <div key={selectedService.id} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg">
                      <Camera className="w-4 h-4" />
                      <span className="text-sm font-medium">{selectedService.service.name}</span>
                      <button
                        onClick={() => removeService(selectedService.id)}
                        className="hover:bg-gray-200 rounded-full p-0.5"
                        data-testid={`button-remove-service-${selectedService.id}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Service Configuration */}
                {selectedServices.map((selectedService, serviceIndex) => (
                  <div key={selectedService.id} className="border-t border-gray-200 pt-6 first:border-t-0 first:pt-0">
                    {/* Upload Files Section */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-900 mb-3">Upload Files</label>
                      <button
                        onClick={() => openUploadModal(selectedService)}
                        className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-orange-400 hover:bg-orange-50 transition-colors"
                        data-testid={`button-upload-${selectedService.id}`}
                      >
                        <div className="flex flex-col items-center">
                          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-3">
                            <UploadIcon className="w-6 h-6 text-orange-600" />
                          </div>
                          <p className="text-sm text-gray-700 font-medium">
                            {selectedService.files.length > 0 
                              ? `${selectedService.files.length} file(s) selected - Click to change` 
                              : 'Click to upload files or drag and drop'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">JPG, PNG, RAW, or TIFF files</p>
                        </div>
                      </button>
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
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

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
