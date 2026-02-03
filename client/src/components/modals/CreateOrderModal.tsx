import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Upload as UploadIcon, Plus, Minus, MapPin, Building2, Camera, FileText, Palette, Home, Cloud, Aperture, Video, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

interface CreateOrderModalProps {
  onClose: () => void;
}

interface SelectedService {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: any;
  iconColor: string;
  quantity: number;
  instructions: Array<{ id: string; fileNaming: string; special: string }>;
  exportTypes: Array<{ id: string; format: string; requirements: string }>;
  files: File[];
}

export default function CreateOrderModal({ onClose }: CreateOrderModalProps) {
  const [currentStep, setCurrentStep] = useState<'job' | 'services' | 'configure'>('job');
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { userData } = useAuth();

  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ["/api/partnerships/suppliers"],
  });

  // Sort jobs: newest first (by appointment date, then creation date)
  const sortedJobs = [...jobs].sort((a, b) => {
    const dateA = new Date(a.appointmentDate || a.createdAt || 0).getTime();
    const dateB = new Date(b.appointmentDate || b.createdAt || 0).getTime();
    return dateB - dateA; // Newest first
  });

  const { data: services = [] } = useQuery<any[]>({
    queryKey: ["/api/editor", selectedSupplier, "services"],
    enabled: !!selectedSupplier
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/editor", selectedSupplier, "service-categories"],
    enabled: !!selectedSupplier
  });

  // Map services to display format with icons and colors
  const availableServices = services.map((service: any) => {
    // Find matching category for the service
    const category = categories.find((cat: any) => cat.id === service.categoryId);
    
    return {
      id: service.id,
      name: service.name,
      description: category?.name || service.description || '',
      price: parseFloat(service.basePrice),
      icon: Camera, // Default icon
      iconColor: 'bg-blue-100 text-blue-600',
      iconBg: 'bg-blue-50',
      borderColor: 'border-blue-200'
    };
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/orders", "POST", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Order Created",
        description: "Order has been sent successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create order. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleService = (service: any) => {
    const isSelected = selectedServices.find(s => s.id === service.id);
    if (isSelected) {
      setSelectedServices(selectedServices.filter(s => s.id !== service.id));
    } else {
      setSelectedServices([...selectedServices, {
        ...service,
        quantity: 1,
        instructions: [],
        exportTypes: [],
        files: []
      }]);
    }
  };

  const updateServiceQuantity = (serviceId: string, delta: number) => {
    setSelectedServices(selectedServices.map(s => 
      s.id === serviceId ? { ...s, quantity: Math.max(1, s.quantity + delta) } : s
    ));
  };

  const addInstruction = (serviceId: string) => {
    setSelectedServices(selectedServices.map(s => 
      s.id === serviceId ? { 
        ...s, 
        instructions: [...s.instructions, { id: Date.now().toString(), fileNaming: '', special: '' }] 
      } : s
    ));
  };

  const removeInstruction = (serviceId: string, instructionId: string) => {
    setSelectedServices(selectedServices.map(s => 
      s.id === serviceId ? { 
        ...s, 
        instructions: s.instructions.filter(i => i.id !== instructionId) 
      } : s
    ));
  };

  const updateInstruction = (serviceId: string, instructionId: string, field: 'fileNaming' | 'special', value: string) => {
    setSelectedServices(selectedServices.map(s => 
      s.id === serviceId ? { 
        ...s, 
        instructions: s.instructions.map(i => 
          i.id === instructionId ? { ...i, [field]: value } : i
        ) 
      } : s
    ));
  };

  const addExportType = (serviceId: string) => {
    setSelectedServices(selectedServices.map(s => 
      s.id === serviceId ? { 
        ...s, 
        exportTypes: [...s.exportTypes, { id: Date.now().toString(), format: '', requirements: '' }] 
      } : s
    ));
  };

  const removeExportType = (serviceId: string, exportId: string) => {
    setSelectedServices(selectedServices.map(s => 
      s.id === serviceId ? { 
        ...s, 
        exportTypes: s.exportTypes.filter(e => e.id !== exportId) 
      } : s
    ));
  };

  const updateExportType = (serviceId: string, exportId: string, field: 'format' | 'requirements', value: string) => {
    setSelectedServices(selectedServices.map(s => 
      s.id === serviceId ? { 
        ...s, 
        exportTypes: s.exportTypes.map(e => 
          e.id === exportId ? { ...e, [field]: value } : e
        ) 
      } : s
    ));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, serviceId: string) => {
    const files = Array.from(e.target.files || []);
    setSelectedServices(selectedServices.map(s => 
      s.id === serviceId ? { ...s, files: [...s.files, ...files] } : s
    ));
  };

  const handleDrop = (e: React.DragEvent, serviceId: string) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/') ||
      file.type === 'video/mp4' ||
      file.type === 'video/quicktime' ||
      file.name.toLowerCase().endsWith('.mp4') ||
      file.name.toLowerCase().endsWith('.mov')
    );
    setSelectedServices(selectedServices.map(s => 
      s.id === serviceId ? { ...s, files: [...s.files, ...files] } : s
    ));
  };

  const calculateTotal = () => {
    const serviceTotal = selectedServices.reduce((sum, service) => 
      sum + (service.price * service.quantity), 0
    );
    const serviceFee = serviceTotal * 0.1; // 10% service fee
    return { serviceTotal, serviceFee, total: serviceTotal + serviceFee };
  };

  const handleSubmit = () => {
    if (!userData?.partnerId) {
      toast({
        title: "Authentication Error",
        description: "User partner ID not found. Please log in again.",
        variant: "destructive",
      });
      return;
    }

    if (!acceptTerms) {
      toast({
        title: "Terms Required",
        description: "Please accept the terms of service to continue.",
        variant: "destructive",
      });
      return;
    }

    const { total } = calculateTotal();
    const selectedJobObj = sortedJobs.find((j: any) => j.id === selectedJob);
    const orderPayload = {
      partnerId: userData.partnerId,
      jobId: selectedJob || null,
      customerId: selectedJobObj?.customerId ?? null,
      assignedTo: selectedSupplier || null,
      createdBy: userData?.email || "admin",
      estimatedTotal: total.toFixed(2),
      status: "pending",
      // Include selected services configuration
      services: selectedServices.map(service => ({
        id: service.id,
        name: service.name,
        quantity: service.quantity,
        price: service.price,
        instructions: service.instructions,
        exportTypes: service.exportTypes,
        files: service.files.map(file => file.name)
      }))
    };

    createOrderMutation.mutate(orderPayload);
  };

  const { serviceTotal, serviceFee, total } = calculateTotal();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 modal-backdrop z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Upload to Editors</h2>
            <p className="text-sm text-gray-500 mt-1">
              Send your media files to professional editors for post-production services
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            data-testid="button-close-modal"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Step 1: Job Selection */}
            {currentStep === 'job' && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin className="w-5 h-5 text-orange-500" />
                    <h3 className="text-lg font-semibold text-gray-900">Job</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">Choose a job for your finished asset placement</p>
                  
                  <Select value={selectedJob} onValueChange={setSelectedJob}>
                    <SelectTrigger className="border-gray-300" data-testid="select-job">
                      <SelectValue placeholder="Select a job" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedJobs.map((job: any) => (
                        <SelectItem key={job.id} value={job.id}>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="font-medium">{job.address?.split(',')[0] || job.address}</div>
                              <div className="text-xs text-gray-500">{job.address}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 className="w-5 h-5 text-orange-500" />
                    <h3 className="text-lg font-semibold text-gray-900">Supplier</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">Select the supplier who will be responsible for this order</p>
                  
                  <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                    <SelectTrigger className="border-gray-300" data-testid="select-supplier">
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier: any) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="font-medium">{supplier.studioName}</div>
                              <div className="text-xs text-gray-500">{supplier.email}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 2: Service Selection */}
            {currentStep === 'services' && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-orange-500" />
                  <h3 className="text-lg font-semibold text-gray-900">Select Services</h3>
                </div>
                <p className="text-sm text-gray-500 mb-6">Click on services to add them to your order</p>
                
                {availableServices.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>No services available. Please select a supplier first.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {availableServices.map((service) => {
                    const isSelected = selectedServices.find(s => s.id === service.id);
                    const Icon = service.icon;
                    
                    return (
                      <div
                        key={service.id}
                        onClick={() => toggleService(service)}
                        className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all ${
                          isSelected 
                            ? `${service.borderColor} ${service.iconBg}` 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        data-testid={`service-card-${service.id}`}
                      >
                        {isSelected && (
                          <div className="absolute top-3 right-3 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                            <ChevronRight className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div className="flex items-start gap-3">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${service.iconColor}`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{service.name}</h4>
                            <p className="text-sm text-gray-500">{service.description}</p>
                            <p className="text-lg font-semibold text-orange-500 mt-2">${service.price.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            )}

            {/* Step 3: Configure Services */}
            {currentStep === 'configure' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Configure Services</h3>
                  <p className="text-sm text-gray-500 mb-6">Upload files and set preferences for each service</p>
                  
                  {selectedServices.map((service) => {
                    const Icon = service.icon;
                    return (
                      <div key={service.id} className="mb-6 border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${service.iconColor}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className="font-medium text-gray-900">{service.name}</span>
                            <X 
                              className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-pointer" 
                              onClick={() => toggleService(service)}
                            />
                          </div>
                        </div>
                        
                        <div className="p-4 space-y-4">
                          {/* Upload Files */}
                          <div>
                            <label className="block text-sm font-medium text-gray-900 mb-2">Upload Files</label>
                            <div>
                              <div
                                onDrop={(e) => handleDrop(e, service.id)}
                                onDragOver={(e) => e.preventDefault()}
                                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
                              >
                                <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                  <UploadIcon className="w-6 h-6 text-orange-500" />
                                </div>
                                <p className="text-sm text-gray-600 mb-1">Click to upload files or drag and drop</p>
                                <p className="text-xs text-gray-500">JPG, PNG, RAW, TIFF, MP4, or MOV files</p>
                                <input
                                  type="file"
                                  multiple
                                  accept="image/*,video/mp4,video/quicktime,.mp4,.mov,.MOV"
                                  onChange={(e) => handleFileUpload(e, service.id)}
                                  className="hidden"
                                  id={`file-upload-${service.id}`}
                                />
                                <label htmlFor={`file-upload-${service.id}`} className="cursor-pointer inline-block mt-2">
                                  <div className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
                                    Browse Files
                                  </div>
                                </label>
                              </div>
                              {service.files.length > 0 && (
                                <div className="mt-3 space-y-1">
                                  {service.files.map((file, idx) => (
                                    <div key={idx} className="text-xs text-gray-600 flex items-center gap-2">
                                      <FileText className="w-3 h-3" />
                                      <span>{file.name}</span>
                                      <span className="text-gray-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Quantity */}
                          <div>
                            <label className="block text-sm font-medium text-gray-900 mb-2">Quantity</label>
                            <div className="flex items-center gap-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateServiceQuantity(service.id, -1)}
                                disabled={service.quantity <= 1}
                              >
                                <Minus className="w-4 h-4" />
                              </Button>
                              <Input
                                type="number"
                                value={service.quantity}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 1;
                                  setSelectedServices(selectedServices.map(s => 
                                    s.id === service.id ? { ...s, quantity: Math.max(1, val) } : s
                                  ));
                                }}
                                className="w-20 text-center"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateServiceQuantity(service.id, 1)}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                              <span className="text-sm text-gray-500">Expected files to be delivered</span>
                            </div>
                          </div>

                          {/* Instructions */}
                          <div>
                            <label className="block text-sm font-medium text-gray-900 mb-2">Instructions</label>
                            <p className="text-xs text-gray-500 mb-3">Provide detailed guidance to help your supplier deliver the expected results</p>
                            
                            {service.instructions.map((instruction) => (
                              <div key={instruction.id} className="grid grid-cols-2 gap-2 mb-2">
                                <Input
                                  placeholder="File naming convention"
                                  value={instruction.fileNaming}
                                  onChange={(e) => updateInstruction(service.id, instruction.id, 'fileNaming', e.target.value)}
                                  className="bg-gray-50"
                                />
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="Special instructions"
                                    value={instruction.special}
                                    onChange={(e) => updateInstruction(service.id, instruction.id, 'special', e.target.value)}
                                    className="bg-gray-50 flex-1"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeInstruction(service.id, instruction.id)}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => addInstruction(service.id)}
                              className="mt-2"
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Add Instruction Row
                            </Button>
                          </div>

                          {/* Export Types */}
                          <div>
                            <label className="block text-sm font-medium text-gray-900 mb-2">Export Types</label>
                            <p className="text-xs text-gray-500 mb-3">Specify output format and quality requirements</p>
                            
                            {service.exportTypes.map((exportType) => (
                              <div key={exportType.id} className="grid grid-cols-2 gap-2 mb-2">
                                <Select
                                  value={exportType.format}
                                  onValueChange={(value) => updateExportType(service.id, exportType.id, 'format', value)}
                                >
                                  <SelectTrigger className="bg-gray-50">
                                    <SelectValue placeholder="Choose Export Type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="jpeg_high">JPEG (High Quality)</SelectItem>
                                    <SelectItem value="png">PNG</SelectItem>
                                    <SelectItem value="tiff">TIFF</SelectItem>
                                    <SelectItem value="raw">RAW</SelectItem>
                                  </SelectContent>
                                </Select>
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="Additional requirements"
                                    value={exportType.requirements}
                                    onChange={(e) => updateExportType(service.id, exportType.id, 'requirements', e.target.value)}
                                    className="bg-gray-50 flex-1"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeExportType(service.id, exportType.id)}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => addExportType(service.id)}
                              className="mt-2"
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Add Export Type
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="w-80 bg-gray-50 border-l border-gray-200 p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
            
            <div className="flex-1 space-y-4 mb-6">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Service</p>
                {selectedServices.length === 0 ? (
                  <p className="text-sm text-gray-500">No services selected</p>
                ) : (
                  selectedServices.map((service) => (
                    <div key={service.id} className="flex justify-between text-sm mb-2">
                      <div>
                        <p className="font-medium text-gray-900">{service.name}</p>
                        <p className="text-xs text-gray-500">Quantity: {service.quantity} x 1</p>
                      </div>
                      <p className="font-medium text-gray-900">${(service.price * service.quantity).toFixed(2)}</p>
                    </div>
                  ))
                )}
              </div>

              {selectedServices.length > 0 && (
                <>
                  <div className="border-t border-gray-200 pt-3">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Service fee</span>
                      <span className="text-gray-900">${serviceFee.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-3">
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-900">Total estimated cost</span>
                      <span className="font-bold text-orange-500 text-lg">${total.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="accept-terms"
                  checked={acceptTerms}
                  onCheckedChange={(checked) => setAcceptTerms(!!checked)}
                  className="mt-0.5"
                />
                <label htmlFor="accept-terms" className="text-sm text-gray-600">
                  I accept the <span className="text-orange-500">terms of service</span> and understand the{' '}
                  <span className="text-orange-500">billing process</span>
                </label>
              </div>

              <Button
                onClick={() => {
                  if (currentStep === 'job' && selectedJob && selectedSupplier) {
                    setCurrentStep('services');
                  } else if (currentStep === 'services' && selectedServices.length > 0) {
                    setCurrentStep('configure');
                  } else if (currentStep === 'configure') {
                    handleSubmit();
                  }
                }}
                disabled={
                  (currentStep === 'job' && (!selectedJob || !selectedSupplier)) ||
                  (currentStep === 'services' && selectedServices.length === 0) ||
                  (currentStep === 'configure' && (!acceptTerms || createOrderMutation.isPending))
                }
                className="w-full bg-orange-400 hover:bg-orange-500 text-white"
                data-testid="button-send-order"
              >
                {currentStep === 'configure' 
                  ? (createOrderMutation.isPending ? "Sending..." : "Send order")
                  : "Continue"
                }
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  if (currentStep === 'services') setCurrentStep('job');
                  else if (currentStep === 'configure') setCurrentStep('services');
                  else onClose();
                }}
                className="w-full border-orange-500 text-orange-500 hover:bg-orange-50"
                data-testid="button-cancel"
              >
                {currentStep === 'job' ? 'Cancel' : 'Back'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
