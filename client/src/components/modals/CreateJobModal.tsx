import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import GoogleMapEmbed from "@/components/GoogleMapEmbed";
import { useAuth } from "@/contexts/AuthContext";
import CreateProductModal from "./CreateProductModal";
import { format } from "date-fns";
import {
  CalendarIcon,
  MapPin,
  User,
  X,
  Clock,
  Plus,
  Loader2,
  Mail,
  Phone,
  DollarSign,
  Camera
} from "lucide-react";

// Extend Window interface for Google Maps
declare global {
  interface Window {
    google?: typeof google;
  }
}

interface CreateJobModalProps {
  onClose: () => void;
  initialCustomerId?: string;
}

interface ProductVariation {
  name: string;
  price: number;
  appointmentDuration?: number;
  noCharge?: boolean;
}

interface Product {
  id: string;
  title: string;
  description: string;
  price: string;
  taxRate: string;
  type: string;
  category: string;
  hasVariations?: boolean;
  variations?: string; // JSON string
  appointmentDuration?: number;
}

interface UserType {
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
  variationName?: string;
  duration?: number; // in minutes
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
}

export default function CreateJobModal({ onClose, initialCustomerId }: CreateJobModalProps) {
  // Step state (1-4)
  const [step, setStep] = useState(1);

  // Step 1: Client selection
  const [isNewClient, setIsNewClient] = useState(false);
  const [searchClient, setSearchClient] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newClientData, setNewClientData] = useState({
    firstName: "",
    lastName: "",
    company: "",
    email: "",
    phone: "",
  });

  // Step 2: Property details
  const [address, setAddress] = useState("");

  // Step 3: Services & Schedule
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [appointmentDate, setAppointmentDate] = useState<Date | undefined>(undefined);
  const [appointmentTime, setAppointmentTime] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  // Address autocomplete states
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const autocompleteService = useRef<any>(null);
  const placesService = useRef<any>(null);

  // Product creation modal state
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userData } = useAuth();

  // Fetch data for dropdowns
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  // Fetch booking settings for time slot interval
  const { data: bookingSettings } = useQuery<{ timeSlotInterval?: number }>({
    queryKey: ["/api/booking/settings"],
  });

  // Get time slot interval from settings (default to 30 minutes)
  const timeSlotInterval = bookingSettings?.timeSlotInterval || 30;

  // Pre-select customer if initialCustomerId is provided
  useEffect(() => {
    if (initialCustomerId && customers.length > 0) {
      const customer = customers.find(c => c.id === initialCustomerId);
      if (customer) {
        setSelectedCustomer(customer);
      }
    }
  }, [initialCustomerId, customers]);

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

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
    if (!apiKey) return;

    if (window.google && window.google.maps && window.google.maps.places) {
      initGooglePlaces();
    } else {
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
      componentRestrictions: { country: 'au' },
      types: ['address']
    };

    autocompleteService.current.getPlacePredictions(request, (predictions: any[], status: any) => {
      setIsLoadingPlaces(false);

      if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
        setAddressSuggestions(predictions.slice(0, 5));
        setShowSuggestions(true);
      } else {
        setAddressSuggestions([]);
        setShowSuggestions(false);
      }
    });
  };

  const handleAddressSelect = (prediction: any) => {
    setAddress(prediction.description);
    setShowSuggestions(false);
    setAddressSuggestions([]);
  };

  // Filter customers by search
  const filteredCustomers = customers.filter(
    (customer) =>
      `${customer.firstName} ${customer.lastName}`.toLowerCase().includes(searchClient.toLowerCase()) ||
      (customer.company || "").toLowerCase().includes(searchClient.toLowerCase())
  );

  // Handle adding a product
  const handleAddProduct = (value: string) => {
    const [productId, variationIndex] = value.split(':');
    const product = products.find(p => p.id === productId);

    if (product) {
      let productTitle = product.title;
      let productPrice = parseFloat(product.price);
      let variationName: string | undefined;
      let duration = product.appointmentDuration || 60;

      if (variationIndex !== undefined && product.variations) {
        const variations: ProductVariation[] = JSON.parse(product.variations);
        const variation = variations[parseInt(variationIndex)];

        if (variation) {
          productTitle = `${product.title} - ${variation.name}`;
          productPrice = variation.noCharge ? 0 : variation.price;
          variationName = variation.name;
          duration = variation.appointmentDuration || duration;
        }
      }

      const existingProduct = selectedProducts.find(
        p => p.id === productId && p.variationName === variationName
      );

      if (existingProduct) {
        setSelectedProducts(prev =>
          prev.map(p =>
            p.id === productId && p.variationName === variationName
              ? { ...p, quantity: p.quantity + 1 }
              : p
          )
        );
      } else {
        setSelectedProducts(prev => [...prev, {
          id: productId,
          title: productTitle,
          price: productPrice,
          quantity: 1,
          taxRate: parseFloat(product.taxRate),
          variationName,
          duration
        }]);
      }
    }
  };

  const removeProduct = (productId: string, variationName?: string) => {
    setSelectedProducts(prev => prev.filter(p => !(p.id === productId && p.variationName === variationName)));
  };

  // Calculate totals
  const calculateTotal = () => {
    return selectedProducts.reduce((total, product) => {
      return total + product.price * product.quantity;
    }, 0);
  };

  const calculateTotalDuration = () => {
    return selectedProducts.reduce((total, product) => {
      return total + (product.duration || 60) * product.quantity;
    }, 0);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${mins}m`;
    }
  };

  // Validation
  const canProceed = () => {
    if (step === 1) {
      if (isNewClient) {
        return newClientData.firstName.trim() && newClientData.email.trim();
      }
      return selectedCustomer !== null;
    }
    if (step === 2) {
      return address.trim().length > 0;
    }
    if (step === 3) {
      return selectedProducts.length > 0 && appointmentDate !== undefined && appointmentTime.trim().length > 0;
    }
    if (step === 4) {
      return true;
    }
    return false;
  };

  // Navigation
  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  // Create job mutation
  const createJobMutation = useMutation({
    mutationFn: async (jobData: any) => {
      const { auth } = await import("@/lib/firebase");
      const token = await auth.currentUser?.getIdToken();
      
      if (!token) {
        throw new Error("You must be logged in to create a job");
      }

      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
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
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
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

  const handleSubmit = () => {
    const appointmentDateTime = appointmentDate && appointmentTime 
      ? `${format(appointmentDate, 'yyyy-MM-dd')}T${appointmentTime}:00`
      : undefined;

    const customerId = isNewClient ? undefined : selectedCustomer?.id;

    const jobData = {
      partnerId: userData?.partnerId || "partner_192l9bh1xmduwueha",
      address: address.trim(),
      customerId: customerId && customerId !== "none" ? customerId : undefined,
      appointmentDate: appointmentDateTime,
      notes: specialInstructions.trim() || undefined,
      totalValue: calculateTotal().toFixed(2),
      products: selectedProducts.map(p => ({
        id: p.id,
        title: p.title,
        quantity: p.quantity,
        variationName: p.variationName
      })),
      // If new client, include client data for creation
      newClient: isNewClient ? {
        firstName: newClientData.firstName,
        lastName: newClientData.lastName,
        email: newClientData.email,
        phone: newClientData.phone || undefined,
        company: newClientData.company || undefined,
      } : undefined,
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
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 bg-white rounded-lg">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Create New Job</DialogTitle>
                <DialogDescription className="mt-1">
                  {step === 1 && "Choose or add a client for this job"}
                  {step === 2 && "Enter property details and location"}
                  {step === 3 && "Select services and schedule appointment"}
                  {step === 4 && "Review and confirm job details"}
                </DialogDescription>
              </div>
              <Badge variant="secondary" className="text-xs px-2.5 py-1">
                Step {step} of 4
              </Badge>
            </div>

            {/* Progress indicator */}
            <div className="flex gap-2 mt-4">
              <div className={`h-1 flex-1 rounded-full ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
              <div className={`h-1 flex-1 rounded-full ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
              <div className={`h-1 flex-1 rounded-full ${step >= 3 ? "bg-primary" : "bg-muted"}`} />
              <div className={`h-1 flex-1 rounded-full ${step >= 4 ? "bg-primary" : "bg-muted"}`} />
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted [&::-webkit-scrollbar-thumb]:rounded-full">
            {/* Step 1: Client Selection */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-full">
                  <Button
                    variant={isNewClient ? "ghost" : "default"}
                    size="sm"
                    onClick={() => setIsNewClient(false)}
                    className={cn(
                      "rounded-full flex-1 h-10",
                      !isNewClient && "bg-primary text-primary-foreground shadow-sm"
                    )}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Existing Client
                  </Button>
                  <Button
                    variant={isNewClient ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setIsNewClient(true)}
                    className={cn(
                      "rounded-full flex-1 h-10",
                      isNewClient && "bg-primary text-primary-foreground shadow-sm"
                    )}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Client
                  </Button>
                </div>

                {!isNewClient ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="search-client">Search Client *</Label>
                      <Input
                        id="search-client"
                        placeholder="Search by name or company..."
                        value={searchClient}
                        onChange={(e) => setSearchClient(e.target.value)}
                        className="rounded-xl h-11 bg-muted/50"
                      />
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {filteredCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => setSelectedCustomer(customer)}
                          className={cn(
                            "w-full p-4 rounded-xl border-2 transition-all text-left",
                            selectedCustomer?.id === customer.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50 bg-background"
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium">
                                {customer.firstName} {customer.lastName}
                              </p>
                              {customer.company && (
                                <p className="text-sm text-muted-foreground">{customer.company}</p>
                              )}
                              <div className="flex items-center gap-4 mt-2">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {customer.email}
                                </span>
                                {customer.phone && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {customer.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                      {filteredCustomers.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No customers found. Try a different search or create a new client.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="client-first-name">First Name *</Label>
                        <Input
                          id="client-first-name"
                          placeholder="John"
                          value={newClientData.firstName}
                          onChange={(e) => setNewClientData({ ...newClientData, firstName: e.target.value })}
                          className="rounded-xl h-11 bg-muted/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="client-last-name">Last Name</Label>
                        <Input
                          id="client-last-name"
                          placeholder="Smith"
                          value={newClientData.lastName}
                          onChange={(e) => setNewClientData({ ...newClientData, lastName: e.target.value })}
                          className="rounded-xl h-11 bg-muted/50"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="client-company">Company</Label>
                      <Input
                        id="client-company"
                        placeholder="Smith Realty"
                        value={newClientData.company}
                        onChange={(e) => setNewClientData({ ...newClientData, company: e.target.value })}
                        className="rounded-xl h-11 bg-muted/50"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="client-email">Email Address *</Label>
                      <Input
                        id="client-email"
                        type="email"
                        placeholder="john@smithrealty.com"
                        value={newClientData.email}
                        onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                        className="rounded-xl h-11 bg-muted/50"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="client-phone">Phone Number</Label>
                      <Input
                        id="client-phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={newClientData.phone}
                        onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                        className="rounded-xl h-11 bg-muted/50"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Property Details */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address" className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      Property Address *
                    </Label>
                    <div className="relative">
                      <Input
                        id="address"
                        placeholder="Start typing address..."
                        value={address}
                        onChange={(e) => handleAddressChange(e.target.value)}
                        onFocus={() => address.trim() && addressSuggestions.length > 0 && setShowSuggestions(true)}
                        className="rounded-xl h-11 bg-muted/50"
                        data-testid="input-address"
                        autoComplete="off"
                      />
                      
                      {/* Address Suggestions Dropdown */}
                      {showSuggestions && (addressSuggestions.length > 0 || isLoadingPlaces) && (
                        <div className="address-suggestions absolute top-full left-0 right-0 bg-background border border-border rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto mt-1">
                          {isLoadingPlaces ? (
                            <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Searching addresses...
                            </div>
                          ) : (
                            addressSuggestions.map((prediction) => (
                              <button
                                key={prediction.place_id}
                                type="button"
                                className="w-full text-left p-3 hover:bg-muted border-b border-border last:border-b-0 transition-colors"
                                onClick={() => handleAddressSelect(prediction)}
                              >
                                <div className="flex items-start space-x-2">
                                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                  <div>
                                    <div className="text-sm font-medium">
                                      {prediction.structured_formatting.main_text}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
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
                    <p className="text-xs text-muted-foreground mt-2">
                      Address will be validated with Google Maps
                    </p>
                  </div>

                  {/* Google Maps Preview */}
                  {address && address.trim() && (
                    <div className="mt-4 rounded-xl overflow-hidden border border-border">
                      <GoogleMapEmbed address={address} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Services & Schedule */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label htmlFor="service-select" className="flex items-center gap-2">
                        <Camera className="w-4 h-4 text-primary" />
                        Select Services *
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCreateProductModal(true)}
                        className="rounded-xl"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create New Service
                      </Button>
                    </div>
                    <Select onValueChange={handleAddProduct}>
                      <SelectTrigger id="service-select" className="rounded-xl h-11 bg-muted/50">
                        <SelectValue placeholder="Choose a service to add..." />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => {
                          const hasVariations = product.hasVariations && product.variations;
                          const variations: ProductVariation[] = hasVariations
                            ? JSON.parse(product.variations!)
                            : [];

                          if (hasVariations && variations.length > 0) {
                            return (
                              <div key={product.id}>
                                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground bg-muted/50">
                                  {product.title}
                                </div>
                                {variations.map((variation, index) => {
                                  const isAlreadySelected = selectedProducts.some(
                                    p => p.id === product.id && p.variationName === variation.name
                                  );
                                  return (
                                    <SelectItem
                                      key={`${product.id}-${index}`}
                                      value={`${product.id}:${index}`}
                                      disabled={isAlreadySelected}
                                      className="pl-6"
                                    >
                                      <div className="flex items-center gap-3 py-1">
                                        <span className="text-sm">{variation.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          ${variation.noCharge ? '0.00' : Number(variation.price).toFixed(2)} • {variation.appointmentDuration || 60}m
                                        </span>
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </div>
                            );
                          } else {
                            const isAlreadySelected = selectedProducts.some(p => p.id === product.id && !p.variationName);
                            return (
                              <SelectItem key={product.id} value={product.id} disabled={isAlreadySelected}>
                                <div className="flex items-center gap-3 py-1">
                                  <span className="text-sm">{product.title}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ${Number(product.price).toFixed(2)} • {product.appointmentDuration || 60}m
                                  </span>
                                </div>
                              </SelectItem>
                            );
                          }
                        })}
                      </SelectContent>
                    </Select>

                    {/* Selected Services */}
                    {selectedProducts.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <Label className="text-xs text-muted-foreground">Selected Services:</Label>
                        <div className="space-y-2">
                          {selectedProducts.map((product) => (
                            <div
                              key={`${product.id}-${product.variationName || 'base'}`}
                              className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-xl group hover:bg-primary/10 transition-colors"
                            >
                              <div>
                                <p className="text-sm font-medium">{product.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  ${Number(product.price).toFixed(2)} • {product.duration} minutes
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeProduct(product.id, product.variationName)}
                                className="h-8 w-8 p-0 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-primary" />
                        Shoot Date *
                      </Label>
                      <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left rounded-xl h-11 bg-muted/50",
                              !appointmentDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {appointmentDate ? format(appointmentDate, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={appointmentDate}
                            onSelect={(date) => {
                              setAppointmentDate(date);
                              setDatePopoverOpen(false);
                            }}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="time" className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        Shoot Time *
                      </Label>
                      <Select 
                        value={appointmentTime} 
                        onValueChange={setAppointmentTime}
                        onOpenChange={(open) => {
                          if (open) {
                            // Auto-scroll to current time when opening
                            const scrollToCurrentTime = () => {
                              const now = new Date();
                              const currentMinutes = now.getHours() * 60 + now.getMinutes();
                              // Find the closest time slot within business hours (6am-8pm)
                              let closestSlot = Math.round(currentMinutes / timeSlotInterval) * timeSlotInterval;
                              // Clamp to business hours (360 = 6am, 1200 = 8pm)
                              closestSlot = Math.max(360, Math.min(1200, closestSlot));
                              const hours = Math.floor(closestSlot / 60);
                              const minutes = closestSlot % 60;
                              const time24 = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                              const isPM = hours >= 12;
                              const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
                              const displayTime = `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
                              
                              // Calculate the index of the target time slot
                              const startMinutes = 360; // 6:00 AM
                              const targetIndex = Math.floor((closestSlot - startMinutes) / timeSlotInterval);
                              
                              // Find the viewport container
                              const viewport = document.querySelector('[data-radix-select-viewport]') as HTMLElement;
                              if (!viewport) return;
                              
                              // Method 1: Find by text content (most reliable for Radix Select)
                              const items = viewport.querySelectorAll('[role="option"]');
                              let found = false;
                              
                              for (const item of items) {
                                const text = item.textContent?.trim();
                                if (text === displayTime) {
                                  item.scrollIntoView({ block: 'center', behavior: 'smooth' });
                                  found = true;
                                  break;
                                }
                              }
                              
                              // Method 2: If not found by text, try by index
                              if (!found && items.length > targetIndex) {
                                items[targetIndex].scrollIntoView({ block: 'center', behavior: 'smooth' });
                                found = true;
                              }
                              
                              // Method 3: Fallback - scroll viewport directly to calculated position
                              if (!found && viewport) {
                                const itemHeight = items[0]?.getBoundingClientRect().height || 36;
                                const scrollPosition = targetIndex * itemHeight - viewport.clientHeight / 2 + itemHeight / 2;
                                viewport.scrollTo({ top: Math.max(0, scrollPosition), behavior: 'smooth' });
                              }
                            };
                            
                            // Use multiple attempts with increasing delays to ensure DOM is ready
                            requestAnimationFrame(() => {
                              setTimeout(scrollToCurrentTime, 100);
                              setTimeout(scrollToCurrentTime, 250);
                              setTimeout(scrollToCurrentTime, 400);
                            });
                          }
                        }}
                      >
                        <SelectTrigger id="time" className="rounded-xl h-11 bg-muted/50">
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {/* Generate time slots based on timeSlotInterval from settings */}
                          {(() => {
                            const slots = [];
                            // Start at 6:00 AM (360 minutes), end at 8:00 PM (1200 minutes)
                            for (let mins = 360; mins <= 1200; mins += timeSlotInterval) {
                              const hours = Math.floor(mins / 60);
                              const minutes = mins % 60;
                              const time24 = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                              const isPM = hours >= 12;
                              const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
                              const displayTime = `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
                              slots.push(
                                <SelectItem key={time24} value={time24}>
                                  {displayTime}
                                </SelectItem>
                              );
                            }
                            return slots;
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="instructions">Special Instructions</Label>
                    <Textarea
                      id="instructions"
                      placeholder="Any specific requirements, angles, or details to capture..."
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      className="rounded-xl resize-none bg-muted/50 min-h-[100px]"
                    />
                  </div>

                  {selectedProducts.length > 0 && (
                    <div className="p-4 bg-muted rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium">Order Summary</span>
                        <span className="text-sm text-muted-foreground">
                          {selectedProducts.length} service{selectedProducts.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {selectedProducts.map((product) => (
                          <div key={`summary-${product.id}-${product.variationName || 'base'}`} className="flex items-center justify-between text-sm">
                            <span>{product.title}</span>
                            <span className="font-medium">${Number(product.price).toFixed(2)}</span>
                          </div>
                        ))}
                        <Separator className="my-2" />
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Estimated Duration</span>
                          <span className="text-sm font-medium">{formatDuration(calculateTotalDuration())}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex items-center justify-between font-medium">
                          <span>Total</span>
                          <span className="text-primary text-lg">${calculateTotal().toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Summary */}
            {step === 4 && (
              <div className="space-y-6">
                {/* Client Info */}
                <div className="p-5 bg-background rounded-xl border border-border">
                  <div className="flex items-center gap-2 mb-4">
                    <User className="w-5 h-5 text-primary" />
                    <span className="font-medium">Client Information</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    {isNewClient ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Name</span>
                          <span className="font-medium">
                            {newClientData.firstName} {newClientData.lastName}
                          </span>
                        </div>
                        {newClientData.company && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Company</span>
                            <span className="font-medium">{newClientData.company}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email</span>
                          <span className="font-medium">{newClientData.email}</span>
                        </div>
                        {newClientData.phone && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Phone</span>
                            <span className="font-medium">{newClientData.phone}</span>
                          </div>
                        )}
                      </>
                    ) : selectedCustomer ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Name</span>
                          <span className="font-medium">
                            {selectedCustomer.firstName} {selectedCustomer.lastName}
                          </span>
                        </div>
                        {selectedCustomer.company && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Company</span>
                            <span className="font-medium">{selectedCustomer.company}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email</span>
                          <span className="font-medium">{selectedCustomer.email}</span>
                        </div>
                        {selectedCustomer.phone && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Phone</span>
                            <span className="font-medium">{selectedCustomer.phone}</span>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Property Info */}
                <div className="p-5 bg-background rounded-xl border border-border">
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin className="w-5 h-5 text-primary" />
                    <span className="font-medium">Property Details</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Address</span>
                      <span className="font-medium text-right max-w-[60%]">{address}</span>
                    </div>
                  </div>
                </div>

                {/* Appointment Info */}
                <div className="p-5 bg-background rounded-xl border border-border">
                  <div className="flex items-center gap-2 mb-4">
                    <CalendarIcon className="w-5 h-5 text-primary" />
                    <span className="font-medium">Appointment Details</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium">
                        {appointmentDate ? format(appointmentDate, "EEEE, MMMM d, yyyy") : "Not set"}
                      </span>
                    </div>
                    {appointmentTime && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Time</span>
                        <span className="font-medium">{appointmentTime}</span>
                      </div>
                    )}
                    {specialInstructions && (
                      <div className="pt-2 border-t border-border mt-2">
                        <span className="text-muted-foreground block mb-1">Special Instructions</span>
                        <span className="text-sm">{specialInstructions}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Services & Pricing */}
                <div className="p-5 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/20">
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="w-5 h-5 text-primary" />
                    <span className="font-medium">Services & Pricing</span>
                  </div>
                  <div className="space-y-3">
                    {selectedProducts.map((product) => (
                      <div key={`final-${product.id}-${product.variationName || 'base'}`} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Camera className="w-4 h-4 text-primary" />
                          </div>
                          <span className="text-sm">{product.title}</span>
                        </div>
                        <span className="font-medium text-sm">${Number(product.price).toFixed(2)}</span>
                      </div>
                    ))}
                    <Separator className="my-3" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Estimated Duration</span>
                      <span className="text-sm font-medium">{formatDuration(calculateTotalDuration())}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <span className="font-medium">Total Cost</span>
                      <span className="text-primary text-2xl font-semibold">${calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-6 py-4 bg-muted/30">
            <div className="flex items-center justify-between gap-4">
              <Button
                variant="outline"
                onClick={step === 1 ? onClose : handleBack}
                className="rounded-xl h-10 px-6"
              >
                {step === 1 ? "Cancel" : "Back"}
              </Button>
              {step < 4 ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="bg-primary hover:bg-primary/90 text-white rounded-xl h-10 px-6"
                >
                  Continue
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceed() || createJobMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-white rounded-xl h-10 px-6"
                >
                  {createJobMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Job"
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Product Modal */}
      {showCreateProductModal && (
        <CreateProductModal onClose={() => setShowCreateProductModal(false)} />
      )}
    </>
  );
}
