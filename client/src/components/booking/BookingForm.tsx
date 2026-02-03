import { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { BookingServicesStep } from "./BookingServicesStep";
import { BookingScheduleStep } from "./BookingScheduleStep";
import {
  usePublicBookingConfig,
  useTeamAvailability,
  validateBooking,
} from "@/lib/booking";
import type {
  BookingFormData,
  SelectedProduct,
  SelectedAddOn,
  CustomQuestion,
} from "@/lib/booking/types";
import {
  ChevronRight,
  ChevronLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Check,
  CreditCard,
  CheckCircle2,
  User,
  Loader2,
  AlertCircle,
  Building2,
} from "lucide-react";

// Helper to convert 12-hour time (e.g., "9:00 AM") to 24-hour format (e.g., "09:00")
function convertTo24Hour(time: string): string {
  const match = time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return time; // Return original if can't parse
  
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3]?.toUpperCase();
  
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

// Helper to calculate price with tax (GST)
const getPriceWithTax = (price: number, taxRate: number = 10): number => {
  return price * (1 + taxRate / 100);
};

// Customer lookup result
interface CustomerLookupResult {
  found: boolean;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    company: string | null;
  } | null;
}

interface BookingFormProps {
  partnerId: string;
}

const steps = [
  { id: 1, name: "Contact", description: "How can we reach you?" },
  { id: 2, name: "Property", description: "Where is the shoot?" },
  { id: 3, name: "Services", description: "What do you need?" },
  { id: 4, name: "Schedule", description: "When works best?" },
  { id: 5, name: "Review", description: "Review & payment" },
  { id: 6, name: "Confirmation", description: "All set!" },
];

