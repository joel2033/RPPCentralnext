import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useEditorAuth } from "@/contexts/EditorAuthContext";
import { useQuery } from "@tanstack/react-query";
import { User, MapPin, Phone, Mail, Camera, DollarSign, Clock, Settings, Handshake, Calendar, Users, Building2 } from "lucide-react";

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

export default function EditorSettings() {
  const { userData } = useEditorAuth();

  // Fetch editor's partnerships
  const { data: partnerships = [], isLoading: partnershipsLoading } = useQuery<Partnership[]>({
    queryKey: ['/api/editor/partnerships'],
    retry: false
  });

  // Date formatting helper
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Unknown";
    const date = timestamp._seconds ? new Date(timestamp._seconds * 1000) : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };
  
  // Editor profile settings
  const [profileData, setProfileData] = useState({
    businessName: "Professional Photo Editing Services",
    contactEmail: userData?.email || "",
    contactPhone: "+1 (555) 123-4567",
    location: "New York, NY, USA",
    bio: "Professional photo editor with 8+ years of experience in real estate photography editing. Specializing in HDR processing, virtual staging, and day-to-dusk conversions.",
    website: "https://myeditingservices.com",
    portfolio: "https://portfolio.myeditingservices.com"
  });

  // Business settings
  const [businessSettings, setBusinessSettings] = useState({
    autoAcceptJobs: false,
    maxConcurrentJobs: 5,
    averageTurnaroundHours: 48,
    workingHours: {
      start: "09:00",
      end: "17:00"
    },
    workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    notifications: {
      newJobEmail: true,
      dueDateReminder: true,
      paymentReceived: true
    }
  });

  // Service pricing
  const [servicePricing, setServicePricing] = useState([
    { service: "Basic Photo Editing", price: 2.50, unit: "per photo", turnaround: 24 },
    { service: "HDR Processing", price: 4.00, unit: "per photo", turnaround: 48 },
    { service: "Day to Dusk", price: 8.00, unit: "per photo", turnaround: 72 },
    { service: "Virtual Staging", price: 25.00, unit: "per room", turnaround: 96 }
  ]);

  const handleProfileUpdate = (field: string, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handleBusinessSettingUpdate = (field: string, value: any) => {
    setBusinessSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleNotificationUpdate = (field: string, value: boolean) => {
    setBusinessSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, [field]: value }
    }));
  };

  const handleSaveProfile = () => {
    console.log('Saving profile data:', profileData);
    // This would make an API call to save the profile
  };

  const handleSaveBusinessSettings = () => {
    console.log('Saving business settings:', businessSettings);
    // This would make an API call to save business settings
  };

  const handleSavePricing = () => {
    console.log('Saving pricing:', servicePricing);
    // This would make an API call to save pricing
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your editor profile, business settings, and service pricing</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-blue-600" />
                <CardTitle>Profile Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    value={profileData.businessName}
                    onChange={(e) => handleProfileUpdate('businessName', e.target.value)}
                    data-testid="input-business-name"
                  />
                </div>
                <div>
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={profileData.contactEmail}
                    onChange={(e) => handleProfileUpdate('contactEmail', e.target.value)}
                    data-testid="input-contact-email"
                  />
                </div>
                <div>
                  <Label htmlFor="contactPhone">Phone Number</Label>
                  <Input
                    id="contactPhone"
                    value={profileData.contactPhone}
                    onChange={(e) => handleProfileUpdate('contactPhone', e.target.value)}
                    data-testid="input-contact-phone"
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={profileData.location}
                    onChange={(e) => handleProfileUpdate('location', e.target.value)}
                    data-testid="input-location"
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    value={profileData.website}
                    onChange={(e) => handleProfileUpdate('website', e.target.value)}
                    data-testid="input-website"
                  />
                </div>
                <div>
                  <Label htmlFor="portfolio">Portfolio URL</Label>
                  <Input
                    id="portfolio"
                    type="url"
                    value={profileData.portfolio}
                    onChange={(e) => handleProfileUpdate('portfolio', e.target.value)}
                    data-testid="input-portfolio"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="bio">Professional Bio</Label>
                <Textarea
                  id="bio"
                  value={profileData.bio}
                  onChange={(e) => handleProfileUpdate('bio', e.target.value)}
                  className="min-h-[100px]"
                  data-testid="textarea-bio"
                />
              </div>
              <Button onClick={handleSaveProfile} data-testid="button-save-profile">
                Save Profile
              </Button>
            </CardContent>
          </Card>

          {/* Business Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-blue-600" />
                <CardTitle>Business Settings</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Job Management */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Job Management</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="autoAccept">Auto-accept jobs</Label>
                      <p className="text-sm text-gray-500">Automatically accept jobs that match your criteria</p>
                    </div>
                    <Switch
                      id="autoAccept"
                      checked={businessSettings.autoAcceptJobs}
                      onCheckedChange={(checked) => handleBusinessSettingUpdate('autoAcceptJobs', checked)}
                      data-testid="switch-auto-accept"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="maxJobs">Max Concurrent Jobs</Label>
                      <Input
                        id="maxJobs"
                        type="number"
                        min="1"
                        max="20"
                        value={businessSettings.maxConcurrentJobs}
                        onChange={(e) => handleBusinessSettingUpdate('maxConcurrentJobs', parseInt(e.target.value))}
                        data-testid="input-max-jobs"
                      />
                    </div>
                    <div>
                      <Label htmlFor="turnaround">Average Turnaround (hours)</Label>
                      <Input
                        id="turnaround"
                        type="number"
                        min="1"
                        max="168"
                        value={businessSettings.averageTurnaroundHours}
                        onChange={(e) => handleBusinessSettingUpdate('averageTurnaroundHours', parseInt(e.target.value))}
                        data-testid="input-turnaround"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Working Hours */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Working Hours</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={businessSettings.workingHours.start}
                      onChange={(e) => handleBusinessSettingUpdate('workingHours', {
                        ...businessSettings.workingHours,
                        start: e.target.value
                      })}
                      data-testid="input-start-time"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={businessSettings.workingHours.end}
                      onChange={(e) => handleBusinessSettingUpdate('workingHours', {
                        ...businessSettings.workingHours,
                        end: e.target.value
                      })}
                      data-testid="input-end-time"
                    />
                  </div>
                </div>
              </div>

              {/* Notifications */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Notifications</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="newJobNotif">New job notifications</Label>
                    <Switch
                      id="newJobNotif"
                      checked={businessSettings.notifications.newJobEmail}
                      onCheckedChange={(checked) => handleNotificationUpdate('newJobEmail', checked)}
                      data-testid="switch-new-job-notif"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="dueDateNotif">Due date reminders</Label>
                    <Switch
                      id="dueDateNotif"
                      checked={businessSettings.notifications.dueDateReminder}
                      onCheckedChange={(checked) => handleNotificationUpdate('dueDateReminder', checked)}
                      data-testid="switch-due-date-notif"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="paymentNotif">Payment notifications</Label>
                    <Switch
                      id="paymentNotif"
                      checked={businessSettings.notifications.paymentReceived}
                      onCheckedChange={(checked) => handleNotificationUpdate('paymentReceived', checked)}
                      data-testid="switch-payment-notif"
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveBusinessSettings} data-testid="button-save-business">
                Save Business Settings
              </Button>
            </CardContent>
          </Card>

          {/* Service Pricing */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                <CardTitle>Service Pricing</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {servicePricing.map((service, index) => (
                  <div key={index} className="grid grid-cols-3 gap-4 p-4 border border-gray-200 rounded-lg">
                    <div>
                      <Label>Service Name</Label>
                      <p className="font-medium text-gray-900">{service.service}</p>
                    </div>
                    <div>
                      <Label>Price ({service.unit})</Label>
                      <div className="flex items-center">
                        <span className="text-sm text-gray-500 mr-1">$</span>
                        <Input
                          type="number"
                          step="0.25"
                          min="0"
                          value={service.price}
                          onChange={(e) => {
                            const newPricing = [...servicePricing];
                            newPricing[index].price = parseFloat(e.target.value);
                            setServicePricing(newPricing);
                          }}
                          className="w-20"
                          data-testid={`input-price-${index}`}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Turnaround (hours)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={service.turnaround}
                        onChange={(e) => {
                          const newPricing = [...servicePricing];
                          newPricing[index].turnaround = parseInt(e.target.value);
                          setServicePricing(newPricing);
                        }}
                        className="w-20"
                        data-testid={`input-turnaround-${index}`}
                      />
                    </div>
                  </div>
                ))}
                <Button onClick={handleSavePricing} data-testid="button-save-pricing">
                  Save Pricing
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Active Partnerships */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Handshake className="w-5 h-5 text-blue-600" />
                <CardTitle>Active Partnerships</CardTitle>
              </div>
              <p className="text-sm text-gray-600">
                View your partnerships with real estate photographers
              </p>
            </CardHeader>
            <CardContent>
              {partnershipsLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-20 bg-gray-200 rounded"></div>
                  <div className="h-20 bg-gray-200 rounded"></div>
                </div>
              ) : partnerships.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Partnerships</h3>
                  <p className="text-gray-600">
                    You haven't accepted any partnership invitations yet. Check your invitations tab to see pending requests.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-600">
                      {partnerships.length} active partnership{partnerships.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {partnerships.map((partnership, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <Building2 className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900" data-testid={`text-partner-name-${index}`}>
                                {partnership.partnerName}
                              </h3>
                              <p className="text-sm text-gray-600" data-testid={`text-partner-email-${index}`}>
                                {partnership.partnerEmail}
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

                        <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
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
                            data-testid={`button-view-partnership-details-${index}`}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Profile Summary Sidebar */}
        <div>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Profile Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Camera className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900">{profileData.businessName}</h3>
                <p className="text-sm text-gray-500">{userData?.email}</p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{profileData.location}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span>{profileData.contactPhone}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span>{profileData.contactEmail}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>{businessSettings.averageTurnaroundHours}h avg turnaround</span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">Active Services</h4>
                <div className="space-y-2">
                  {servicePricing.map((service, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{service.service}</span>
                      <Badge variant="outline">${service.price}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}