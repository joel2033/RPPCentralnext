import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import GoogleMapEmbed from "@/components/GoogleMapEmbed";
import { useAuth } from "@/contexts/AuthContext";
import { 
  CalendarIcon, 
  MapPin, 
  User, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Clock,
  AlertCircle,
  Plus
} from "lucide-react";

interface CreateJobModalProps {
  onClose: () => void;
}

interface Product {
  id: string;
  title: string;
  description: string;
  price: string;
  taxRate: string;
  type: string;
  category: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface SelectedProduct {
  id: string;
  title: string;
  price: number;
  quantity: number;
  taxRate: number;
}

export default function CreateJobModal({ onClose }: CreateJobModalProps) {
  const [address, setAddress] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [appointmentDuration, setAppointmentDuration] = useState("60");
  const [assignedOperators, setAssignedOperators] = useState<string[]>([]);
  const [appointmentNotes, setAppointmentNotes] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [sendConfirmationEmail, setSendConfirmationEmail] = useState(true);
  const [skipAppointment, setSkipAppointment] = useState(false);

  // Address autocomplete states
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const autocompleteService = useRef<any>(null);
  const placesService = useRef<any>(null);

  // Collapsible section states
  const [jobInfoExpanded, setJobInfoExpanded] = useState(true);
  const [appointmentExpanded, setAppointmentExpanded] = useState(false);
  const [orderSummaryExpanded, setOrderSummaryExpanded] = useState(false);

  // Multi-step navigation
  const [currentStep, setCurrentStep] = useState<'job-info' | 'appointment' | 'order-summary'>('job-info');

  // Validation states
  const [validationErrors, setValidationErrors] = useState({
    jobInfo: false,
    appointment: false,
    orderSummary: false
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userData } = useAuth();

  // Initialize Google Places API
  useEffect(() => {
    const initGooglePlaces = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        autocompleteService.current = new window.google.maps.places.AutocompleteService();
        placesService.current = new window.google.maps.places.PlacesService(
          document.createElement('div')
        );
      }
    };

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    // Check if Google Maps is already loaded
    if (window.google && window.google.maps && window.google.maps.places) {
      initGooglePlaces();
    } else {
      // Load Google Maps API if not already loaded
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = initGooglePlaces;
      document.head.appendChild(script);

      return () => {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      };
    }
  }, []);

