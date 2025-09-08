import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useEditorAuth } from "@/contexts/EditorAuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { User, MapPin, Phone, Mail, Camera, DollarSign, Clock, Settings, Handshake, Calendar, Users, Building2, Plus, Edit2, Trash2, Package } from "lucide-react";

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

interface ServiceCategory {
  id: string;
  editorId: string;
  name: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
  createdAt: Date;
}

interface EditorService {
  id: string;
  editorId: string;
  categoryId?: string;
  name: string;
  description?: string;
  basePrice: string;
  pricePer?: string;
  estimatedTurnaround?: string;
  isActive?: boolean;
  displayOrder?: number;
  createdAt: Date;
}

export default function EditorSettings() {
  const { userData } = useEditorAuth();
  const { toast } = useToast();

  // Fetch editor's partnerships
  const { data: partnerships = [], isLoading: partnershipsLoading } = useQuery<Partnership[]>({
    queryKey: ['/api/editor/partnerships'],
    retry: false
  });

  // Fetch service categories
  const { data: serviceCategories = [], isLoading: categoriesLoading } = useQuery<ServiceCategory[]>({
    queryKey: ['/api/editor/service-categories'],
    retry: false
  });

  // Fetch editor services
  const { data: editorServices = [], isLoading: servicesLoading } = useQuery<EditorService[]>({
    queryKey: ['/api/editor/services'],
    retry: false
  });

  // Dialog states
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [editingService, setEditingService] = useState<EditorService | null>(null);

  // Form states
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: ''
  });

  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    basePrice: '',
    pricePer: 'image',
    estimatedTurnaround: '',
    categoryId: '',
    isActive: true
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

  // Mutations for service categories
  const createCategoryMutation = useMutation({
    mutationFn: (categoryData: any) => apiRequest('/api/editor/service-categories', {
      method: 'POST',
      body: JSON.stringify(categoryData)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/editor/service-categories'] });
      setCategoryDialogOpen(false);
      resetCategoryForm();
      toast({ title: "Success", description: "Category created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create category", variant: "destructive" });
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => apiRequest(`/api/editor/service-categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/editor/service-categories'] });
      setCategoryDialogOpen(false);
      resetCategoryForm();
      toast({ title: "Success", description: "Category updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update category", variant: "destructive" });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/editor/service-categories/${id}`, {
      method: 'DELETE'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/editor/service-categories'] });
      toast({ title: "Success", description: "Category deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete category", variant: "destructive" });
    }
  });

  // Mutations for services
  const createServiceMutation = useMutation({
    mutationFn: (serviceData: any) => apiRequest('/api/editor/services', {
      method: 'POST',
      body: JSON.stringify(serviceData)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/editor/services'] });
      setServiceDialogOpen(false);
      resetServiceForm();
      toast({ title: "Success", description: "Service created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create service", variant: "destructive" });
    }
  });

  const updateServiceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => apiRequest(`/api/editor/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/editor/services'] });
      setServiceDialogOpen(false);
      resetServiceForm();
      toast({ title: "Success", description: "Service updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update service", variant: "destructive" });
    }
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/editor/services/${id}`, {
      method: 'DELETE'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/editor/services'] });
      toast({ title: "Success", description: "Service deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete service", variant: "destructive" });
    }
  });

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

  // Helper functions
  const resetCategoryForm = () => {
    setCategoryForm({ name: '', description: '' });
    setEditingCategory(null);
  };

  const resetServiceForm = () => {
    setServiceForm({
      name: '',
      description: '',
      basePrice: '',
      pricePer: 'image',
      estimatedTurnaround: '',
      categoryId: '',
      isActive: true
    });
    setEditingService(null);
  };

  const handleCreateCategory = () => {
    setEditingCategory(null);
    resetCategoryForm();
    setCategoryDialogOpen(true);
  };

  const handleEditCategory = (category: ServiceCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || ''
    });
    setCategoryDialogOpen(true);
  };

  const handleCreateService = () => {
    setEditingService(null);
    resetServiceForm();
    setServiceDialogOpen(true);
  };

  const handleEditService = (service: EditorService) => {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      description: service.description || '',
      basePrice: service.basePrice,
      pricePer: service.pricePer || 'image',
      estimatedTurnaround: service.estimatedTurnaround || '',
      categoryId: service.categoryId || '',
      isActive: service.isActive !== false
    });
    setServiceDialogOpen(true);
  };

  const handleSaveCategory = () => {
    if (editingCategory) {
      updateCategoryMutation.mutate({
        id: editingCategory.id,
        data: categoryForm
      });
    } else {
      createCategoryMutation.mutate(categoryForm);
    }
  };

  const handleSaveService = () => {
    const serviceData = {
      ...serviceForm,
      basePrice: parseFloat(serviceForm.basePrice).toString()
    };
    
    if (editingService) {
      updateServiceMutation.mutate({
        id: editingService.id,
        data: serviceData
      });
    } else {
      createServiceMutation.mutate(serviceData);
    }
  };

  const handleDeleteCategory = (id: string) => {
    if (confirm('Are you sure you want to delete this category? This will also remove all services in this category.')) {
      deleteCategoryMutation.mutate(id);
    }
  };

  const handleDeleteService = (id: string) => {
    if (confirm('Are you sure you want to delete this service?')) {
      deleteServiceMutation.mutate(id);
    }
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

          {/* Service Categories */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  <CardTitle>Service Categories</CardTitle>
                </div>
                <Button onClick={handleCreateCategory} size="sm" data-testid="button-create-category">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Category
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {categoriesLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-16 bg-gray-200 rounded"></div>
                  <div className="h-16 bg-gray-200 rounded"></div>
                </div>
              ) : serviceCategories.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Categories</h3>
                  <p className="text-gray-600 mb-4">
                    Create categories to organize your services for partners.
                  </p>
                  <Button onClick={handleCreateCategory} data-testid="button-create-first-category">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Category
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {serviceCategories.map((category) => (
                    <div key={category.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900" data-testid={`text-category-name-${category.id}`}>
                          {category.name}
                        </h4>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditCategory(category)}
                            data-testid={`button-edit-category-${category.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteCategory(category.id)}
                            data-testid={`button-delete-category-${category.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {category.description && (
                        <p className="text-sm text-gray-600">{category.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Services Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  <CardTitle>Services & Pricing</CardTitle>
                </div>
                <Button onClick={handleCreateService} size="sm" data-testid="button-create-service">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Service
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {servicesLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-20 bg-gray-200 rounded"></div>
                  <div className="h-20 bg-gray-200 rounded"></div>
                </div>
              ) : editorServices.length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Services</h3>
                  <p className="text-gray-600 mb-4">
                    Add services that partners can select when uploading projects to you.
                  </p>
                  <Button onClick={handleCreateService} data-testid="button-create-first-service">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Service
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {editorServices.map((service) => {
                    const category = serviceCategories.find(cat => cat.id === service.categoryId);
                    return (
                      <div key={service.id} className="grid grid-cols-4 gap-4 p-4 border border-gray-200 rounded-lg">
                        <div>
                          <Label>Service Name</Label>
                          <p className="font-medium text-gray-900" data-testid={`text-service-name-${service.id}`}>
                            {service.name}
                          </p>
                          {category && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {category.name}
                            </Badge>
                          )}
                        </div>
                        <div>
                          <Label>Price (${service.pricePer || 'image'})</Label>
                          <p className="font-medium text-gray-900" data-testid={`text-service-price-${service.id}`}>
                            ${parseFloat(service.basePrice).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <Label>Turnaround</Label>
                          <p className="text-gray-700" data-testid={`text-service-turnaround-${service.id}`}>
                            {service.estimatedTurnaround || 'Not specified'}
                          </p>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <Badge variant={service.isActive !== false ? 'default' : 'secondary'}>
                            {service.isActive !== false ? 'Active' : 'Inactive'}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditService(service)}
                            data-testid={`button-edit-service-${service.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteService(service.id)}
                            data-testid={`button-delete-service-${service.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                  {editorServices.filter(service => service.isActive !== false).slice(0, 5).map((service) => (
                    <div key={service.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{service.name}</span>
                      <Badge variant="outline">${parseFloat(service.basePrice).toFixed(2)}</Badge>
                    </div>
                  ))}
                  {editorServices.filter(service => service.isActive !== false).length > 5 && (
                    <p className="text-xs text-gray-500 text-center">
                      +{editorServices.filter(service => service.isActive !== false).length - 5} more services
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Service Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Category' : 'Create Category'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory ? 'Update category details' : 'Create a new category to organize your services'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="categoryName">Category Name</Label>
              <Input
                id="categoryName"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Photo Editing, Virtual Staging"
                data-testid="input-category-name"
              />
            </div>
            <div>
              <Label htmlFor="categoryDescription">Description (Optional)</Label>
              <Textarea
                id="categoryDescription"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe this category..."
                rows={3}
                data-testid="input-category-description"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setCategoryDialogOpen(false)}
                data-testid="button-cancel-category"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveCategory}
                disabled={!categoryForm.name.trim() || createCategoryMutation.isPending || updateCategoryMutation.isPending}
                data-testid="button-save-category"
              >
                {editingCategory ? 'Update' : 'Create'} Category
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Service Dialog */}
      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Edit Service' : 'Create Service'}
            </DialogTitle>
            <DialogDescription>
              {editingService ? 'Update service details and pricing' : 'Create a new service that partners can select'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="serviceName">Service Name</Label>
                <Input
                  id="serviceName"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Basic Photo Editing"
                  data-testid="input-service-name"
                />
              </div>
              <div>
                <Label htmlFor="serviceCategory">Category (Optional)</Label>
                <Select
                  value={serviceForm.categoryId}
                  onValueChange={(value) => setServiceForm(prev => ({ ...prev, categoryId: value }))}
                >
                  <SelectTrigger data-testid="select-service-category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Category</SelectItem>
                    {serviceCategories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="serviceDescription">Description (Optional)</Label>
              <Textarea
                id="serviceDescription"
                value={serviceForm.description}
                onChange={(e) => setServiceForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this service includes..."
                rows={3}
                data-testid="input-service-description"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="servicePrice">Base Price ($)</Label>
                <Input
                  id="servicePrice"
                  type="number"
                  step="0.25"
                  min="0"
                  value={serviceForm.basePrice}
                  onChange={(e) => setServiceForm(prev => ({ ...prev, basePrice: e.target.value }))}
                  placeholder="0.00"
                  data-testid="input-service-price"
                />
              </div>
              <div>
                <Label htmlFor="pricePer">Price Per</Label>
                <Select
                  value={serviceForm.pricePer}
                  onValueChange={(value) => setServiceForm(prev => ({ ...prev, pricePer: value }))}
                >
                  <SelectTrigger data-testid="select-price-per">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Per Image</SelectItem>
                    <SelectItem value="property">Per Property</SelectItem>
                    <SelectItem value="hour">Per Hour</SelectItem>
                    <SelectItem value="fixed">Fixed Price</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="turnaround">Est. Turnaround</Label>
                <Input
                  id="turnaround"
                  value={serviceForm.estimatedTurnaround}
                  onChange={(e) => setServiceForm(prev => ({ ...prev, estimatedTurnaround: e.target.value }))}
                  placeholder="e.g., 24 hours, 2-3 days"
                  data-testid="input-service-turnaround"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="serviceActive"
                checked={serviceForm.isActive}
                onCheckedChange={(checked) => setServiceForm(prev => ({ ...prev, isActive: checked }))}
                data-testid="switch-service-active"
              />
              <Label htmlFor="serviceActive">Service is active and available to partners</Label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setServiceDialogOpen(false)}
                data-testid="button-cancel-service"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveService}
                disabled={!serviceForm.name.trim() || !serviceForm.basePrice || createServiceMutation.isPending || updateServiceMutation.isPending}
                data-testid="button-save-service"
              >
                {editingService ? 'Update' : 'Create'} Service
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}