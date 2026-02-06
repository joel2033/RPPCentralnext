import { useState, useEffect, useRef } from "react";
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
import BookingFormSettings from "@/components/booking/BookingFormSettings";
import ServiceAreasManager from "@/components/ServiceAreasManager";
import { IntegrationsSection } from "@/components/IntegrationsSection";
import { useAuth } from "@/contexts/AuthContext";
import {
  Building2,
  User,
  Clock,
  MapPin,
  Save,
  Users,
  UserPlus,
  Send,
  Mail,
  Handshake,
  Wand2,
  CheckCircle2,
  XCircle,
  Cog,
  Edit2,
  X,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Link2,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

interface PersonalProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bio: string;
  profileImage?: string;
}

interface BusinessProfile {
  businessName: string;
  tagline: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  description: string;
  timeZone?: string;
}

interface BusinessHours {
  [key: string]: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export interface DeliveryEmailDefaults {
  subjectTemplate?: string;
  messageTemplate?: string;
}

export interface EmailSettings {
  deliveryEmail?: DeliveryEmailDefaults;
}

interface SavedSettings {
  personalProfile?: PersonalProfile;
  businessProfile?: BusinessProfile;
  businessHours?: BusinessHours;
  enableClientRevisionLimit?: boolean;
  clientRevisionRoundLimit?: number;
  editorDisplayNames?: Record<string, string>; // {editorId: customName}
  teamMemberColors?: Record<string, string>; // {userId: colorHex}
  emailSettings?: EmailSettings;
}

export default function Settings() {
  const { userData } = useAuth();
  const isPhotographer = userData?.role === 'photographer';
  
  // Get initial tab from URL hash, or default based on role
  const validTabs = ['company', 'team', 'services', 'booking', 'account', 'availability', 'integrations', 'advanced'];
  const getInitialTab = () => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      const tabPart = hash.split('&')[0] || '';
      if (tabPart && validTabs.includes(tabPart)) {
        return tabPart;
      }
    }
    return isPhotographer ? "account" : "company";
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [bookingSaveHandler, setBookingSaveHandler] = useState<(() => void) | null>(null);
  const [xeroSaveHandler, setXeroSaveHandler] = useState<(() => void) | null>(null);
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
    bio: "",
    profileImage: ""
  });
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);

  // State for business profile
  const [businessProfile, setBusinessProfile] = useState({
    businessName: "Real Property Photography",
    tagline: "Professional Real Estate Photography Services",
    email: "contact@realpropertyphoto.com",
    phone: "(555) 123-4567",
    address: "123 Business St, City, State 12345",
    website: "https://realpropertyphoto.com",
    description: "We provide high-quality real estate photography services to help showcase properties in their best light.",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Australia/Sydney",
  });

  // Enable client revision limit toggle and round limit
  const [enableClientRevisionLimit, setEnableClientRevisionLimit] = useState(false);
  const [clientRevisionRoundLimit, setClientRevisionRoundLimit] = useState(2);

  // Editor display names (custom names for photographers)
  const [editorDisplayNames, setEditorDisplayNames] = useState<Record<string, string>>({});
  const [editingEditorId, setEditingEditorId] = useState<string | null>(null);
  const [tempEditorDisplayNames, setTempEditorDisplayNames] = useState<Record<string, string>>({});
  const [expandedDisplayNames, setExpandedDisplayNames] = useState<Set<string>>(new Set());

  // Team member colors (custom colors per user for identification)
  const [teamMemberColors, setTeamMemberColors] = useState<Record<string, string>>({});

  // Default email configurations (e.g. delivery email templates)
  const [deliveryEmailDefaults, setDeliveryEmailDefaults] = useState<DeliveryEmailDefaults>({
    subjectTemplate: "",
    messageTemplate: ""
  });
  const deliveryMessageTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Editor invitation form data
  const [editorFormData, setEditorFormData] = useState({
    editorEmail: "",
    editorStudioName: ""
  });

  // Team member invitation form data
  const [teamMemberFormData, setTeamMemberFormData] = useState({
    name: "",
    email: "",
    role: "photographer" as "admin" | "photographer"
  });

  // Load saved settings from backend
  const { data: savedSettings, isLoading: settingsLoading } = useQuery<SavedSettings>({
    queryKey: ['/api/settings']
  });

  // Update activeTab when URL hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const tabPart = hash.split('&')[0] || '';
      if (tabPart && validTabs.includes(tabPart)) {
        setActiveTab(tabPart);
      }
    };
    
    // Check hash on mount
    handleHashChange();
    
    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update activeTab when userData loads to ensure photographers start on account tab
  useEffect(() => {
    if (!userData) return;
    
    const isPhotographerRole = userData.role === 'photographer';
    // Only override if no hash is set
    if (!window.location.hash) {
      if (isPhotographerRole && activeTab !== 'account' && activeTab !== 'availability' && activeTab !== 'integrations' && activeTab !== 'advanced') {
        setActiveTab('account');
      } else if (!isPhotographerRole && activeTab === 'availability') {
        setActiveTab('company');
      }
    }
  }, [userData, activeTab]);

  // Update state when settings are loaded
  useEffect(() => {
    if (savedSettings) {
      if (savedSettings.personalProfile) {
        setPersonalProfile({
          firstName: savedSettings.personalProfile.firstName || "",
          lastName: savedSettings.personalProfile.lastName || "",
          email: savedSettings.personalProfile.email || userData?.email || "",
          phone: savedSettings.personalProfile.phone || "",
          bio: savedSettings.personalProfile.bio || "",
          profileImage: savedSettings.personalProfile.profileImage || ""
        });
      } else if (userData?.email) {
        // For photographers, initialize from userData if available
        if (isPhotographer && userData.firstName && userData.lastName) {
          setPersonalProfile({
            firstName: userData.firstName || "",
            lastName: userData.lastName || "",
            email: userData.email || "",
            phone: "",
            bio: "",
            profileImage: ""
          });
        } else {
          setPersonalProfile(prev => ({
            ...prev,
            email: userData.email || ""
          }));
        }
      }
      if (savedSettings.businessProfile) {
        setBusinessProfile(savedSettings.businessProfile);
      }
      if (savedSettings.businessHours) {
        setBusinessHours(savedSettings.businessHours);
      }
      if (savedSettings.enableClientRevisionLimit !== undefined) {
        setEnableClientRevisionLimit(savedSettings.enableClientRevisionLimit);
      }
      if (savedSettings.clientRevisionRoundLimit !== undefined) {
        setClientRevisionRoundLimit(savedSettings.clientRevisionRoundLimit);
      }
      if (savedSettings.editorDisplayNames) {
        setEditorDisplayNames(savedSettings.editorDisplayNames);
        setTempEditorDisplayNames(savedSettings.editorDisplayNames);
      }
      if (savedSettings.teamMemberColors) {
        setTeamMemberColors(savedSettings.teamMemberColors);
      }
      if (savedSettings.emailSettings?.deliveryEmail) {
        setDeliveryEmailDefaults({
          subjectTemplate: savedSettings.emailSettings.deliveryEmail.subjectTemplate ?? "",
          messageTemplate: savedSettings.emailSettings.deliveryEmail.messageTemplate ?? ""
        });
      }
    } else if (userData?.email) {
      // For photographers, initialize from userData if available
      if (isPhotographer && userData.firstName && userData.lastName) {
        setPersonalProfile({
          firstName: userData.firstName || "",
          lastName: userData.lastName || "",
          email: userData.email || "",
          phone: "",
          bio: "",
          profileImage: ""
        });
      } else {
        setPersonalProfile(prev => ({
          ...prev,
          email: userData.email || ""
        }));
      }
    }
  }, [savedSettings, userData, isPhotographer]);

  // Fetch active partnerships
  const { data: partnerships = [], isLoading: partnershipsLoading } = useQuery<Partnership[]>({
    queryKey: ['/api/partnerships'],
    retry: false
  });

  // Fetch actual users (team members who have accepted)
  const { data: actualUsers = [], isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ['/api/users'],
    retry: false
  });

  // Fetch pending invites (team members who haven't joined yet)
  const { data: pendingInvites = [], isLoading: invitesLoading } = useQuery<any[]>({
    queryKey: [`/api/team/invites/${userData?.partnerId}`],
    enabled: !!userData?.partnerId,
    retry: false
  });

  // Combine actual users and pending invites
  const teamMembers = [
    ...actualUsers.map((user: any) => ({
      id: user.id,
      name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email,
      email: user.email,
      role: user.role,
      status: 'active'
    })),
    ...pendingInvites.map((invite: any) => ({
      token: invite.inviteToken,
      name: invite.email, // Pending invites don't have names yet
      email: invite.email,
      role: invite.role,
      status: 'pending'
    }))
  ];

  const teamMembersLoading = usersLoading || invitesLoading;

  // Handle profile image upload
  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image under 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingProfileImage(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;

        try {
          // Upload to server
          const response = await apiRequest("/api/user/profile-image", "POST", {
            image: base64String
          });

          setPersonalProfile(prev => ({ ...prev, profileImage: response.imageUrl }));

          toast({
            title: "Profile Picture Updated",
            description: "Your profile picture has been uploaded successfully.",
          });
        } catch (error: any) {
          toast({
            title: "Upload Failed",
            description: error.message || "Failed to upload profile picture",
            variant: "destructive",
          });
        } finally {
          setUploadingProfileImage(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setUploadingProfileImage(false);
      toast({
        title: "Upload Failed",
        description: "Failed to process image",
        variant: "destructive",
      });
    }
  };

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: { businessProfile?: any; personalProfile?: any; businessHours?: any; enableClientRevisionLimit?: boolean; clientRevisionRoundLimit?: number; editorDisplayNames?: Record<string, string>; teamMemberColors?: Record<string, string>; emailSettings?: EmailSettings }) => {
      return apiRequest("/api/settings", "PUT", data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      if (variables.editorDisplayNames !== undefined) {
        const updatedNames = variables.editorDisplayNames || {};
        setEditorDisplayNames(updatedNames);
        setTempEditorDisplayNames(updatedNames);
        if (editingEditorId) {
          setEditingEditorId(null);
        }
      }
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

      setEditorFormData({
        editorEmail: "",
        editorStudioName: ""
      });

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

  // Team member invitation mutation
  const teamInviteMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; role: string }) => {
      return apiRequest("/api/team/invite", "POST", data);
    },
    onSuccess: (result) => {
      toast({
        title: "Team Member Invited!",
        description: `Invitation sent successfully.`,
      });

      setTeamMemberFormData({
        name: "",
        email: "",
        role: "photographer"
      });

      queryClient.invalidateQueries({ queryKey: [`/api/team/invites/${userData?.partnerId}`] });
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
      businessHours,
      enableClientRevisionLimit,
      clientRevisionRoundLimit,
      editorDisplayNames: Object.keys(editorDisplayNames).length > 0 ? editorDisplayNames : undefined,
      teamMemberColors: Object.keys(teamMemberColors).length > 0 ? teamMemberColors : undefined,
      emailSettings: { deliveryEmail: deliveryEmailDefaults }
    });
  };

  // Save only email defaults (dedicated endpoint so they always persist)
  const saveEmailSettingsMutation = useMutation({
    mutationFn: async (emailSettings: EmailSettings) => {
      return apiRequest("/api/settings/email", "PUT", { emailSettings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Email defaults saved",
        description: "Your delivery email template has been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save email defaults",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSaveEmailDefaults = () => {
    saveEmailSettingsMutation.mutate({ deliveryEmail: deliveryEmailDefaults });
  };

  const insertPlaceholderInMessage = (placeholder: string) => {
    const el = deliveryMessageTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = deliveryEmailDefaults.messageTemplate ?? "";
    const next = current.slice(0, start) + placeholder + current.slice(end);
    const newLen = Math.min(next.length, 1000);
    setDeliveryEmailDefaults((prev) => ({
      ...prev,
      messageTemplate: next.slice(0, 1000),
    }));
    requestAnimationFrame(() => {
      el.focus();
      const pos = Math.min(start + placeholder.length, newLen);
      el.setSelectionRange(pos, pos);
    });
  };

  const handleSaveEditorDisplayName = (editorId: string) => {
    const newNames = { ...tempEditorDisplayNames };
    if (!newNames[editorId] || newNames[editorId].trim() === '') {
      delete newNames[editorId];
    }
    const updatedNames = Object.keys(newNames).length > 0 ? newNames : undefined;
    saveSettingsMutation.mutate({
      personalProfile,
      businessProfile,
      businessHours,
      enableClientRevisionLimit,
      clientRevisionRoundLimit,
      editorDisplayNames: updatedNames,
      teamMemberColors: Object.keys(teamMemberColors).length > 0 ? teamMemberColors : undefined,
      emailSettings: { deliveryEmail: deliveryEmailDefaults }
    });
  };

  const handleCancelEditorDisplayName = (editorId: string) => {
    setTempEditorDisplayNames(prev => {
      const updated = { ...prev };
      if (editorDisplayNames[editorId]) {
        updated[editorId] = editorDisplayNames[editorId];
      } else {
        delete updated[editorId];
      }
      return updated;
    });
    setEditingEditorId(null);
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

  const handleTeamMemberInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!teamMemberFormData.name.trim() || !teamMemberFormData.email.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in both name and email.",
        variant: "destructive",
      });
      return;
    }

    teamInviteMutation.mutate(teamMemberFormData);
  };

  const handleTeamMemberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTeamMemberFormData(prev => ({ ...prev, [name]: value }));
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your business and account settings</p>
        </div>
        {/* Save button in header */}
        {activeTab === 'booking' ? (
          <Button
            className="bg-[#f2572c] hover:bg-[#d94820] text-white"
            onClick={() => bookingSaveHandler?.()}
            disabled={!bookingSaveHandler}
            data-testid="button-save-booking-settings"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Booking Settings
          </Button>
        ) : (
          <Button 
            className="bg-[#f2572c] hover:bg-[#d94820] text-white"
            onClick={() => {
              handleSaveSettings();
              if (activeTab === 'integrations') xeroSaveHandler?.();
            }}
            disabled={saveSettingsMutation.isPending}
            data-testid="button-save-settings"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveSettingsMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className={`grid w-full ${isPhotographer ? 'grid-cols-5' : 'grid-cols-7'}`}>
          {!isPhotographer && (
            <>
              <TabsTrigger value="company" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span>Business</span>
              </TabsTrigger>
              <TabsTrigger value="team" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>Team</span>
              </TabsTrigger>
              <TabsTrigger value="services" className="flex items-center gap-2">
                <Wand2 className="w-4 h-4" />
                <span>Services</span>
              </TabsTrigger>
              <TabsTrigger value="booking" className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                <span>Booking</span>
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="account" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span>Account</span>
          </TabsTrigger>
          {isPhotographer && (
            <TabsTrigger value="availability" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Availability hours</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            <span>Integrations</span>
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <Cog className="w-4 h-4" />
            <span>Advanced</span>
          </TabsTrigger>
        </TabsList>

        {/* Company Tab */}
        <TabsContent value="company" className="space-y-6">
          {/* Business Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Business Profile
              </CardTitle>
              <p className="text-sm text-gray-600">
                Manage your business information and public profile
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
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
                    data-testid="input-tagline"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessEmail">Email</Label>
                  <Input
                    id="businessEmail"
                    type="email"
                    value={businessProfile.email}
                    onChange={(e) => setBusinessProfile(prev => ({ ...prev, email: e.target.value }))}
                    data-testid="input-business-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessPhone">Phone</Label>
                  <Input
                    id="businessPhone"
                    value={businessProfile.phone}
                    onChange={(e) => setBusinessProfile(prev => ({ ...prev, phone: e.target.value }))}
                    data-testid="input-business-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={businessProfile.website}
                    onChange={(e) => setBusinessProfile(prev => ({ ...prev, website: e.target.value }))}
                    data-testid="input-website"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={businessProfile.address}
                    onChange={(e) => setBusinessProfile(prev => ({ ...prev, address: e.target.value }))}
                    data-testid="input-address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeZone">Business Time Zone</Label>
                  <Select
                    value={businessProfile.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Australia/Sydney"}
                    onValueChange={(value) =>
                      setBusinessProfile((prev) => ({ ...prev, timeZone: value }))
                    }
                  >
                    <SelectTrigger id="timeZone" data-testid="select-business-timezone">
                      <SelectValue placeholder="Select time zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Australia */}
                      <SelectItem value="Australia/Sydney">Australia/Sydney (NSW/ACT)</SelectItem>
                      <SelectItem value="Australia/Melbourne">Australia/Melbourne (VIC)</SelectItem>
                      <SelectItem value="Australia/Brisbane">Australia/Brisbane (QLD)</SelectItem>
                      <SelectItem value="Australia/Adelaide">Australia/Adelaide (SA)</SelectItem>
                      <SelectItem value="Australia/Darwin">Australia/Darwin (NT)</SelectItem>
                      <SelectItem value="Australia/Perth">Australia/Perth (WA)</SelectItem>
                      <SelectItem value="Australia/Hobart">Australia/Hobart (TAS)</SelectItem>
                      <SelectItem value="Australia/Lord_Howe">Australia/Lord_Howe</SelectItem>
                      <SelectItem value="Australia/Broken_Hill">Australia/Broken_Hill</SelectItem>
                      <SelectItem value="Australia/Eucla">Australia/Eucla</SelectItem>
                      {/* New Zealand */}
                      <SelectItem value="Pacific/Auckland">Pacific/Auckland (New Zealand)</SelectItem>
                      <SelectItem value="Pacific/Chatham">Pacific/Chatham (Chatham Islands)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    This time zone will be used as the default reference for your business hours and bookings.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Business Description</Label>
                <Textarea
                  id="description"
                  rows={4}
                  value={businessProfile.description}
                  onChange={(e) => setBusinessProfile(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your business..."
                  data-testid="textarea-description"
                />
              </div>
            </CardContent>
          </Card>

          {/* Operating Hours */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Operating Hours
              </CardTitle>
              <p className="text-sm text-gray-600">
                Set your weekly business hours
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(businessHours).map(([day, hours]) => (
                <div key={day} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="w-28">
                    <span className="font-medium">{dayNames[day as keyof typeof dayNames]}</span>
                  </div>
                  <Switch
                    checked={hours.enabled}
                    onCheckedChange={(checked) => handleBusinessHoursChange(day, 'enabled', checked)}
                    data-testid={`switch-${day}`}
                  />
                  {hours.enabled && (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="time"
                        value={hours.start}
                        onChange={(e) => handleBusinessHoursChange(day, 'start', e.target.value)}
                        className="w-32"
                        data-testid={`input-${day}-start`}
                      />
                      <span>to</span>
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
            </CardContent>
          </Card>

          {/* Delivery Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Delivery Settings</CardTitle>
              <p className="text-sm text-gray-600">
                Configure default settings for client deliveries
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="enableClientRevisionLimit">Limit client revision requests</Label>
                  <p className="text-xs text-gray-500">
                    When enabled, end clients will be limited to a set number of revision rounds after job delivery. This does not affect your ability to request unlimited revisions.
                  </p>
                </div>
                <Switch
                  id="enableClientRevisionLimit"
                  checked={enableClientRevisionLimit}
                  onCheckedChange={setEnableClientRevisionLimit}
                  data-testid="toggle-client-revision-limit"
                />
              </div>
              
              {enableClientRevisionLimit && (
                <div className="pt-4 border-t border-gray-100">
                  <div className="space-y-2">
                    <Label htmlFor="clientRevisionRoundLimit">Maximum revision rounds</Label>
                    <Select 
                      value={clientRevisionRoundLimit.toString()}
                      onValueChange={(value) => setClientRevisionRoundLimit(parseInt(value))}
                    >
                      <SelectTrigger className="w-48" data-testid="select-revision-round-limit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 round</SelectItem>
                        <SelectItem value="2">2 rounds</SelectItem>
                        <SelectItem value="3">3 rounds</SelectItem>
                        <SelectItem value="4">4 rounds</SelectItem>
                        <SelectItem value="5">5 rounds</SelectItem>
                        <SelectItem value="6">6 rounds</SelectItem>
                        <SelectItem value="7">7 rounds</SelectItem>
                        <SelectItem value="8">8 rounds</SelectItem>
                        <SelectItem value="9">9 rounds</SelectItem>
                        <SelectItem value="10">10 rounds</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      This is the default limit for all clients. You can override this for individual customers on their profile page.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6">
          {/* Invite Editors */}
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
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={inviteMutation.isPending}
                    className="bg-[#f2572c] hover:bg-[#d94820] text-white"
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
                        Send Invitation
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Active Partnerships */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Handshake className="w-5 h-5" />
                Active Partnerships
              </CardTitle>
              <p className="text-sm text-gray-600">
                Manage your current editor partnerships
              </p>
            </CardHeader>
            <CardContent>
              {partnershipsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-[#f2572c] rounded-full animate-spin"></div>
                </div>
              ) : partnerships.length === 0 ? (
                <div className="text-center py-12">
                  <Handshake className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-2">No active partnerships yet</p>
                  <p className="text-sm text-gray-500">
                    Invite editors to start collaborating on projects
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {partnerships.map((partnership) => (
                    <div 
                      key={partnership.editorId}
                      className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      data-testid={`partnership-${partnership.editorId}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarFallback>{partnership.editorStudioName[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-medium">{partnership.editorStudioName}</h4>
                            <p className="text-sm text-gray-600">{partnership.editorEmail}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Partnered since {formatDate(partnership.acceptedAt)}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      </div>
                      
                      {/* Editor Display Name Section (for partners/admins only) */}
                      {!isPhotographer && partnership.isActive && (
                        <Collapsible 
                          open={expandedDisplayNames.has(partnership.editorId)}
                          onOpenChange={(open) => {
                            setExpandedDisplayNames(prev => {
                              const newSet = new Set(prev);
                              if (open) {
                                newSet.add(partnership.editorId);
                              } else {
                                newSet.delete(partnership.editorId);
                              }
                              return newSet;
                            });
                          }}
                          className="pt-3 border-t mt-3"
                        >
                          <CollapsibleTrigger asChild>
                            <button className="flex items-center justify-between w-full hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded transition-colors">
                              <Label className="text-xs font-medium text-gray-700 cursor-pointer">
                                Display Name for Photographers
                              </Label>
                              <div className="flex items-center gap-2">
                                {editingEditorId !== partnership.editorId && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingEditorId(partnership.editorId);
                                      setTempEditorDisplayNames(prev => ({
                                        ...prev,
                                        [partnership.editorId]: editorDisplayNames[partnership.editorId] || ''
                                      }));
                                      // Expand when editing
                                      setExpandedDisplayNames(prev => new Set(prev).add(partnership.editorId));
                                    }}
                                    className="h-6 px-2 text-xs"
                                  >
                                    <Edit2 className="w-3 h-3 mr-1" />
                                    Edit
                                  </Button>
                                )}
                                {expandedDisplayNames.has(partnership.editorId) ? (
                                  <ChevronUp className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-500" />
                                )}
                              </div>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-2 mt-2">
                            {editingEditorId === partnership.editorId ? (
                              <div className="space-y-2">
                                <Input
                                  value={tempEditorDisplayNames[partnership.editorId] || ''}
                                  onChange={(e) => {
                                    setTempEditorDisplayNames(prev => ({
                                      ...prev,
                                      [partnership.editorId]: e.target.value
                                    }));
                                  }}
                                  placeholder={`Default: ${partnership.editorStudioName}`}
                                  className="h-8 text-sm"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveEditorDisplayName(partnership.editorId)}
                                    disabled={saveSettingsMutation.isPending}
                                    className="h-7 px-3 text-xs bg-[#f2572c] hover:bg-[#d94820] text-white"
                                  >
                                    <Save className="w-3 h-3 mr-1" />
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCancelEditorDisplayName(partnership.editorId)}
                                    className="h-7 px-3 text-xs"
                                  >
                                    <X className="w-3 h-3 mr-1" />
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <p className="text-sm text-gray-900 font-medium">
                                  {editorDisplayNames[partnership.editorId] || partnership.editorStudioName}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Photographers will see: <span className="font-medium text-gray-700">{editorDisplayNames[partnership.editorId] || partnership.editorStudioName}</span>
                                </p>
                              </div>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team Members */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Team Members
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Manage your team and invite new members
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    // Show invite form inline
                    const inviteSection = document.getElementById('team-invite-section');
                    if (inviteSection) {
                      inviteSection.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  data-testid="button-invite-team-member"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite Member
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Invite Form */}
              <div id="team-invite-section" className="p-4 bg-gray-50 rounded-lg space-y-4">
                <h4 className="font-medium">Invite New Team Member</h4>
                <form onSubmit={handleTeamMemberInviteSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="teamMemberName">Name</Label>
                      <Input
                        id="teamMemberName"
                        name="name"
                        value={teamMemberFormData.name}
                        onChange={handleTeamMemberInputChange}
                        placeholder="John Doe"
                        data-testid="input-team-member-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="teamMemberEmail">Email</Label>
                      <Input
                        id="teamMemberEmail"
                        name="email"
                        type="email"
                        value={teamMemberFormData.email}
                        onChange={handleTeamMemberInputChange}
                        placeholder="john@example.com"
                        data-testid="input-team-member-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="teamMemberRole">Role</Label>
                      <Select 
                        value={teamMemberFormData.role}
                        onValueChange={(value) => setTeamMemberFormData(prev => ({ ...prev, role: value as "admin" | "photographer" }))}
                      >
                        <SelectTrigger data-testid="select-team-member-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="photographer">Photographer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={teamInviteMutation.isPending}
                      className="bg-[#f2572c] hover:bg-[#d94820] text-white"
                      data-testid="button-send-team-invite"
                    >
                      {teamInviteMutation.isPending ? "Sending..." : "Send Invitation"}
                    </Button>
                  </div>
                </form>
              </div>

              {/* Team Members List */}
              {teamMembersLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-[#f2572c] rounded-full animate-spin"></div>
                </div>
              ) : teamMembers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">No team members yet</p>
                  <p className="text-sm text-gray-500">
                    Invite team members to collaborate on your projects
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {teamMembers.map((member, index) => (
                    <div 
                      key={member.token || index}
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`team-member-${index}`}
                    >
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarFallback
                            style={member.id && teamMemberColors[member.id] ? { backgroundColor: teamMemberColors[member.id], color: '#ffffff' } : undefined}
                          >
                            {member.name?.[0] || 'T'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-medium">{member.name}</h4>
                          <p className="text-sm text-gray-600">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{member.role}</Badge>
                        {member.status === 'pending' ? (
                          <Badge variant="secondary">Pending</Badge>
                        ) : (
                          <Badge className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        )}
                        {member.status === 'active' && member.id && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Color</span>
                            <input
                              type="color"
                              value={teamMemberColors[member.id] || "#f2572c"}
                              onChange={(e) =>
                                setTeamMemberColors(prev => ({
                                  ...prev,
                                  [member.id]: e.target.value
                                }))
                              }
                              className="h-7 w-7 rounded-full border p-0 bg-transparent cursor-pointer"
                              title="Select team member color"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-6">
          {/* Editing Options */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="w-5 h-5" />
                Editing Options
              </CardTitle>
              <p className="text-sm text-gray-600">
                Define the editing options available for customer preferences
              </p>
            </CardHeader>
            <CardContent>
              <EditingOptionsManager />
            </CardContent>
          </Card>

          {/* Service Areas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Service Areas
              </CardTitle>
              <p className="text-sm text-gray-600">
                Define your service areas and assign team members to specific regions
              </p>
            </CardHeader>
            <CardContent className="overflow-visible">
              <ServiceAreasManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Profile
              </CardTitle>
              <p className="text-sm text-gray-600">
                Manage your personal information
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Picture */}
              <div className="flex items-center gap-4">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={personalProfile.profileImage} />
                  <AvatarFallback className="text-lg">
                    {personalProfile.firstName?.[0] || ''}{personalProfile.lastName?.[0] || ''}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Label>Profile Picture</Label>
                  <p className="text-xs text-gray-500 mt-1 mb-2">{businessProfile.businessName}</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingProfileImage}
                      onClick={() => document.getElementById('profile-image-upload')?.click()}
                    >
                      {uploadingProfileImage ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          Uploading...
                        </>
                      ) : (
                        'Upload Photo'
                      )}
                    </Button>
                    {personalProfile.profileImage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPersonalProfile(prev => ({ ...prev, profileImage: '' }))}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <input
                    id="profile-image-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleProfileImageUpload}
                  />
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
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  rows={4}
                  value={personalProfile.bio}
                  onChange={(e) => setPersonalProfile(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell us about yourself..."
                  data-testid="textarea-personal-bio"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Availability Hours Tab - Photographers only */}
        {isPhotographer && (
          <TabsContent value="availability" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Availability Hours
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Set your weekly availability hours
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(businessHours).map(([day, hours]) => (
                  <div key={day} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="w-28">
                      <span className="font-medium">{dayNames[day as keyof typeof dayNames]}</span>
                    </div>
                    <Switch
                      checked={hours.enabled}
                      onCheckedChange={(checked) => handleBusinessHoursChange(day, 'enabled', checked)}
                      data-testid={`switch-${day}`}
                    />
                    {hours.enabled && (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          type="time"
                          value={hours.start}
                          onChange={(e) => handleBusinessHoursChange(day, 'start', e.target.value)}
                          className="w-32"
                          data-testid={`input-${day}-start`}
                        />
                        <span>to</span>
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
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Booking Tab */}
        <TabsContent value="booking" className="space-y-6">
          <BookingFormSettings
            onRegisterSave={(handler) => setBookingSaveHandler(() => handler)}
          />
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <IntegrationsSection onRegisterXeroSave={(handler) => setXeroSaveHandler(handler != null ? () => handler() : null)} />
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Default email configurations</CardTitle>
              <p className="text-sm text-gray-600">
                Set default subject and message templates for emails. When sending, these will pre-fill the form; you can still edit before sending.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="p-6 border rounded-lg space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Delivery email
                  </h3>
                  <p className="text-sm text-gray-600">
                    Default subject and message used when sending the &quot;photos ready&quot; delivery email to clients. Insert placeholders with the buttons below.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="delivery-email-subject">Subject template</Label>
                    <Input
                      id="delivery-email-subject"
                      value={deliveryEmailDefaults.subjectTemplate}
                      onChange={(e) => setDeliveryEmailDefaults(prev => ({ ...prev, subjectTemplate: e.target.value }))}
                      placeholder="Your photos are ready for {address}"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delivery-email-message">Message template</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className="text-xs text-muted-foreground self-center">Insert at cursor:</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => insertPlaceholderInMessage("[DELIVERY_LINK]")}
                      >
                        [DELIVERY_LINK]
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => insertPlaceholderInMessage("{customerFirstName}")}
                      >
                        {`{customerFirstName}`}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => insertPlaceholderInMessage("{address}")}
                      >
                        {`{address}`}
                      </Button>
                    </div>
                    <Textarea
                      ref={deliveryMessageTextareaRef}
                      id="delivery-email-message"
                      value={deliveryEmailDefaults.messageTemplate}
                      onChange={(e) => setDeliveryEmailDefaults(prev => ({ ...prev, messageTemplate: e.target.value.slice(0, 1000) }))}
                      placeholder={`Hi {customerFirstName},\n\nYour professional property photos for {address} are ready for download!\n\nClick the link below to view and download your high-resolution images:\n\n[DELIVERY_LINK]\n\n...`}
                      rows={8}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground">{deliveryEmailDefaults.messageTemplate.length} / 1000</p>
                  </div>
                  <Button
                    onClick={handleSaveEmailDefaults}
                    disabled={saveEmailSettingsMutation.isPending}
                  >
                    {saveEmailSettingsMutation.isPending ? "Saving..." : "Save email defaults"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>More options</CardTitle>
              <p className="text-sm text-gray-600">
                Additional configuration options (coming soon)
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="p-6 border rounded-lg">
                  <h3 className="font-medium mb-2">Custom Domain</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Connect your own domain for delivery pages and booking forms
                  </p>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>

                <div className="p-6 border rounded-lg">
                  <h3 className="font-medium mb-2">Policies</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Set cancellation, rescheduling, and refund policies
                  </p>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
