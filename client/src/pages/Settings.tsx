import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import EditingOptionsManager from "@/components/EditingOptionsManager";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Building2, 
  User, 
  Clock, 
  MapPin, 
  FileText, 
  Globe, 
  Calendar, 
  Settings as SettingsIcon,
  Camera,
  Upload,
  Save,
  Edit,
  Trash2,
  Users,
  UserPlus,
  Send,
  Mail,
  Handshake,
  Wand2,
  Plus,
  X
} from "lucide-react";

interface Partnership {
  editorId: string;
  editorEmail: string;
  editorStudioName: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  acceptedAt: any;
  isActive: boolean;
}

export default function Settings() {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState("business-profile");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [businessHours, setBusinessHours] = useState({
    monday: { enabled: true, start: "09:00", end: "17:00" },
    tuesday: { enabled: true, start: "09:00", end: "17:00" },
    wednesday: { enabled: true, start: "09:00", end: "17:00" },
    thursday: { enabled: true, start: "09:00", end: "17:00" },
    friday: { enabled: true, start: "09:00", end: "17:00" },
    saturday: { enabled: false, start: "09:00", end: "17:00" },
    sunday: { enabled: false, start: "09:00", end: "17:00" },
  });

  // State for personal profile
  const [personalProfile, setPersonalProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    bio: ""
  });

  // State for business profile
  const [businessProfile, setBusinessProfile] = useState({
    businessName: "Real Property Photography",
    tagline: "Professional Real Estate Photography Services",
    email: "contact@realpropertyphoto.com",
    phone: "(555) 123-4567",
    address: "123 Business St, City, State 12345",
    website: "https://realpropertyphoto.com",
    description: "We provide high-quality real estate photography services to help showcase properties in their best light."
  });


  // Editor invitation form data
  const [editorFormData, setEditorFormData] = useState({
    editorEmail: "",
    editorStudioName: ""
  });

  // Load saved settings from backend
  const { data: savedSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['/api/settings']
  });

  // Update state when settings are loaded
  useEffect(() => {
    if (savedSettings) {
      if (savedSettings.personalProfile) {
        setPersonalProfile({
          firstName: savedSettings.personalProfile.firstName || "",
          lastName: savedSettings.personalProfile.lastName || "",
          email: savedSettings.personalProfile.email || userData?.email || "",
          phone: savedSettings.personalProfile.phone || "",
          bio: savedSettings.personalProfile.bio || ""
        });
      } else if (userData?.email) {
        // Initialize email from userData if no saved settings
        setPersonalProfile(prev => ({
          ...prev,
          email: userData.email || ""
        }));
      }
      if (savedSettings.businessProfile) {
        setBusinessProfile(savedSettings.businessProfile);
      }
      if (savedSettings.businessHours) {
        setBusinessHours(savedSettings.businessHours);
      }
    } else if (userData?.email) {
      // Initialize email from userData if no saved settings at all
      setPersonalProfile(prev => ({
        ...prev,
        email: userData.email || ""
      }));
    }
  }, [savedSettings, userData]);

  // Fetch active partnerships
  const { data: partnerships = [], isLoading: partnershipsLoading } = useQuery<Partnership[]>({
    queryKey: ['/api/partnerships'],
    retry: false
  });

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: { businessProfile: any; personalProfile: any; businessHours: any }) => {
      return apiRequest("/api/settings", "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: "Settings Saved!",
        description: "Your settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Save Settings",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    }
  });

  // Editor invitation mutation
  const inviteMutation = useMutation({
    mutationFn: async (data: { editorEmail: string; editorStudioName: string }) => {
      return apiRequest("/api/partnerships/invite", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Invitation Sent!",
        description: "The editor will receive an invitation to partner with you.",
      });

      // Clear form
      setEditorFormData({
        editorEmail: "",
        editorStudioName: ""
      });

      // Invalidate partnerships cache
      queryClient.invalidateQueries({ queryKey: ['/api/partnerships'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Invitation",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    }
  });

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate({
      personalProfile,
      businessProfile,
      businessHours
    });
  };

  const handleEditorInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!editorFormData.editorEmail.trim() || !editorFormData.editorStudioName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in both email and studio name.",
        variant: "destructive",
      });
      return;
    }

    inviteMutation.mutate(editorFormData);
  };

  const handleEditorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditorFormData(prev => ({ ...prev, [name]: value }));
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Unknown";
    const date = timestamp._seconds ? new Date(timestamp._seconds * 1000) : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };

  const dayNames = {
    monday: "Monday",
    tuesday: "Tuesday", 
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday"
  };

  const handleBusinessHoursChange = (day: string, field: string, value: string | boolean) => {
    setBusinessHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day as keyof typeof prev],
        [field]: value
      }
    }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your business profile, settings and preferences</p>
        </div>
        <Button 
          className="bg-[#f2572c] hover:bg-[#d94722] text-white"
          onClick={handleSaveSettings}
          disabled={saveSettingsMutation.isPending}
          data-testid="button-save-settings"
        >
          <Save className="w-4 h-4 mr-2" />
          {saveSettingsMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-11 lg:grid-cols-11">
          <TabsTrigger value="business-profile" className="flex flex-col items-center gap-1 p-3">
            <Building2 className="w-4 h-4" />
            <span className="text-xs hidden sm:block">Business</span>
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex flex-col items-center gap-1 p-3">
            <User className="w-4 h-4" />
            <span className="text-xs hidden sm:block">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="operating-hours" className="flex flex-col items-center gap-1 p-3">
            <Clock className="w-4 h-4" />
            <span className="text-xs hidden sm:block">Hours</span>
          </TabsTrigger>
          <TabsTrigger value="service-areas" className="flex flex-col items-center gap-1 p-3">
            <MapPin className="w-4 h-4" />
            <span className="text-xs hidden sm:block">Areas</span>
          </TabsTrigger>
          <TabsTrigger value="policies" className="flex flex-col items-center gap-1 p-3">
            <FileText className="w-4 h-4" />
            <span className="text-xs hidden sm:block">Policies</span>
          </TabsTrigger>
          <TabsTrigger value="domain" className="flex flex-col items-center gap-1 p-3">
            <Globe className="w-4 h-4" />
            <span className="text-xs hidden sm:block">Domain</span>
          </TabsTrigger>
          <TabsTrigger value="booking-form" className="flex flex-col items-center gap-1 p-3">
            <Calendar className="w-4 h-4" />
            <span className="text-xs hidden sm:block">Booking</span>
          </TabsTrigger>
          <TabsTrigger value="availability" className="flex flex-col items-center gap-1 p-3">
            <SettingsIcon className="w-4 h-4" />
            <span className="text-xs hidden sm:block">Availability</span>
          </TabsTrigger>
          <TabsTrigger value="editing-options" className="flex flex-col items-center gap-1 p-3">
            <Wand2 className="w-4 h-4" />
            <span className="text-xs hidden sm:block">Editing</span>
          </TabsTrigger>
          <TabsTrigger value="invite-editors" className="flex flex-col items-center gap-1 p-3">
            <UserPlus className="w-4 h-4" />
            <span className="text-xs hidden sm:block">Invite</span>
          </TabsTrigger>
          <TabsTrigger value="partnerships" className="flex flex-col items-center gap-1 p-3">
            <Handshake className="w-4 h-4" />
            <span className="text-xs hidden sm:block">Partners</span>
          </TabsTrigger>
        </TabsList>

        {/* Personal Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Profile
              </CardTitle>
              <p className="text-sm text-gray-600">
                Manage your personal information and account settings
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Picture */}
              <div className="flex items-center gap-4">
                <Avatar className="w-20 h-20">
                  <AvatarImage src="" />
                  <AvatarFallback className="text-lg">
                    {personalProfile.firstName[0]}{personalProfile.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Label>Profile Picture</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Upload className="w-4 h-4 mr-2" />
                      Change Photo
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                </div>
              </div>

              {/* Personal Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={personalProfile.firstName}
                    onChange={(e) => setPersonalProfile(prev => ({ ...prev, firstName: e.target.value }))}
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={personalProfile.lastName}
                    onChange={(e) => setPersonalProfile(prev => ({ ...prev, lastName: e.target.value }))}
                    data-testid="input-last-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="personalEmail">Email Address</Label>
                  <Input
                    id="personalEmail"
                    type="email"
                    value={personalProfile.email}
                    onChange={(e) => setPersonalProfile(prev => ({ ...prev, email: e.target.value }))}
                    data-testid="input-personal-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="personalPhone">Phone Number</Label>
                  <Input
                    id="personalPhone"
                    value={personalProfile.phone}
                    onChange={(e) => setPersonalProfile(prev => ({ ...prev, phone: e.target.value }))}
                    data-testid="input-personal-phone"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Account Description</Label>
                <Textarea
                  id="bio"
                  rows={4}
                  value={personalProfile.bio}
                  onChange={(e) => setPersonalProfile(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell us about yourself and your experience..."
                  data-testid="textarea-personal-bio"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Profile Tab */}
        <TabsContent value="business-profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Business Profile
              </CardTitle>
              <p className="text-sm text-gray-600">
                Manage your business information, branding, and public profile details
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Branding Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Branding</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                    <Camera className="w-8 h-8 text-gray-400" />
                  </div>
                  <div className="space-y-2">
                    <Label>Business Logo</Label>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Logo
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Recommended size: 200x200px. Max file size: 2MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Business Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    value={businessProfile.businessName}
                    onChange={(e) => setBusinessProfile(prev => ({ ...prev, businessName: e.target.value }))}
                    data-testid="input-business-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    value={businessProfile.tagline}
                    onChange={(e) => setBusinessProfile(prev => ({ ...prev, tagline: e.target.value }))}
                    data-testid="input-business-tagline"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessEmail">Business Email</Label>
                  <Input
                    id="businessEmail"
                    type="email"
                    value={businessProfile.email}
                    onChange={(e) => setBusinessProfile(prev => ({ ...prev, email: e.target.value }))}
                    data-testid="input-business-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessPhone">Business Phone</Label>
                  <Input
                    id="businessPhone"
                    value={businessProfile.phone}
                    onChange={(e) => setBusinessProfile(prev => ({ ...prev, phone: e.target.value }))}
                    data-testid="input-business-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessWebsite">Website</Label>
                  <Input
                    id="businessWebsite"
                    value={businessProfile.website}
                    onChange={(e) => setBusinessProfile(prev => ({ ...prev, website: e.target.value }))}
                    data-testid="input-business-website"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessAddress">Business Address</Label>
                  <Input
                    id="businessAddress"
                    value={businessProfile.address}
                    onChange={(e) => setBusinessProfile(prev => ({ ...prev, address: e.target.value }))}
                    data-testid="input-business-address"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessDescription">Business Description</Label>
                <Textarea
                  id="businessDescription"
                  rows={4}
                  value={businessProfile.description}
                  onChange={(e) => setBusinessProfile(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Tell potential clients about your business and services..."
                  data-testid="textarea-business-description"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Operating Hours Tab */}
        <TabsContent value="operating-hours" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Operating Hours
              </CardTitle>
              <p className="text-sm text-gray-600">
                Set your business operating hours for scheduling and availability
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Set Standard Hours */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Set Standard Hours</h3>
                <p className="text-sm text-gray-600">
                  Define when your business is open for bookings and appointments
                </p>

                {Object.entries(businessHours).map(([day, hours]) => (
                  <div key={day} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={hours.enabled}
                        onCheckedChange={(checked) => handleBusinessHoursChange(day, 'enabled', checked)}
                        data-testid={`switch-${day}-enabled`}
                      />
                      <span className="font-medium w-24">
                        {dayNames[day as keyof typeof dayNames]}
                      </span>
                    </div>

                    {hours.enabled && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={hours.start}
                          onChange={(e) => handleBusinessHoursChange(day, 'start', e.target.value)}
                          className="w-32"
                          data-testid={`input-${day}-start`}
                        />
                        <span className="text-gray-500">to</span>
                        <Input
                          type="time"
                          value={hours.end}
                          onChange={(e) => handleBusinessHoursChange(day, 'end', e.target.value)}
                          className="w-32"
                          data-testid={`input-${day}-end`}
                        />
                      </div>
                    )}

                    {!hours.enabled && (
                      <span className="text-gray-500">Closed</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Special Hours */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Set Special Hours</h3>
                <p className="text-sm text-gray-600">
                  Override standard hours for holidays or special events
                </p>
                <Button variant="outline" data-testid="button-add-special-hours">
                  <Calendar className="w-4 h-4 mr-2" />
                  Add Special Hours
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Service Areas Tab */}
        <TabsContent value="service-areas" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Service Areas
              </CardTitle>
              <p className="text-sm text-gray-600">
                Define the geographical areas where you provide photography services
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Service Areas List */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Your Service Areas</h3>
                  <Button data-testid="button-add-service-area">
                    <MapPin className="w-4 h-4 mr-2" />
                    Add Service Area
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                      <div>
                        <p className="font-medium">Downtown Metro Area</p>
                        <p className="text-sm text-gray-600">Within 15 miles of downtown</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" data-testid="button-edit-service-area-1">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" data-testid="button-delete-service-area-1">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                      <div>
                        <p className="font-medium">Suburban Areas</p>
                        <p className="text-sm text-gray-600">20-30 mile radius</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" data-testid="button-edit-service-area-2">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" data-testid="button-delete-service-area-2">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Map Placeholder */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Service Area Map</h3>
                <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                  <div className="text-center">
                    <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">Interactive map will display your service areas</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policies Tab */}
        <TabsContent value="policies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Policies
              </CardTitle>
              <p className="text-sm text-gray-600">
                Manage your business policies, terms of service, and legal information
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Terms of Service */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Terms of Service</h3>
                <Textarea
                  rows={6}
                  placeholder="Enter your terms of service..."
                  defaultValue="1. Acceptance of Terms: By booking our photography services, you agree to these terms and conditions.
2. Booking and Payment: Full payment is required at time of booking.
3. Cancellation Policy: 48 hours notice required for cancellations.
4. Copyright: All images remain property of [Business Name] until full payment is received.
5. Usage Rights: Client receives usage rights for marketing and promotional purposes only."
                  data-testid="textarea-terms-of-service"
                />
              </div>

              {/* Copyright Policy */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Copyright Policy</h3>
                <Textarea
                  rows={4}
                  placeholder="Enter your copyright policy..."
                  defaultValue="All photographs remain the property of [Business Name] until full payment is received. Upon payment, the client receives usage rights for marketing and promotional purposes related to the property photographed."
                  data-testid="textarea-copyright-policy"
                />
              </div>

              {/* Cancellation Policy */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Cancellation Policy</h3>
                <Textarea
                  rows={4}
                  placeholder="Enter your cancellation policy..."
                  defaultValue="Cancellations must be made at least 48 hours prior to the scheduled appointment. Cancellations made with less than 48 hours notice may be subject to a cancellation fee."
                  data-testid="textarea-cancellation-policy"
                />
              </div>

              {/* Company Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Company Information</h3>
                <Textarea
                  rows={4}
                  placeholder="Enter additional company information..."
                  defaultValue="[Business Name] is a professional real estate photography service dedicated to helping real estate professionals showcase properties in their best light."
                  data-testid="textarea-company-info"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Domain Tab */}
        <TabsContent value="domain" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Domain & Booking Pages
              </CardTitle>
              <p className="text-sm text-gray-600">
                Configure your custom domain and booking page settings
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Custom Domain */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Set Custom Domain or Subdomain</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customDomain">Custom Domain</Label>
                    <Input
                      id="customDomain"
                      placeholder="yourbusiness.com"
                      data-testid="input-custom-domain"
                    />
                    <p className="text-xs text-gray-500">
                      Enter your custom domain name to create a professional booking experience
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button data-testid="button-save-domain">
                      Save
                    </Button>
                    <Button variant="outline" data-testid="button-verify-domain">
                      Verify Domain
                    </Button>
                  </div>
                </div>
              </div>

              {/* Booking Form */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Booking Form</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Standard Booking</h4>
                    <p className="text-sm text-gray-600 mb-4">Basic booking form for standard photography services</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" data-testid="button-view-standard-form">
                        View
                      </Button>
                      <Button variant="outline" size="sm" data-testid="button-copy-standard-link">
                        Copy Link
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Premium Booking</h4>
                    <p className="text-sm text-gray-600 mb-4">Enhanced booking form with additional service options</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" data-testid="button-view-premium-form">
                        View
                      </Button>
                      <Button variant="outline" size="sm" data-testid="button-copy-premium-link">
                        Copy Link
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Practice Pages */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Practice Pages</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Portfolio Showcase</p>
                      <p className="text-sm text-gray-600">Display your best photography work</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" data-testid="button-edit-portfolio">
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" data-testid="button-view-portfolio">
                        View
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Service Information</p>
                      <p className="text-sm text-gray-600">Details about your photography services</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" data-testid="button-edit-services">
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" data-testid="button-view-services">
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Booking Form Tab */}
        <TabsContent value="booking-form" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Booking Form Configuration
              </CardTitle>
              <p className="text-sm text-gray-600">
                Customize your booking forms and client intake process
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Form Fields */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Booking Form Fields</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Switch defaultChecked data-testid="switch-client-name" />
                      <span>Client Name</span>
                    </div>
                    <Badge variant="secondary">Required</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Switch defaultChecked data-testid="switch-email-address" />
                      <span>Email Address</span>
                    </div>
                    <Badge variant="secondary">Required</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Switch defaultChecked data-testid="switch-phone-number" />
                      <span>Phone Number</span>
                    </div>
                    <Badge variant="outline">Optional</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Switch defaultChecked data-testid="switch-property-address" />
                      <span>Property Address</span>
                    </div>
                    <Badge variant="secondary">Required</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Switch defaultChecked data-testid="switch-service-type" />
                      <span>Service Type Selection</span>
                    </div>
                    <Badge variant="secondary">Required</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Switch defaultChecked data-testid="switch-preferred-date" />
                      <span>Preferred Date & Time</span>
                    </div>
                    <Badge variant="secondary">Required</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Switch data-testid="switch-special-instructions" />
                      <span>Special Instructions</span>
                    </div>
                    <Badge variant="outline">Optional</Badge>
                  </div>
                </div>
              </div>

              {/* New Customer Booking */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">New Customer Booking</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span>Allow new customers to book</span>
                    <Switch defaultChecked data-testid="switch-allow-new-customers" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newCustomerInstructions">Instructions for new customers</Label>
                    <Textarea
                      id="newCustomerInstructions"
                      rows={3}
                      placeholder="Welcome message and instructions for new clients..."
                      data-testid="textarea-new-customer-instructions"
                    />
                  </div>
                </div>
              </div>

              {/* Service Area Restrictions */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Service Area Restrictions</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span>Restrict to service areas only</span>
                    <Switch defaultChecked data-testid="switch-restrict-service-areas" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="outsideAreaMessage">Message for locations outside service area</Label>
                    <Textarea
                      id="outsideAreaMessage"
                      rows={2}
                      placeholder="This location is outside our current service area. Please contact us directly to discuss availability."
                      data-testid="textarea-outside-area-message"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Booking Availability Tab */}
        <TabsContent value="availability" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" />
                Booking Availability
              </CardTitle>
              <p className="text-sm text-gray-600">
                Configure scheduling rules and booking availability settings
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Advance Booking */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Advance Booking</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minAdvanceBooking">Minimum advance booking</Label>
                    <Select defaultValue="24">
                      <SelectTrigger data-testid="select-min-advance-booking">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 hours</SelectItem>
                        <SelectItem value="4">4 hours</SelectItem>
                        <SelectItem value="24">24 hours</SelectItem>
                        <SelectItem value="48">48 hours</SelectItem>
                        <SelectItem value="72">72 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxAdvanceBooking">Maximum advance booking</Label>
                    <Select defaultValue="90">
                      <SelectTrigger data-testid="select-max-advance-booking">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="60">60 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                        <SelectItem value="180">6 months</SelectItem>
                        <SelectItem value="365">1 year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Time Slot Intervals */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Time Slot Intervals</h3>
                <div className="space-y-2">
                  <Label htmlFor="timeSlotInterval">Available booking intervals</Label>
                  <Select defaultValue="60">
                    <SelectTrigger data-testid="select-time-slot-interval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">Every 15 minutes</SelectItem>
                      <SelectItem value="30">Every 30 minutes</SelectItem>
                      <SelectItem value="60">Every 1 hour</SelectItem>
                      <SelectItem value="120">Every 2 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Booking Restrictions */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Booking Additional Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span>Require payment at time of booking</span>
                    <Switch data-testid="switch-require-payment" />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span>Allow same-day bookings</span>
                    <Switch defaultChecked data-testid="switch-same-day-booking" />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span>Send confirmation emails</span>
                    <Switch defaultChecked data-testid="switch-confirmation-emails" />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span>Send reminder notifications</span>
                    <Switch defaultChecked data-testid="switch-reminder-notifications" />
                  </div>
                </div>
              </div>

              {/* Payment Options */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Payment Options</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span>Accept credit/debit cards</span>
                    <Switch defaultChecked data-testid="switch-accept-cards" />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span>Accept PayPal</span>
                    <Switch data-testid="switch-accept-paypal" />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span>Accept bank transfers</span>
                    <Switch data-testid="switch-accept-transfers" />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span>Allow payment on completion</span>
                    <Switch data-testid="switch-payment-on-completion" />
                  </div>
                </div>
              </div>

              {/* Rescheduling & Cancellations */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Rescheduling & Cancellations</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reschedulePolicy">Allow rescheduling up to</Label>
                    <Select defaultValue="24">
                      <SelectTrigger data-testid="select-reschedule-policy">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 hours before</SelectItem>
                        <SelectItem value="4">4 hours before</SelectItem>
                        <SelectItem value="24">24 hours before</SelectItem>
                        <SelectItem value="48">48 hours before</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cancellationPolicy">Allow cancellation up to</Label>
                    <Select defaultValue="48">
                      <SelectTrigger data-testid="select-cancellation-policy">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">4 hours before</SelectItem>
                        <SelectItem value="24">24 hours before</SelectItem>
                        <SelectItem value="48">48 hours before</SelectItem>
                        <SelectItem value="72">72 hours before</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invite Editors Tab */}
        <TabsContent value="invite-editors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Invite Editor to Partner
              </CardTitle>
              <p className="text-sm text-gray-600">
                Send partnership invitations to professional photo editors
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleEditorInviteSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="editorEmail">Editor Email Address</Label>
                    <Input
                      id="editorEmail"
                      name="editorEmail"
                      type="email"
                      value={editorFormData.editorEmail}
                      onChange={handleEditorInputChange}
                      placeholder="editor@example.com"
                      required
                      data-testid="input-editor-email"
                    />
                    <p className="text-xs text-gray-500">
                      Enter the email address of the editor you want to invite
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editorStudioName">Editor Studio Name</Label>
                    <Input
                      id="editorStudioName"
                      name="editorStudioName"
                      value={editorFormData.editorStudioName}
                      onChange={handleEditorInputChange}
                      placeholder="Studio Name or Individual Editor"
                      required
                      data-testid="input-editor-studio-name"
                    />
                    <p className="text-xs text-gray-500">
                      The name of the editor's studio or business
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Partnership Benefits</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Direct job assignments through your workflow</li>
                    <li>• Streamlined file upload and delivery process</li>
                    <li>• Integrated communication and project tracking</li>
                    <li>• Professional partnership management tools</li>
                  </ul>
                </div>

                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={inviteMutation.isPending}
                    className="bg-[#f2572c] hover:bg-[#d94722] text-white"
                    data-testid="button-send-editor-invite"
                  >
                    {inviteMutation.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Partnership Invitation
                      </>
                    )}
                  </Button>
                </div>
              </form>

              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">How Partnership Invitations Work</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Send className="w-6 h-6 text-blue-600" />
                    </div>
                    <h4 className="font-medium mb-2">Send Invitation</h4>
                    <p className="text-sm text-gray-600">
                      Editor receives an email invitation to partner with your studio
                    </p>
                  </div>

                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Mail className="w-6 h-6 text-green-600" />
                    </div>
                    <h4 className="font-medium mb-2">Editor Accepts</h4>
                    <p className="text-sm text-gray-600">
                      Editor reviews and accepts the partnership invitation
                    </p>
                  </div>

                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Handshake className="w-6 h-6 text-purple-600" />
                    </div>
                    <h4 className="font-medium mb-2">Start Collaborating</h4>
                    <p className="text-sm text-gray-600">
                      Editor appears in your suppliers list for job assignments
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Editing Options Tab */}
        <TabsContent value="editing-options" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="w-5 h-5" />
                Editing Options
              </CardTitle>
              <p className="text-sm text-gray-600">
                Define the editing options available for your customer preferences. These options will be available when setting up editing preferences for each customer.
              </p>
            </CardHeader>
            <CardContent>
              <EditingOptionsManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Partnerships Tab */}
        <TabsContent value="partnerships" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Handshake className="w-5 h-5" />
                Active Editor Partnerships
              </CardTitle>
              <p className="text-sm text-gray-600">
                Manage your partnerships with professional photo editors
              </p>
            </CardHeader>
            <CardContent>
              {partnershipsLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-24 bg-gray-200 rounded"></div>
                  <div className="h-24 bg-gray-200 rounded"></div>
                  <div className="h-24 bg-gray-200 rounded"></div>
                </div>
              ) : partnerships.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-gray-900 mb-2">No Active Partnerships</h3>
                  <p className="text-gray-600 mb-6">
                    Start building your network of professional photo editors by sending partnership invitations.
                  </p>
                  <Button
                    onClick={() => setActiveTab("invite-editors")}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    data-testid="button-goto-invite-editors"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite Your First Editor
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-600">
                      {partnerships.length} active partnership{partnerships.length !== 1 ? 's' : ''}
                    </p>
                    <Button
                      onClick={() => setActiveTab("invite-editors")}
                      variant="outline"
                      size="sm"
                      data-testid="button-invite-more-editors"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Invite More Editors
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {partnerships.map((partnership, index) => (
                      <Card key={index} className="border-l-4 border-l-green-500">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <h3 className="font-medium text-gray-900" data-testid={`text-partnership-name-${index}`}>
                                  {partnership.editorStudioName}
                                </h3>
                                <p className="text-sm text-gray-600" data-testid={`text-partnership-email-${index}`}>
                                  {partnership.editorEmail}
                                </p>
                              </div>
                            </div>
                            <Badge 
                              variant="default"
                              className="bg-green-100 text-green-800 hover:bg-green-100"
                              data-testid={`badge-partnership-status-${index}`}
                            >
                              Active
                            </Badge>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex items-center text-gray-600">
                              <Calendar className="w-4 h-4 mr-2" />
                              <span>Partnered {formatDate(partnership.acceptedAt)}</span>
                            </div>
                            <div className="flex items-center text-gray-600">
                              <Handshake className="w-4 h-4 mr-2" />
                              <span>Available for job assignments</span>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1"
                              data-testid={`button-contact-partner-${index}`}
                            >
                              <Mail className="w-4 h-4 mr-1" />
                              Contact
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              data-testid={`button-view-partnership-${index}`}
                            >
                              View Details
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}