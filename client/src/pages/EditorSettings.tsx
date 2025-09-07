import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { User, MapPin, Phone, Mail, Camera, DollarSign, Clock, Settings } from "lucide-react";

export default function EditorSettings() {
  const { userData } = useAuth();
  
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