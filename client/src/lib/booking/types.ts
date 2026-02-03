// Booking Form Types

export interface BookingFormSettings {
  // General settings
  partnerId: string;
  isEnabled: boolean;
  bookingLink: string; // The permanent booking link
  // Time zone for interpreting booking dates/times (IANA, e.g. \"Australia/Sydney\")
  timeZone?: string;
  
  // Client settings
  allowNewClients: boolean; // Allow new clients to book (vs existing only)
  requireExistingCustomer: boolean; // Require customer to already exist in system
  
  // Scheduling rules
  minLeadTimeHours: number; // Minimum hours in advance clients can book (e.g., 24, 12, 48)
  maxDriveDistanceKm: number; // Maximum driving distance between appointments
  bufferMinutes: number; // Buffer time between appointments
  timeSlotInterval: number; // Time slot interval in minutes (5, 10, 15, 30, 60)
  
  // Team settings
  allowTeamSelection: boolean; // Allow clients to select specific team members
  
  // Service area settings
  restrictToServiceAreas: boolean; // Restrict bookings to defined service areas only
  
  // Payment settings
  paymentEnabled: boolean;
  paymentMethod: 'stripe' | 'invoice' | 'both';
  depositEnabled: boolean;
  depositType: 'fixed' | 'percentage';
  depositAmount: number; // Fixed amount or percentage value
  stripeAccountId?: string;
  
  // Custom questions
  customQuestions: CustomQuestion[];
  
  // Business info (from public settings endpoint)
  businessName?: string;
  businessLogo?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessHours?: Record<string, { enabled: boolean; start: string; end: string }>;
}

export interface CustomQuestion {
  id: string;
  question: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'checkbox';
  options?: string[]; // For select/multiselect types
  required: boolean;
  order: number;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'photographer';
  profileImage?: string;
  color?: string;
}

export interface TeamMemberAvailability {
  teamMemberId: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  isAvailable: boolean;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
}

export interface Appointment {
  id: string;
  jobId: string;
  partnerId: string;
  teamMemberId?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  appointmentDate: Date;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  estimatedDuration: number; // in minutes
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

export interface BookingProduct {
  id: string;
  partnerId: string;
  title: string;
  description?: string;
  type: 'product' | 'package' | 'addon';
  category?: string;
  price: number;
  taxRate: number;
  hasVariations: boolean;
  variations?: ProductVariation[];
  productType: 'onsite' | 'digital';
  requiresAppointment: boolean;
  appointmentDuration: number; // in minutes
  isActive: boolean;
  isLive: boolean; // Visible on booking form
  image?: string;
  availableAddons?: string[]; // Array of addon product IDs that can be added to this product/package
}

export interface ProductVariation {
  name: string;
  price: number;
  appointmentDuration: number;
  noCharge?: boolean;
}

export interface SelectedProduct {
  id: string;
  name: string;
  price: number;
  taxRate: number; // Tax rate percentage (e.g., 10 for 10% GST)
  quantity: number;
  category: string;
  duration: number; // appointment duration in minutes
  variationName?: string;
}

export interface SelectedAddOn {
  id: string;
  name: string;
  price: number;
  taxRate: number; // Tax rate percentage (e.g., 10 for 10% GST)
}

export interface BookingFormData {
  // Step 1: Contact
  contact: string;
  contactType: 'email' | 'phone';
  
  // Step 2: Property/Address
  address: string;
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  
  // Step 3: Services
  selectedProducts: SelectedProduct[];
  selectedAddOns: SelectedAddOn[];
  
  // Step 4: Schedule
  preferredDate: string; // YYYY-MM-DD
  preferredTime: string; // HH:mm AM/PM format
  selectedTeamMemberId?: string;
  
  // Custom questions answers
  customAnswers: Record<string, string | string[] | boolean>;
  
  // Step 5: Special Instructions
  specialInstructions: string;
  
  // Step 5: Payment
  paymentMethod: 'stripe' | 'invoice';
  depositPaid?: boolean;
}

export interface TimeSlot {
  time: string; // "8:00 AM" format
  available: boolean;
  teamMemberIds?: string[]; // Which team members are available for this slot
  conflictReason?: string; // Reason if unavailable
}

export interface AvailableDay {
  date: Date;
  hasAvailability: boolean;
  slots: TimeSlot[];
}

export interface DriveTimeResult {
  distanceKm: number;
  durationMinutes: number;
  isWithinLimit: boolean;
}

export interface BookingValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Default settings for new partners
export const DEFAULT_BOOKING_SETTINGS: Omit<BookingFormSettings, 'partnerId' | 'bookingLink'> = {
  isEnabled: true,
  timeZone: 'Australia/Sydney',
  allowNewClients: true,
  requireExistingCustomer: false,
  minLeadTimeHours: 24,
  maxDriveDistanceKm: 50,
  bufferMinutes: 30,
  timeSlotInterval: 30,
  allowTeamSelection: false,
  restrictToServiceAreas: false,
  paymentEnabled: false,
  paymentMethod: 'invoice',
  depositEnabled: false,
  depositType: 'percentage',
  depositAmount: 25,
  customQuestions: [],
};