  // Handle address input change and fetch suggestions
  const handleAddressChange = (value: string) => {
    setAddress(value);
    
    if (!value.trim() || !autocompleteService.current) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoadingPlaces(true);
    
    const request = {
      input: value,
      componentRestrictions: { country: 'au' }, // Restrict to Australia
      types: ['address']
    };

    autocompleteService.current.getPlacePredictions(request, (predictions: any[], status: any) => {
      setIsLoadingPlaces(false);
      
      if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
        setAddressSuggestions(predictions.slice(0, 5)); // Limit to 5 suggestions
        setShowSuggestions(true);
      } else {
        setAddressSuggestions([]);
        setShowSuggestions(false);
      }
    });
  };

  // Handle address selection from suggestions
  const handleAddressSelect = (prediction: any) => {
    setAddress(prediction.description);
    setShowSuggestions(false);
    setAddressSuggestions([]);
  };

  // Fetch data for dropdowns
  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Filter users to only show photographers and partners
  const availableOperators = users.filter(user => 
    user.role === 'photographer' || user.role === 'partner'
  );

  // Validation functions
  const validateJobInfo = () => {
    const hasAddress = address.trim().length > 0;
    return hasAddress;
  };

  const validateAppointment = () => {
    if (skipAppointment) return true;
    const hasOperator = assignedOperators.length > 0;
    const hasProducts = selectedProducts.length > 0;
    return hasOperator && hasProducts;
  };

  const validateOrderSummary = () => {
    return selectedProducts.length > 0;
  };

  // Update validation errors when data changes
  useEffect(() => {
    setValidationErrors({
      jobInfo: !validateJobInfo(),
      appointment: !validateAppointment(),
      orderSummary: !validateOrderSummary()
    });
  }, [address, assignedOperators, selectedProducts, skipAppointment]);

  // Step navigation functions
  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission
    if (currentStep === 'job-info' && validateJobInfo()) {
      setCurrentStep('appointment');
      setJobInfoExpanded(false);
      setAppointmentExpanded(true);
    } else if (currentStep === 'appointment' && validateAppointment()) {
      setCurrentStep('order-summary');
      setAppointmentExpanded(false);
      setOrderSummaryExpanded(true);
    }
  };

  const canProceedToNext = () => {
    if (currentStep === 'job-info') return validateJobInfo();
    if (currentStep === 'appointment') return validateAppointment();
    return false;
  };

  const canSave = () => {
    return validateJobInfo() && validateAppointment() && validateOrderSummary();
  };

  const createJobMutation = useMutation({
    mutationFn: async (jobData: any) => {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(jobData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create job");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Job created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create job",
        variant: "destructive",
      });
    },
  });

  const handleAddProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const existingProduct = selectedProducts.find(p => p.id === productId);
      if (existingProduct) {
        setSelectedProducts(prev => 
          prev.map(p => p.id === productId ? { ...p, quantity: p.quantity + 1 } : p)
        );
      } else {
        setSelectedProducts(prev => [...prev, {
          id: product.id,
          title: product.title,
          price: parseFloat(product.price),
          quantity: 1,
          taxRate: parseFloat(product.taxRate)
        }]);
      }
    }
  };

  const updateProductQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setSelectedProducts(prev => prev.filter(p => p.id !== productId));
    } else {
      setSelectedProducts(prev => 
        prev.map(p => p.id === productId ? { ...p, quantity } : p)
      );
    }
  };

  const calculateOrderTotal = () => {
    return selectedProducts.reduce((total, product) => {
      const subtotal = product.price * product.quantity;
      const tax = subtotal * (product.taxRate / 100);
      return total + subtotal + tax;
    }, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address.trim()) {
      toast({
        title: "Error",
        description: "Location is required",
        variant: "destructive",
      });
      return;
    }

    const appointmentDateTime = appointmentDate && appointmentTime 
      ? `${appointmentDate}T${appointmentTime}:00`
      : undefined;

    const jobData = {
      partnerId: userData?.partnerId || "partner_192l9bh1xmduwueha",
      address: address.trim(),
      customerId: customerId && customerId !== "none" ? customerId : undefined,
      appointmentDate: appointmentDateTime,
      assignedTo: assignedOperators.length > 0 ? assignedOperators[0] : undefined,
      notes: appointmentNotes.trim() || undefined,
      totalValue: calculateOrderTotal().toFixed(2),
    };

    createJobMutation.mutate(jobData);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-testid="input-address"]') && !target.closest('.address-suggestions')) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">New Job</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
              data-testid="button-close-modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription className="text-sm text-rpp-grey-light">
            Create a job for any customer, specifying a location, optional appointment(s), and order details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Job Information Section */}
          <Collapsible open={jobInfoExpanded} onOpenChange={setJobInfoExpanded}>
            <CollapsibleTrigger 
              className="flex items-center justify-between w-full p-3 bg-rpp-grey-bg hover:bg-rpp-grey-border rounded-lg transition-colors" 
              data-testid="toggle-job-info"
              onClick={() => setCurrentStep('job-info')}
            >
              <span className={`font-medium ${validationErrors.jobInfo ? 'text-rpp-red-main' : 'text-rpp-grey-dark'}`}>
                Job Information
              </span>
              {jobInfoExpanded ? (
                <ChevronUp className="h-4 w-4 text-rpp-grey-light" />
              ) : (
                <ChevronDown className="h-4 w-4 text-rpp-grey-light" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 p-3">
              {/* Customer Selection */}
              <div className="space-y-2">
                <Label htmlFor="customer">Customer</Label>
                <div className="flex space-x-2">
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger className="flex-1" data-testid="select-customer">
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No customer</SelectItem>
                      {customers.map((customer: any) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.firstName} {customer.lastName}
                          {customer.company && ` (${customer.company})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="sm" data-testid="button-create-customer">
                    Create
                  </Button>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="address">Location</Label>
                  <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs">
                    Switch to Job Name
                  </Button>
                </div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-rpp-grey-light z-10" />
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => handleAddressChange(e.target.value)}
                    onFocus={() => address.trim() && addressSuggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="Start typing to find a location..."
                    className="pl-10"
                    required
                    data-testid="input-address"
                    autoComplete="off"
                  />
                  
                  {/* Address Suggestions Dropdown */}
                  {showSuggestions && (addressSuggestions.length > 0 || isLoadingPlaces) && (
                    <div className="address-suggestions absolute top-full left-0 right-0 bg-white border border-rpp-grey-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                      {isLoadingPlaces ? (
                        <div className="p-3 text-sm text-rpp-grey-light">
                          Searching addresses...
                        </div>
                      ) : (
                        addressSuggestions.map((prediction) => (
                          <button
                            key={prediction.place_id}
                            type="button"
                            className="w-full text-left p-3 hover:bg-rpp-grey-bg border-b border-rpp-grey-border last:border-b-0 transition-colors"
                            onClick={() => handleAddressSelect(prediction)}
                            data-testid={`address-suggestion-${prediction.place_id}`}
                          >
                            <div className="flex items-start space-x-2">
                              <MapPin className="w-4 h-4 text-rpp-grey-light mt-0.5 flex-shrink-0" />
                              <div>
                                <div className="text-sm font-medium text-rpp-grey-dark">
                                  {prediction.structured_formatting.main_text}
                                </div>
                                <div className="text-xs text-rpp-grey-light">
                                  {prediction.structured_formatting.secondary_text}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-rpp-grey-light">
                  Address won't show? <Button type="button" variant="link" className="h-auto p-0 text-xs">Enter manually</Button>
                </p>
                
                {/* Google Maps Preview */}
                {address && address.trim() && (
                  <div className="mt-3">
                    <GoogleMapEmbed address={address} height="200px" />
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Appointment Details Section */}
          <Collapsible open={appointmentExpanded} onOpenChange={setAppointmentExpanded}>
            <CollapsibleTrigger 
              className="flex items-center justify-between w-full p-3 bg-rpp-grey-bg hover:bg-rpp-grey-border rounded-lg transition-colors" 
              data-testid="toggle-appointment-details"
              onClick={() => setCurrentStep('appointment')}
            >
              <span className={`font-medium ${validationErrors.appointment ? 'text-rpp-red-main' : 'text-rpp-grey-dark'}`}>
                Appointment Details
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSkipAppointment(!skipAppointment);
                  }}
                  data-testid="button-skip-appointment"
                >
                  Skip Appointment
                </Button>
                {appointmentExpanded ? (
                  <ChevronUp className="h-4 w-4 text-rpp-grey-light" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-rpp-grey-light" />
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 p-3">
              {!skipAppointment && (
                <>
                  <p className="text-sm text-rpp-grey-light">
                    Schedule one or multiple service visit appointments for this job.
                  </p>

                  {/* Assign Operators */}
                  <div className="space-y-2">
                    <Label>Assign operator(s)</Label>
                    <Select 
                      value={assignedOperators[0] || ""} 
                      onValueChange={(value) => setAssignedOperators(value ? [value] : [])}
                    >
                      <SelectTrigger data-testid="select-operators">
                        <SelectValue placeholder="Add yourself or other team members" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableOperators.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName} ({user.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {assignedOperators.length === 0 && (
                      <div className="flex items-center space-x-2 text-sm text-rpp-red-main">
                        <AlertCircle className="w-4 h-4" />
                        <span>You must add at least one operator</span>
                      </div>
                    )}
                  </div>

                  {/* Date and Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Timezone</Label>
                      <Select defaultValue="utc+10">
                        <SelectTrigger data-testid="select-timezone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="utc+10">(UTC+10:00) Canberra...</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Select a day</Label>
                      <Input
                        type="date"
                        value={appointmentDate}
                        onChange={(e) => setAppointmentDate(e.target.value)}
                        data-testid="input-appointment-date"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Set a start time</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-rpp-grey-light" />
                        <Input
                          type="time"
                          value={appointmentTime}
                          onChange={(e) => setAppointmentTime(e.target.value)}
                          className="pl-10"
                          data-testid="input-appointment-time"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Add duration</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="number"
                          value={appointmentDuration}
                          onChange={(e) => setAppointmentDuration(e.target.value)}
                          className="w-20"
                          data-testid="input-duration"
                        />
                        <span className="text-sm text-rpp-grey-light">Minutes</span>
                      </div>
                      <Button type="button" variant="link" className="h-auto p-0 text-xs">
                        Manually set duration
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* Products Section */}
              <div className="space-y-2">
                <Label>Products</Label>
                <div className="flex space-x-2">
                  <Select onValueChange={handleAddProduct}>
                    <SelectTrigger className="flex-1" data-testid="select-products">
                      <SelectValue placeholder="Select product/s" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.title} - ${product.price}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="sm" data-testid="button-create-product">
                    Create
                  </Button>
                </div>
                {selectedProducts.length === 0 && (
                  <div className="flex items-center space-x-2 text-sm text-rpp-red-main">
                    <AlertCircle className="w-4 h-4" />
                    <span>You must add at least one product</span>
                  </div>
                )}
              </div>

              {/* Appointment Notes */}
              {!skipAppointment && (
                <div className="space-y-2">
                  <Label htmlFor="appointmentNotes">Write appointment notes</Label>
                  <p className="text-xs text-rpp-grey-light">
                    Notes may be visible to customers if they are included as attendees on Google or Outlook Calendar events
                  </p>
                  <Textarea
                    id="appointmentNotes"
                    value={appointmentNotes}
                    onChange={(e) => setAppointmentNotes(e.target.value)}
                    placeholder="Add notes for this appointment..."
                    rows={3}
                    data-testid="textarea-notes"
                  />
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Order Summary Section */}
          <Collapsible open={orderSummaryExpanded} onOpenChange={setOrderSummaryExpanded}>
            <CollapsibleTrigger 
              className="flex items-center justify-between w-full p-3 bg-rpp-grey-bg hover:bg-rpp-grey-border rounded-lg transition-colors" 
              data-testid="toggle-order-summary"
              onClick={() => setCurrentStep('order-summary')}
            >
              <span className={`font-medium ${validationErrors.orderSummary ? 'text-rpp-red-main' : 'text-rpp-grey-dark'}`}>
                Order Summary
              </span>
              {orderSummaryExpanded ? (
                <ChevronUp className="h-4 w-4 text-rpp-grey-light" />
              ) : (
                <ChevronDown className="h-4 w-4 text-rpp-grey-light" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 p-3">
              <p className="text-sm text-rpp-grey-light">
                Add any extra products to this order. This could be products that do not require an appointment to be provided i.e. digital.
              </p>

              {/* Selected Products List */}
              {selectedProducts.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-5 gap-2 text-sm font-medium text-rpp-grey-dark border-b pb-2">
                    <span>Item</span>
                    <span className="text-center">Qty</span>
                    <span className="text-center">Price</span>
                    <span className="text-center">Tax</span>
                    <span className="text-right">Amount</span>
                  </div>
                  
                  {selectedProducts.map((product) => {
                    const subtotal = product.price * product.quantity;
                    const tax = subtotal * (product.taxRate / 100);
                    const total = subtotal + tax;
                    
                    return (
                      <div key={product.id} className="grid grid-cols-5 gap-2 text-sm items-center" data-testid={`product-row-${product.id}`}>
                        <span className="text-rpp-grey-dark">{product.title}</span>
                        <div className="flex items-center justify-center space-x-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => updateProductQuantity(product.id, product.quantity - 1)}
                            data-testid={`button-decrease-${product.id}`}
                          >
                            -
                          </Button>
                          <span className="w-8 text-center">{product.quantity}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => updateProductQuantity(product.id, product.quantity + 1)}
                            data-testid={`button-increase-${product.id}`}
                          >
                            +
                          </Button>
                        </div>
                        <span className="text-center">${product.price.toFixed(2)}</span>
                        <span className="text-center">${tax.toFixed(2)}</span>
                        <span className="text-right font-medium">${total.toFixed(2)}</span>
                      </div>
                    );
                  })}
                  
                  <div className="border-t pt-2 flex justify-between items-center font-semibold">
                    <span>Total</span>
                    <span data-testid="text-order-total">AUD ${calculateOrderTotal().toFixed(2)}</span>
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Send Confirmation Email */}
          <div className="flex items-center space-x-2 pt-4">
            <Checkbox
              id="sendConfirmationEmail"
              checked={sendConfirmationEmail}
              onCheckedChange={(checked) => setSendConfirmationEmail(checked === true)}
              data-testid="checkbox-confirmation-email"
            />
            <Label htmlFor="sendConfirmationEmail" className="text-sm">
              Send customer confirmation email
            </Label>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
              Cancel
            </Button>
            
            {currentStep !== 'order-summary' ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canProceedToNext()}
                className="bg-rpp-grey-dark hover:bg-rpp-grey-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-next"
              >
                Next
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={createJobMutation.isPending || !canSave()}
                className="bg-rpp-grey-dark hover:bg-rpp-grey-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-save"
              >
                {createJobMutation.isPending ? "Saving..." : "Save"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}