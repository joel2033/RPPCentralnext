import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Camera, ChevronDown, ChevronUp } from "lucide-react";
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
    profileImage: ""
  });

  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [profileImage, setProfileImage] = useState<File | null>(null);

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
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Customer Created",
        description: "Customer has been created successfully.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create customer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 2MB.",
          variant: "destructive",
        });
        return;
      }
      setProfileImage(file);
    }
  };

  const removeImage = () => {
    setProfileImage(null);
  };

  const handleSubmit = () => {
    if (!customerData.firstName || !customerData.lastName || !customerData.email) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
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

    // Add partnerId to customer data for multi-tenancy
    const customerPayload = {
      ...customerData,
      partnerId: userData?.partnerId || "partner_192l9bh1xmduwueha", // Fallback for testing
      // Only include non-empty values
      phone: customerData.phone || undefined,
      company: customerData.company || undefined,
      category: customerData.category || undefined,
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

        {/* Modal Body */}
        <div className="p-6">
          {/* Customer Details Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-rpp-grey-dark">Customer Details</h3>
              <ChevronUp className="w-5 h-5 text-rpp-grey-light" />
            </div>

            {/* Customer Profile */}
            <div className="mb-6">
              <h4 className="font-medium text-rpp-grey-dark mb-2">Customer Profile</h4>
              <p className="text-sm text-rpp-grey-light mb-4">Upload a profile picture for this customer.</p>

              <div className="flex items-center space-x-4 mb-4">
                <div className="w-20 h-20 bg-rpp-grey-surface border-2 border-dashed border-rpp-grey-border rounded-lg flex items-center justify-center overflow-hidden">
                  {profileImage ? (
                    <img 
                      src={URL.createObjectURL(profileImage)} 
                      alt="Profile preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Camera className="w-6 h-6 text-rpp-grey-light" />
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="profile-upload"
                  />
                  <label htmlFor="profile-upload">
                    <Button variant="outline" className="border-rpp-grey-border" asChild>
                      <span className="cursor-pointer">Upload image</span>
                    </Button>
                  </label>
                  <p className="text-xs text-rpp-grey-light mt-1">Max file size is 2MB</p>
                </div>
              </div>
              {profileImage && (
                <button 
                  onClick={removeImage}
                  className="text-sm text-rpp-red-main hover:text-rpp-red-dark"
                >
                  Remove image
                </button>
              )}
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                  First name (required)
                </label>
                <Input
                  type="text"
                  placeholder="First name"
                  value={customerData.firstName}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, firstName: e.target.value }))}
                  className="border-rpp-grey-border focus:ring-rpp-red-main"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                  Last name (required)
                </label>
                <Input
                  type="text"
                  placeholder="Last name"
                  value={customerData.lastName}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, lastName: e.target.value }))}
                  className="border-rpp-grey-border focus:ring-rpp-red-main"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                Email (required)
              </label>
              <Input
                type="email"
                placeholder="Email"
                value={customerData.email}
                onChange={(e) => setCustomerData(prev => ({ ...prev, email: e.target.value }))}
                className="border-rpp-grey-border focus:ring-rpp-red-main"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                Phone
              </label>
              <div className="flex">
                <select className="px-3 py-2 border border-rpp-grey-border border-r-0 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-rpp-red-main bg-white">
                  <option>+61</option>
                  <option>+1</option>
                  <option>+44</option>
                </select>
                <Input
                  type="tel"
                  placeholder="Area code and phone number"
                  value={customerData.phone}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                  className="flex-1 border-rpp-grey-border rounded-l-none focus:ring-rpp-red-main"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                Company / Organisation (optional)
              </label>
              <Input
                type="text"
                placeholder="Company / Organisation"
                value={customerData.company}
                onChange={(e) => setCustomerData(prev => ({ ...prev, company: e.target.value }))}
                className="border-rpp-grey-border focus:ring-rpp-red-main"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                Category (optional)
              </label>
              <Select value={customerData.category} onValueChange={(value) => setCustomerData(prev => ({ ...prev, category: value }))}>
                <SelectTrigger className="border-rpp-grey-border">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="real_estate_agent">Real Estate Agent</SelectItem>
                  <SelectItem value="property_manager">Property Manager</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="photographer">Photographer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Collapsible Sections */}
          <div className="space-y-4">
            {/* Billing Preferences */}
            <div className="border border-rpp-grey-border rounded-lg">
              <button 
                onClick={() => toggleSection('billing')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-rpp-grey-surface transition-colors"
              >
                <span className="font-medium text-rpp-grey-dark">Billing Preferences</span>
                <ChevronDown className={`w-4 h-4 text-rpp-grey-light transition-transform ${
                  expandedSections.includes('billing') ? 'rotate-180' : ''
                }`} />
              </button>
              {expandedSections.includes('billing') && (
                <div className="p-4 border-t border-rpp-grey-border">
                  <p className="text-sm text-rpp-grey-light">Billing preferences settings would go here.</p>
                </div>
              )}
            </div>

            {/* Team Members */}
            <div className="border border-rpp-grey-border rounded-lg">
              <button 
                onClick={() => toggleSection('team')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-rpp-grey-surface transition-colors"
              >
                <span className="font-medium text-rpp-grey-dark">Team Members (Optional)</span>
                <ChevronDown className={`w-4 h-4 text-rpp-grey-light transition-transform ${
                  expandedSections.includes('team') ? 'rotate-180' : ''
                }`} />
              </button>
              {expandedSections.includes('team') && (
                <div className="p-4 border-t border-rpp-grey-border">
                  <p className="text-sm text-rpp-grey-light">Team member management settings would go here.</p>
                </div>
              )}
            </div>

            {/* Customer Notes */}
            <div className="border border-rpp-grey-border rounded-lg">
              <button 
                onClick={() => toggleSection('notes')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-rpp-grey-surface transition-colors"
              >
                <span className="font-medium text-rpp-grey-dark">Customer Notes (Optional)</span>
                <ChevronDown className={`w-4 h-4 text-rpp-grey-light transition-transform ${
                  expandedSections.includes('notes') ? 'rotate-180' : ''
                }`} />
              </button>
              {expandedSections.includes('notes') && (
                <div className="p-4 border-t border-rpp-grey-border">
                  <Textarea
                    placeholder="Add any additional notes about this customer..."
                    className="border-rpp-grey-border focus:ring-rpp-red-main"
                    rows={3}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-rpp-grey-border">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="text-rpp-red-main hover:text-rpp-red-dark"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={createCustomerMutation.isPending}
            className="bg-rpp-red-main hover:bg-rpp-red-dark text-white"
          >
            {createCustomerMutation.isPending ? "Creating..." : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
