import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Upload, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface CreateCustomerModalProps {
  onClose: () => void;
}

export default function CreateCustomerModal({ onClose }: CreateCustomerModalProps) {
  const [customerData, setCustomerData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    category: "",
    notes: ""
  });

  const [expandedSections, setExpandedSections] = useState({
    customerDetails: true,
    billingPreferences: false,
    teamMembers: false,
    customerNotes: false
  });

  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { userData } = useAuth();

  const createCustomerMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create customer");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Customer Created",
        description: "Customer has been added successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create customer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({
          title: "File too large",
          description: "Please select an image smaller than 2MB.",
          variant: "destructive",
        });
        return;
      }
      
      setProfileImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setProfileImage(null);
    setImagePreview(null);
  };

  const handleSubmit = () => {
    if (!customerData.firstName || !customerData.lastName || !customerData.email) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields (first name, last name, and email).",
        variant: "destructive",
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerData.email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    const customerPayload = {
      partnerId: userData?.partnerId || "partner_192l9bh1xmduwueha",
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      email: customerData.email,
      phone: customerData.phone || null,
      company: customerData.company || null,
      category: customerData.category || null,
      profileImage: imagePreview || null // In a real app, you'd upload to Firebase Storage first
    };

    createCustomerMutation.mutate(customerPayload);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 modal-backdrop z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-rpp-grey-border">
          <div>
            <h2 className="text-xl font-semibold text-rpp-grey-dark">Create Customer</h2>
            <p className="text-sm text-rpp-grey-light mt-1">
              Add customer details, billing preferences, and team members.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-rpp-grey-light" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer Details Section */}
          <div className="border border-rpp-grey-border rounded-lg">
            <button
              onClick={() => toggleSection('customerDetails')}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <h3 className="text-lg font-medium text-rpp-grey-dark">Customer Details</h3>
              {expandedSections.customerDetails ? (
                <ChevronUp className="w-5 h-5 text-rpp-grey-light" />
              ) : (
                <ChevronDown className="w-5 h-5 text-rpp-grey-light" />
              )}
            </button>
            
            {expandedSections.customerDetails && (
              <div className="px-4 pb-4 space-y-4">
                {/* Customer Profile */}
                <div>
                  <h4 className="text-sm font-medium text-rpp-grey-dark mb-3">Customer Profile</h4>
                  <p className="text-sm text-rpp-grey-light mb-4">Upload a profile picture for this customer.</p>
                  
                  <div className="flex items-center space-x-4">
                    <div className="w-20 h-20 border-2 border-dashed border-rpp-grey-border rounded-lg flex items-center justify-center bg-rpp-grey-surface relative overflow-hidden">
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Upload className="w-6 h-6 text-rpp-grey-light" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => document.getElementById('profile-upload')?.click()}
                          className="border-rpp-grey-border"
                        >
                          Upload image
                        </Button>
                        {imagePreview && (
                          <Button
                            variant="ghost"
                            onClick={removeImage}
                            className="text-rpp-red-main hover:text-rpp-red-dark"
                          >
                            Remove image
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-rpp-grey-light mt-1">Max file size is 2MB</p>
                    </div>
                    <input
                      id="profile-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Name Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                      First name (required)
                    </label>
                    <Input
                      placeholder="First name"
                      value={customerData.firstName}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, firstName: e.target.value }))}
                      className="border-rpp-grey-border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                      Last name (required)
                    </label>
                    <Input
                      placeholder="Last name"
                      value={customerData.lastName}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, lastName: e.target.value }))}
                      className="border-rpp-grey-border"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                    Email (required)
                  </label>
                  <Input
                    type="email"
                    placeholder="Email"
                    value={customerData.email}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, email: e.target.value }))}
                    className="border-rpp-grey-border"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-rpp-grey-dark mb-2">Phone</label>
                  <div className="flex">
                    <Select defaultValue="+61">
                      <SelectTrigger className="w-24 border-rpp-grey-border rounded-r-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="+61">+61</SelectItem>
                        <SelectItem value="+1">+1</SelectItem>
                        <SelectItem value="+44">+44</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Area code and phone number"
                      value={customerData.phone}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                      className="flex-1 border-rpp-grey-border rounded-l-none border-l-0"
                    />
                  </div>
                </div>

                {/* Company */}
                <div>
                  <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                    Company / Organisation (optional)
                  </label>
                  <Input
                    placeholder="Company / Organisation"
                    value={customerData.company}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, company: e.target.value }))}
                    className="border-rpp-grey-border"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                    Category (optional)
                  </label>
                  <Select value={customerData.category} onValueChange={(value) => setCustomerData(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger className="border-rpp-grey-border">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="residential">Residential</SelectItem>
                      <SelectItem value="commercial">Commercial</SelectItem>
                      <SelectItem value="real_estate">Real Estate Agent</SelectItem>
                      <SelectItem value="property_manager">Property Manager</SelectItem>
                      <SelectItem value="architect">Architect</SelectItem>
                      <SelectItem value="interior_designer">Interior Designer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Billing Preferences Section */}
          <div className="border border-rpp-grey-border rounded-lg">
            <button
              onClick={() => toggleSection('billingPreferences')}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <h3 className="text-lg font-medium text-rpp-grey-dark">Billing Preferences</h3>
              {expandedSections.billingPreferences ? (
                <ChevronUp className="w-5 h-5 text-rpp-grey-light" />
              ) : (
                <ChevronDown className="w-5 h-5 text-rpp-grey-light" />
              )}
            </button>
            
            {expandedSections.billingPreferences && (
              <div className="px-4 pb-4">
                <p className="text-sm text-rpp-grey-light">Billing preferences will be available in a future update.</p>
              </div>
            )}
          </div>

          {/* Team Members Section */}
          <div className="border border-rpp-grey-border rounded-lg">
            <button
              onClick={() => toggleSection('teamMembers')}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <h3 className="text-lg font-medium text-rpp-grey-dark">Team Members (Optional)</h3>
              {expandedSections.teamMembers ? (
                <ChevronUp className="w-5 h-5 text-rpp-grey-light" />
              ) : (
                <ChevronDown className="w-5 h-5 text-rpp-grey-light" />
              )}
            </button>
            
            {expandedSections.teamMembers && (
              <div className="px-4 pb-4">
                <p className="text-sm text-rpp-grey-light">Team member management will be available in a future update.</p>
              </div>
            )}
          </div>

          {/* Customer Notes Section */}
          <div className="border border-rpp-grey-border rounded-lg">
            <button
              onClick={() => toggleSection('customerNotes')}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <h3 className="text-lg font-medium text-rpp-grey-dark">Customer Notes (Optional)</h3>
              {expandedSections.customerNotes ? (
                <ChevronUp className="w-5 h-5 text-rpp-grey-light" />
              ) : (
                <ChevronDown className="w-5 h-5 text-rpp-grey-light" />
              )}
            </button>
            
            {expandedSections.customerNotes && (
              <div className="px-4 pb-4">
                <Textarea
                  placeholder="Add any notes about this customer..."
                  value={customerData.notes}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, notes: e.target.value }))}
                  className="border-rpp-grey-border min-h-24"
                />
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-rpp-grey-border p-6">
          <div className="flex justify-end space-x-3">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="text-rpp-red-main border-rpp-red-main hover:bg-rpp-red-main hover:text-white"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createCustomerMutation.isPending}
              className="bg-rpp-grey-dark hover:bg-rpp-grey-medium text-white"
            >
              {createCustomerMutation.isPending ? "Creating..." : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}