export function BookingForm({ partnerId }: BookingFormProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch booking configuration
  const { data: settings, isLoading: settingsLoading } = usePublicBookingConfig(partnerId);
  const { teamMembers } = useTeamAvailability(partnerId);

  // Customer lookup state
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [customerLookupDone, setCustomerLookupDone] = useState(false);
  const [matchedCustomer, setMatchedCustomer] = useState<CustomerLookupResult["customer"]>(null);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientBlocked, setNewClientBlocked] = useState(false);

  // New client form data
  const [newClientData, setNewClientData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
  });

  // Service area validation state
  const [isValidatingServiceArea, setIsValidatingServiceArea] = useState(false);
  const [serviceAreaValidation, setServiceAreaValidation] = useState<{
    isValid: boolean;
    matchingAreas: { id: string; name: string; color: string }[];
    message: string;
  } | null>(null);

  // Google Places autocomplete state
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const autocompleteService = useRef<any>(null);
  const placesService = useRef<any>(null);

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
  const handleAddressChange = useCallback((value: string) => {
    updateFormData("address", value);

    if (!value.trim() || !autocompleteService.current) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
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

      if (status === (window as any).google.maps.places.PlacesServiceStatus.OK && predictions) {
        setAddressSuggestions(predictions.slice(0, 5));
        setShowAddressSuggestions(true);
      } else {
        setAddressSuggestions([]);
        setShowAddressSuggestions(false);
      }
    });
  }, []);

  // Validate address against service areas (only if restrictToServiceAreas is enabled)
  const validateServiceArea = useCallback(async (latitude: number, longitude: number, address: string) => {
    // Skip validation if service area restrictions are not enabled
    if (!settings?.restrictToServiceAreas) {
      setServiceAreaValidation(null);
      return;
    }
    
    setIsValidatingServiceArea(true);
    setServiceAreaValidation(null);
    
    try {
      const response = await fetch('/api/service-areas/validate-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId,
          latitude,
          longitude,
          address,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to validate service area');
      }
      
      const result = await response.json();
      setServiceAreaValidation(result);
    } catch (error) {
      console.error('Service area validation error:', error);
      // On error, allow the booking to proceed (fail open)
      setServiceAreaValidation({
        isValid: true,
        matchingAreas: [],
        message: 'Unable to validate service area - please proceed',
      });
    } finally {
      setIsValidatingServiceArea(false);
    }
  }, [partnerId, settings?.restrictToServiceAreas]);

  // Handle address selection from suggestions
  const handleAddressSelect = useCallback((prediction: any) => {
    updateFormData("address", prediction.description);
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
    // Reset service area validation when address changes
    setServiceAreaValidation(null);

    // Get place details for coordinates
    if (placesService.current && prediction.place_id) {
      placesService.current.getDetails(
        { placeId: prediction.place_id, fields: ['geometry'] },
        (place: any, status: any) => {
          if (status === (window as any).google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            updateFormData("latitude", lat);
            updateFormData("longitude", lng);
            // Validate the address against service areas
            validateServiceArea(lat, lng, prediction.description);
          }
        }
      );
    }
  }, [validateServiceArea]);

  // Form state
  const [formData, setFormData] = useState<BookingFormData>({
    contact: "",
    contactType: "email",
    address: "",
    selectedProducts: [],
    selectedAddOns: [],
    preferredDate: "",
    preferredTime: "",
    selectedTeamMemberId: undefined,
    customAnswers: {},
    specialInstructions: "",
    paymentMethod: "invoice",
  });

  // Lookup customer by contact info
  const lookupCustomer = useCallback(async (contact: string) => {
    if (!contact.trim()) return;
    
    setIsLookingUp(true);
    setCustomerLookupDone(false);
    setMatchedCustomer(null);
    setShowNewClientForm(false);
    setNewClientBlocked(false);

    try {
      const response = await fetch(
        `/api/booking/customers/lookup?partnerId=${encodeURIComponent(partnerId)}&contact=${encodeURIComponent(contact.trim())}`
      );
      
      if (!response.ok) {
        throw new Error("Lookup failed");
      }

      const result: CustomerLookupResult = await response.json();
      setCustomerLookupDone(true);

      if (result.found && result.customer) {
        setMatchedCustomer(result.customer);
        // Pre-fill new client form in case they need to edit
        setNewClientData({
          firstName: result.customer.firstName,
          lastName: result.customer.lastName,
          email: result.customer.email,
          phone: result.customer.phone || "",
          company: result.customer.company || "",
        });
      } else {
        // Customer not found
        if (settings?.allowNewClients) {
          setShowNewClientForm(true);
          // Pre-fill email or phone based on contact type
          if (formData.contactType === "email") {
            setNewClientData((prev) => ({ ...prev, email: contact }));
          } else {
            setNewClientData((prev) => ({ ...prev, phone: contact }));
          }
        } else {
          // Partner doesn't allow new clients
          setNewClientBlocked(true);
        }
      }
    } catch (error) {
      console.error("Customer lookup failed:", error);
      toast({
        title: "Lookup Error",
        description: "Unable to verify contact. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLookingUp(false);
    }
  }, [partnerId, settings?.allowNewClients, formData.contactType, toast]);

  // Reset customer state when contact changes
  useEffect(() => {
    setCustomerLookupDone(false);
    setMatchedCustomer(null);
    setShowNewClientForm(false);
    setNewClientBlocked(false);
  }, [formData.contact]);

  const updateFormData = <K extends keyof BookingFormData>(
    field: K,
    value: BookingFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Calculate totals (with GST)
  const calculateSubtotal = () => {
    const productsTotal = formData.selectedProducts.reduce(
      (total, product) => total + getPriceWithTax(product.price, product.taxRate) * product.quantity,
      0
    );
    const addOnsTotal = formData.selectedAddOns.reduce(
      (total, addon) => total + getPriceWithTax(addon.price, addon.taxRate),
      0
    );
    return productsTotal + addOnsTotal;
  };

  const calculateDeposit = () => {
    if (!settings?.depositEnabled) return 0;
    const subtotal = calculateSubtotal();
    if (settings.depositType === "percentage") {
      return (subtotal * settings.depositAmount) / 100;
    }
    return Math.min(settings.depositAmount, subtotal);
  };

  const calculateDuration = () => {
    return formData.selectedProducts.reduce(
      (total, product) => total + product.duration * product.quantity,
      0
    );
  };

  // Navigation
  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        // Must have contact and either matched customer OR complete new client form
        if (!formData.contact.length) return false;
        if (newClientBlocked) return false;
        if (!customerLookupDone) return false;
        if (matchedCustomer) return true;
        if (showNewClientForm) {
          // Validate new client form
          return (
            newClientData.firstName.trim() &&
            newClientData.lastName.trim() &&
            newClientData.email.trim()
          );
        }
        return false;
      case 2:
        // Address must be set
        if (formData.address.length === 0) return false;
        // If service area restrictions are enabled, check validation
        if (settings?.restrictToServiceAreas) {
          if (isValidatingServiceArea) return false;
          // If service area validation has been done and it's invalid, block
          if (serviceAreaValidation && !serviceAreaValidation.isValid) return false;
        }
        return true;
      case 3:
        return formData.selectedProducts.length > 0;
      case 4:
        return formData.preferredDate && formData.preferredTime;
      case 5:
        if (settings?.paymentEnabled) {
          return formData.paymentMethod !== "";
        }
        return true;
      default:
        return true;
    }
  };

  // Handle booking submission
  const handleSubmit = async () => {
    if (!settings) return;

    // Validate
    const validation = validateBooking(formData, settings);
    if (!validation.valid) {
      toast({
        title: "Please fix the following errors",
        description: validation.errors.join(", "),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare booking payload
      const bookingPayload: any = {
        partnerId,
        address: formData.address,
        latitude: formData.latitude,
        longitude: formData.longitude,
        appointmentDate: formData.preferredDate,
        // Convert 12-hour time (e.g., "9:00 AM") to 24-hour format for the server
        appointmentTime: convertTo24Hour(formData.preferredTime),
        assignedTo: formData.selectedTeamMemberId,
        products: formData.selectedProducts,
        totalValue: calculateSubtotal(),
        notes: formData.specialInstructions,
        customAnswers: formData.customAnswers,
      };

      // Add customer info
      if (matchedCustomer) {
        bookingPayload.customerId = matchedCustomer.id;
      } else if (showNewClientForm) {
        bookingPayload.newCustomer = {
          firstName: newClientData.firstName,
          lastName: newClientData.lastName,
          email: newClientData.email,
          phone: newClientData.phone || null,
          company: newClientData.company || null,
        };
      }

      // Submit booking to API
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create booking");
      }

      // Move to confirmation step
      nextStep();
    } catch (error: any) {
      toast({
        title: "Booking Failed",
        description: error.message || "Unable to create booking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 1: Contact Information
  const renderContactStep = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-[#f2572c]/20 to-[#f2572c]/10 rounded-2xl flex items-center justify-center">
          <Mail className="w-8 h-8 text-[#f2572c]" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">Let's get started</h2>
        <p className="text-gray-500">
          Enter your contact information to begin your booking
        </p>
      </div>

      <div className="space-y-4 max-w-md mx-auto">
        <div className="flex gap-2">
          <Button
            variant={formData.contactType === "email" ? "default" : "outline"}
            className={`flex-1 rounded-xl ${formData.contactType === "email" ? "bg-[#f2572c] hover:bg-[#d94820]" : ""}`}
            onClick={() => updateFormData("contactType", "email")}
          >
            <Mail className="w-4 h-4 mr-2" />
            Email
          </Button>
          <Button
            variant={formData.contactType === "phone" ? "default" : "outline"}
            className={`flex-1 rounded-xl ${formData.contactType === "phone" ? "bg-[#f2572c] hover:bg-[#d94820]" : ""}`}
            onClick={() => updateFormData("contactType", "phone")}
          >
            <Phone className="w-4 h-4 mr-2" />
            Phone
          </Button>
        </div>

        <div>
          <Label htmlFor="contact">
            {formData.contactType === "email" ? "Email Address" : "Phone Number"}
          </Label>
          <div className="flex gap-2 mt-1.5">
            <Input
              id="contact"
              type={formData.contactType === "email" ? "email" : "tel"}
              placeholder={
                formData.contactType === "email"
                  ? "you@example.com"
                  : "(555) 123-4567"
              }
              value={formData.contact}
              onChange={(e) => updateFormData("contact", e.target.value)}
              className="h-11 rounded-xl flex-1"
            />
            <Button
              type="button"
              onClick={() => lookupCustomer(formData.contact)}
              disabled={!formData.contact.trim() || isLookingUp}
              className="h-11 px-4 rounded-xl bg-[#f2572c] hover:bg-[#d94820]"
            >
              {isLookingUp ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Verify"
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            We'll use this to send you booking confirmation and updates
          </p>
        </div>

        {/* Customer Found */}
        {matchedCustomer && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 animate-in fade-in duration-300">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-900">
                  Welcome back, {matchedCustomer.firstName}!
                </p>
                <p className="text-sm text-green-700 mt-1">
                  {matchedCustomer.email}
                  {matchedCustomer.company && ` • ${matchedCustomer.company}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* New Client Blocked */}
        {newClientBlocked && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 animate-in fade-in duration-300">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">
                  Account Not Found
                </p>
                <p className="text-sm text-red-700 mt-1">
                  We couldn't find an account with this {formData.contactType}. 
                  This business only accepts bookings from existing clients.
                </p>
                <p className="text-sm text-red-700 mt-2">
                  Please contact us directly to set up your account before booking.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* New Client Form */}
        {showNewClientForm && (
          <div className="space-y-4 pt-4 border-t animate-in fade-in duration-300">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    New Client
                  </p>
                  <p className="text-sm text-blue-700">
                    Please complete your details to create an account
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={newClientData.firstName}
                  onChange={(e) =>
                    setNewClientData((prev) => ({
                      ...prev,
                      firstName: e.target.value,
                    }))
                  }
                  className="mt-1.5 h-11 rounded-xl"
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={newClientData.lastName}
                  onChange={(e) =>
                    setNewClientData((prev) => ({
                      ...prev,
                      lastName: e.target.value,
                    }))
                  }
                  className="mt-1.5 h-11 rounded-xl"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="newEmail">Email Address *</Label>
              <Input
                id="newEmail"
                type="email"
                value={newClientData.email}
                onChange={(e) =>
                  setNewClientData((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                className="mt-1.5 h-11 rounded-xl"
                required
              />
            </div>

            <div>
              <Label htmlFor="newPhone">Phone Number</Label>
              <Input
                id="newPhone"
                type="tel"
                value={newClientData.phone}
                onChange={(e) =>
                  setNewClientData((prev) => ({
                    ...prev,
                    phone: e.target.value,
                  }))
                }
                className="mt-1.5 h-11 rounded-xl"
              />
            </div>

            <div>
              <Label htmlFor="company">Company / Agency</Label>
              <div className="relative mt-1.5">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="company"
                  value={newClientData.company}
                  onChange={(e) =>
                    setNewClientData((prev) => ({
                      ...prev,
                      company: e.target.value,
                    }))
                  }
                  className="h-11 rounded-xl pl-10"
                  placeholder="Your company or agency name"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Step 2: Address/Property Details
  const renderAddressStep = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-[#f2572c]/20 to-[#f2572c]/10 rounded-2xl flex items-center justify-center">
          <MapPin className="w-8 h-8 text-[#f2572c]" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">Property Location</h2>
        <p className="text-gray-500">Enter the property address for the shoot</p>
      </div>

      <div className="space-y-4 max-w-md mx-auto">
        <div>
          <Label htmlFor="address">Property Address</Label>
          <div className="relative mt-1.5">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
            <Input
              id="address"
              placeholder="Start typing property address..."
              value={formData.address}
              onChange={(e) => handleAddressChange(e.target.value)}
              onFocus={() => formData.address && addressSuggestions.length > 0 && setShowAddressSuggestions(true)}
              onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 200)}
              className="h-12 rounded-xl pl-10 pr-4"
              autoComplete="off"
            />
            {isLoadingPlaces && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            )}
            
            {/* Address Suggestions Dropdown */}
            {showAddressSuggestions && addressSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {addressSuggestions.map((prediction: any, index: number) => (
                  <button
                    key={prediction.place_id || index}
                    type="button"
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleAddressSelect(prediction);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {prediction.structured_formatting?.main_text || prediction.description.split(',')[0]}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {prediction.structured_formatting?.secondary_text || prediction.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Start typing and select from the suggestions
          </p>
          
          {/* Show coordinates if available */}
          {formData.latitude && formData.longitude && (
            <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
              <CheckCircle2 className="w-3 h-3" />
              <span>Location verified</span>
            </div>
          )}
          
          {/* Service Area Validation - only shown when restrictToServiceAreas is enabled */}
          {settings?.restrictToServiceAreas && isValidatingServiceArea && (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Checking service area...</span>
            </div>
          )}
          
          {settings?.restrictToServiceAreas && serviceAreaValidation && !isValidatingServiceArea && (
            <div className={`mt-3 p-3 rounded-lg ${
              serviceAreaValidation.isValid 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className={`flex items-start gap-2 text-sm ${
                serviceAreaValidation.isValid ? 'text-green-700' : 'text-red-700'
              }`}>
                {serviceAreaValidation.isValid ? (
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className="font-medium">
                    {serviceAreaValidation.isValid 
                      ? serviceAreaValidation.matchingAreas.length > 0
                        ? `Service Area: ${serviceAreaValidation.matchingAreas.map(a => a.name).join(', ')}`
                        : 'Address accepted'
                      : 'Outside Service Area'
                    }
                  </p>
                  {!serviceAreaValidation.isValid && (
                    <p className="text-xs mt-1 text-red-600">
                      {serviceAreaValidation.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Custom Questions */}
        {settings?.customQuestions && settings.customQuestions.length > 0 && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium text-sm text-gray-700">Additional Information</h3>
            {settings.customQuestions
              .sort((a, b) => a.order - b.order)
              .map((question) => (
                <CustomQuestionField
                  key={question.id}
                  question={question}
                  value={formData.customAnswers[question.id]}
                  onChange={(value) =>
                    updateFormData("customAnswers", {
                      ...formData.customAnswers,
                      [question.id]: value,
                    })
                  }
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );

  // Step 3: Services Selection (uses separate component)
  const renderServicesStep = () => (
    <BookingServicesStep
      partnerId={partnerId}
      selectedProducts={formData.selectedProducts}
      selectedAddOns={formData.selectedAddOns}
      onServicesChange={(data) => {
        updateFormData("selectedProducts", data.selectedProducts);
        updateFormData("selectedAddOns", data.selectedAddOns);
      }}
      onNext={nextStep}
      onBack={prevStep}
    />
  );

  // Step 4: Schedule (uses separate component)
  const renderScheduleStep = () => (
    <BookingScheduleStep
      partnerId={partnerId}
      selectedDate={formData.preferredDate}
      selectedTime={formData.preferredTime}
      selectedTeamMemberId={formData.selectedTeamMemberId}
      estimatedDuration={calculateDuration()}
      specialInstructions={formData.specialInstructions}
      allowTeamSelection={settings?.allowTeamSelection || false}
      teamMembers={teamMembers}
      propertyLocation={
        formData.latitude && formData.longitude
          ? { latitude: formData.latitude, longitude: formData.longitude }
          : undefined
      }
      onDateChange={(date) => updateFormData("preferredDate", date)}
      onTimeChange={(time) => updateFormData("preferredTime", time)}
      onTeamMemberChange={(id) => updateFormData("selectedTeamMemberId", id)}
      onInstructionsChange={(instructions) =>
        updateFormData("specialInstructions", instructions)
      }
      onNext={nextStep}
      onBack={prevStep}
    />
  );

  // Step 5: Review & Payment
  const renderReviewStep = () => {
    const subtotal = calculateSubtotal();
    const deposit = calculateDeposit();

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-[#f2572c]/20 to-[#f2572c]/10 rounded-2xl flex items-center justify-center">
            <CreditCard className="w-8 h-8 text-[#f2572c]" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">Review Your Booking</h2>
          <p className="text-gray-500">
            Confirm details and complete your booking
          </p>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          {/* Order Summary */}
          <Card className="rounded-2xl border-gray-200">
            <CardContent className="p-6 space-y-4">
              {/* Contact */}
              <div className="flex items-start gap-3 pb-3 border-b">
                <Mail className="w-4 h-4 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">Contact</p>
                  <p className="text-sm font-medium">{formData.contact}</p>
                </div>
              </div>

              {/* Address */}
              <div className="flex items-start gap-3 pb-3 border-b">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">Property</p>
                  <p className="text-sm font-medium">{formData.address}</p>
                </div>
              </div>

              {/* Schedule */}
              <div className="flex items-start gap-3 pb-3 border-b">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">Scheduled</p>
                  <p className="text-sm font-medium">
                    {formData.preferredDate
                      ? new Date(formData.preferredDate + "T00:00:00").toLocaleDateString(
                          "en-AU",
                          {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )
                      : "Not selected"}
                  </p>
                  {formData.preferredTime && (
                    <p className="text-sm text-gray-600">{formData.preferredTime}</p>
                  )}
                </div>
              </div>

              {/* Team Member */}
              {formData.selectedTeamMemberId && (
                <div className="flex items-start gap-3 pb-3 border-b">
                  <User className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-0.5">Photographer</p>
                    <p className="text-sm font-medium">
                      {teamMembers.find((m) => m.id === formData.selectedTeamMemberId)?.name ||
                        "Assigned"}
                    </p>
                  </div>
                </div>
              )}

              {/* Duration */}
              <div className="flex items-start gap-3 pb-3 border-b">
                <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">Estimated Duration</p>
                  <p className="text-sm font-medium">
                    {Math.ceil(calculateDuration() / 60)} hour
                    {Math.ceil(calculateDuration() / 60) !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Services */}
              <div>
                <p className="text-xs text-gray-500 mb-3">Services</p>
                <div className="space-y-2">
                  {formData.selectedProducts.map((product, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm">
                        {product.name}
                        {product.quantity > 1 && ` (×${product.quantity})`}
                      </span>
                      <span className="text-sm font-medium">
                        ${(getPriceWithTax(product.price, product.taxRate) * product.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {formData.selectedAddOns.map((addon, index) => (
                    <div key={`addon-${index}`} className="flex items-center justify-between text-gray-600">
                      <span className="text-sm">+ {addon.name}</span>
                      <span className="text-sm">${getPriceWithTax(addon.price, addon.taxRate).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Total (inc. GST)</p>
                  <p className="text-xl font-semibold">${subtotal.toFixed(2)}</p>
                </div>
                {settings?.depositEnabled && deposit > 0 && (
                  <div className="flex items-center justify-between mt-2 text-[#f2572c]">
                    <p className="text-sm">
                      Deposit ({settings.depositType === "percentage" ? `${settings.depositAmount}%` : "fixed"})
                    </p>
                    <p className="font-medium">${deposit.toFixed(2)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment Method */}
          {settings?.paymentEnabled && (
            <div>
              <Label className="mb-3 block">Payment Method</Label>
              <div className="grid grid-cols-2 gap-3">
                {(settings.paymentMethod === "stripe" || settings.paymentMethod === "both") && (
                  <button
                    onClick={() => updateFormData("paymentMethod", "stripe")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.paymentMethod === "stripe"
                        ? "border-[#f2572c] bg-[#f2572c]/5"
                        : "border-gray-200 hover:border-[#f2572c]/50"
                    }`}
                  >
                    <CreditCard className="w-5 h-5 mx-auto mb-1.5" />
                    <p className="text-xs text-center font-medium">Credit Card</p>
                    <p className="text-xs text-center text-gray-500 mt-0.5">Pay now</p>
                  </button>
                )}
                {(settings.paymentMethod === "invoice" || settings.paymentMethod === "both") && (
                  <button
                    onClick={() => updateFormData("paymentMethod", "invoice")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.paymentMethod === "invoice"
                        ? "border-[#f2572c] bg-[#f2572c]/5"
                        : "border-gray-200 hover:border-[#f2572c]/50"
                    }`}
                  >
                    <Mail className="w-5 h-5 mx-auto mb-1.5" />
                    <p className="text-xs text-center font-medium">Invoice</p>
                    <p className="text-xs text-center text-gray-500 mt-0.5">Pay later</p>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Stripe Payment Form Placeholder */}
          {settings?.paymentEnabled && formData.paymentMethod === "stripe" && (
            <Card className="rounded-2xl border-gray-200">
              <CardContent className="pt-6 space-y-4">
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Secure payment powered by Stripe
                </p>
                <div>
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <Input
                    id="cardNumber"
                    placeholder="4242 4242 4242 4242"
                    className="mt-1.5 h-11 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="expiry">Expiry Date</Label>
                    <Input
                      id="expiry"
                      placeholder="MM/YY"
                      className="mt-1.5 h-11 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cvc">CVC</Label>
                    <Input
                      id="cvc"
                      placeholder="123"
                      className="mt-1.5 h-11 rounded-xl"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Invoice Notice */}
          {(!settings?.paymentEnabled || formData.paymentMethod === "invoice") && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-900">
                📧 An invoice will be sent to{" "}
                <strong>{formData.contact}</strong> after the shoot is completed.
                Payment is due within 7 days of receipt.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Step 6: Confirmation
  const renderConfirmationStep = () => {
    const generateCalendarUrls = () => {
      if (!formData.preferredDate || !formData.preferredTime) return null;

      const eventTitle = "Property Photography Shoot";
      const eventLocation = formData.address;
      const eventDescription = `Photography services booked.\n\nServices:\n${formData.selectedProducts
        .map((p) => `- ${p.name}`)
        .join("\n")}\n\nContact: ${formData.contact}`;

      const [datePart] = formData.preferredDate.split("T");
      const timeMatch = formData.preferredTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!timeMatch) return null;

      let hour24 = parseInt(timeMatch[1]);
      const minutes = timeMatch[2];
      const period = timeMatch[3].toUpperCase();

      if (period === "PM" && hour24 !== 12) hour24 += 12;
      if (period === "AM" && hour24 === 12) hour24 = 0;

      const startDate = new Date(
        `${datePart}T${hour24.toString().padStart(2, "0")}:${minutes}:00`
      );
      const endDate = new Date(
        startDate.getTime() + Math.max(calculateDuration(), 60) * 60000
      );

      const formatDateForGoogle = (date: Date) =>
        date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

      const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        eventTitle
      )}&dates=${formatDateForGoogle(startDate)}/${formatDateForGoogle(
        endDate
      )}&details=${encodeURIComponent(eventDescription)}&location=${encodeURIComponent(
        eventLocation
      )}`;

      return { googleUrl };
    };

    const calendarUrls = generateCalendarUrls();

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="text-center max-w-lg mx-auto">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-500/20 to-green-500/10 rounded-3xl flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-semibold mb-3">Booking Confirmed!</h2>
          <p className="text-gray-500 text-lg mb-6">
            Thank you for your booking
          </p>

          <Card className="rounded-2xl border-gray-200 text-left">
            <CardContent className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Confirmation Number</p>
                <p className="text-xl font-mono font-medium">
                  RPP-{Date.now().toString().slice(-8)}
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-[#f2572c]" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {formData.preferredDate &&
                        new Date(formData.preferredDate + "T00:00:00").toLocaleDateString(
                          "en-AU",
                          {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                    </p>
                    <p className="text-xs text-gray-500">{formData.preferredTime}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-[#f2572c]" />
                  <p className="text-sm">{formData.address}</p>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-[#f2572c]" />
                  <p className="text-sm">{formData.contact}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add to Calendar */}
          {calendarUrls && (
            <Card className="rounded-2xl border-gray-200 text-left mt-4">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-4 h-4 text-[#f2572c]" />
                  <p className="text-sm font-medium">Add to Calendar</p>
                </div>
                <a
                  href={calendarUrls.googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl border hover:border-[#f2572c]/50 hover:bg-gray-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm">Google Calendar</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#f2572c] transition-colors" />
                </a>
              </CardContent>
            </Card>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-6">
            <p className="text-sm text-amber-900">
              <strong>What's Next?</strong>
              <br />
              You'll receive a confirmation email shortly. Our photographer will
              contact you 24 hours before the scheduled shoot to confirm details.
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-xl"
              onClick={() => window.location.reload()}
            >
              Book Another
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Loading state
  if (settingsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#f2572c] mx-auto mb-4" />
          <p className="text-gray-500">Loading booking form...</p>
        </div>
      </div>
    );
  }

  // Check if booking is explicitly disabled (settings.isEnabled === false)
  // Note: if settings is undefined/null, we assume booking is enabled (default behavior)
  if (settings && settings.isEnabled === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-3xl">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Booking Unavailable</h2>
            <p className="text-gray-500">
              Online booking is currently not available. Please contact us directly to schedule an appointment.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold mb-2">Book Your Photo Shoot</h1>
          <p className="text-gray-500">Professional real estate photography made easy</p>
        </div>

        {/* Progress Steps */}
        {currentStep < 6 && (
          <div className="mb-8">
            <div className="flex items-center justify-between max-w-4xl mx-auto mb-2">
              {steps.slice(0, -1).map((step, index) => (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                        currentStep > step.id
                          ? "bg-[#f2572c] text-white"
                          : currentStep === step.id
                            ? "bg-[#f2572c] text-white ring-4 ring-[#f2572c]/20"
                            : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {currentStep > step.id ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-medium">{step.id}</span>
                      )}
                    </div>
                    <p className="text-xs mt-2 hidden md:block text-gray-600">
                      {step.name}
                    </p>
                  </div>
                  {index < steps.length - 2 && (
                    <div
                      className={`h-0.5 flex-1 transition-all duration-300 ${
                        currentStep > step.id ? "bg-[#f2572c]" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Card */}
        {currentStep === 3 ? (
          renderServicesStep()
        ) : currentStep === 4 ? (
          renderScheduleStep()
        ) : (
          <Card className="rounded-3xl border-gray-200 shadow-xl">
            <CardContent className="p-8 md:p-12">
              {currentStep === 1 && renderContactStep()}
              {currentStep === 2 && renderAddressStep()}
              {currentStep === 5 && renderReviewStep()}
              {currentStep === 6 && renderConfirmationStep()}

              {/* Navigation Buttons */}
              {currentStep < 6 && currentStep !== 3 && currentStep !== 4 && (
                <div className="flex gap-3 mt-8 pt-6 border-t">
                  {currentStep > 1 && (
                    <Button
                      variant="outline"
                      onClick={prevStep}
                      className="h-11 px-6 rounded-xl"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                  )}
                  <Button
                    onClick={currentStep === 5 ? handleSubmit : nextStep}
                    disabled={!canProceed() || isSubmitting}
                    className={`h-11 px-6 rounded-xl bg-[#f2572c] hover:bg-[#d94820] ${
                      currentStep === 1 ? "w-full" : "ml-auto"
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : currentStep === 5 ? (
                      "Confirm Booking"
                    ) : (
                      <>
                        Continue
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-gray-500">
          <p>Questions? Contact us for assistance</p>
        </div>
      </div>
    </div>
  );
}

// Custom Question Field Component
function CustomQuestionField({
  question,
  value,
  onChange,
}: {
  question: CustomQuestion;
  value: string | string[] | boolean | undefined;
  onChange: (value: string | string[] | boolean) => void;
}) {
  switch (question.type) {
    case "text":
      return (
        <div>
          <Label htmlFor={question.id}>
            {question.question}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <Input
            id={question.id}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1.5 rounded-xl"
            required={question.required}
          />
        </div>
      );

    case "textarea":
      return (
        <div>
          <Label htmlFor={question.id}>
            {question.question}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <Textarea
            id={question.id}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1.5 rounded-xl"
            required={question.required}
          />
        </div>
      );

    case "select":
      return (
        <div>
          <Label htmlFor={question.id}>
            {question.question}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <Select
            value={(value as string) || ""}
            onValueChange={(v) => onChange(v)}
          >
            <SelectTrigger className="mt-1.5 rounded-xl">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case "checkbox":
      return (
        <div className="flex items-center gap-3">
          <Checkbox
            id={question.id}
            checked={(value as boolean) || false}
            onCheckedChange={(checked) => onChange(checked as boolean)}
          />
          <Label htmlFor={question.id} className="cursor-pointer">
            {question.question}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
        </div>
      );

    default:
      return null;
  }
}

export default BookingForm;

