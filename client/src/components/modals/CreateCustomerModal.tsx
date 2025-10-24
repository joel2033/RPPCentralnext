import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Upload, ChevronDown, ChevronUp, User, Receipt, Users, FileText, Trash2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface CreateCustomerModalProps {
  onClose: () => void;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function CreateCustomerModal({ onClose }: CreateCustomerModalProps) {
  const [customerData, setCustomerData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    phoneCountryCode: "+61",
    company: "",
    category: "",
    notes: "",
    // Billing preferences
    billingEmail: "",
    billingAddress: "",
    city: "",
    state: "",
    postcode: "",
    paymentTerms: "",
    taxId: "",
    // Accounting integration
    accountingIntegration: "",
    accountingContactId: "",
  });

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
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
      if (file.size > 2 * 1024 * 1024) {
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

  const addTeamMember = () => {
    setTeamMembers([...teamMembers, { id: Date.now().toString(), name: "", email: "", role: "" }]);
  };

  const removeTeamMember = (id: string) => {
    setTeamMembers(teamMembers.filter(member => member.id !== id));
  };

  const updateTeamMember = (id: string, field: keyof TeamMember, value: string) => {
    setTeamMembers(teamMembers.map(member => 
      member.id === id ? { ...member, [field]: value } : member
    ));
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerData.email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    const phoneValue = customerData.phone ? `${customerData.phoneCountryCode} ${customerData.phone}` : null;
    
    // Remove UI-only 'id' field from team members before saving
    const cleanedTeamMembers = teamMembers.map(({ id, ...member }) => member);
    
    const customerPayload = {
      partnerId: userData?.partnerId || "partner_192l9bh1xmduwueha",
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      email: customerData.email,
      phone: phoneValue,
      company: customerData.company || null,
      category: customerData.category || null,
      notes: customerData.notes || null,
      profileImage: imagePreview || null,
      // Billing preferences
      billingEmail: customerData.billingEmail || null,
      billingAddress: customerData.billingAddress || null,
      city: customerData.city || null,
      state: customerData.state || null,
      postcode: customerData.postcode || null,
      paymentTerms: customerData.paymentTerms || null,
      taxId: customerData.taxId || null,
      // Accounting integration
      accountingIntegration: customerData.accountingIntegration || null,
      accountingContactId: customerData.accountingContactId || null,
      // Team members as JSON string (without UI-only id field)
      teamMembers: cleanedTeamMembers.length > 0 ? JSON.stringify(cleanedTeamMembers) : null,
    };

    createCustomerMutation.mutate(customerPayload);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 modal-backdrop z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900" data-testid="text-modal-title">Create Customer</h2>
            <p className="text-sm text-gray-500 mt-1">
              Add customer details, billing preferences, and team members.
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            data-testid="button-close-modal"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Customer Details Section */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection('customerDetails')}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
              data-testid="button-toggle-customer-details"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-orange-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">Customer Details</h3>
              </div>
              {expandedSections.customerDetails ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {expandedSections.customerDetails && (
              <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
                {/* Profile Upload */}
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Customer Profile</h4>
                  <p className="text-sm text-gray-500 mb-3">Upload a profile picture for this customer.</p>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 relative overflow-hidden">
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-10 h-10 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('profile-upload')?.click()}
                        className="border-gray-300"
                        data-testid="button-upload-image"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload image
                      </Button>
                      <p className="text-xs text-gray-500 mt-1">Max file size is 2MB. Recommended size: 400x400px</p>
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
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      First name *
                    </label>
                    <Input
                      placeholder="John"
                      value={customerData.firstName}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, firstName: e.target.value }))}
                      className="border-gray-300"
                      data-testid="input-first-name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Last name *
                    </label>
                    <Input
                      placeholder="Smith"
                      value={customerData.lastName}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, lastName: e.target.value }))}
                      className="border-gray-300"
                      data-testid="input-last-name"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Email *
                  </label>
                  <Input
                    type="email"
                    placeholder="john.smith@example.com"
                    value={customerData.email}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, email: e.target.value }))}
                    className="border-gray-300"
                    data-testid="input-email"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Phone</label>
                  <div className="flex gap-2">
                    <Select 
                      value={customerData.phoneCountryCode} 
                      onValueChange={(value) => setCustomerData(prev => ({ ...prev, phoneCountryCode: value }))}
                    >
                      <SelectTrigger className="w-24 border-gray-300" data-testid="select-country-code">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="+61">+61</SelectItem>
                        <SelectItem value="+1">+1</SelectItem>
                        <SelectItem value="+44">+44</SelectItem>
                        <SelectItem value="+64">+64</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="412 345 678"
                      value={customerData.phone}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                      className="flex-1 border-gray-300"
                      data-testid="input-phone"
                    />
                  </div>
                </div>

                {/* Company */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Company / Organisation
                  </label>
                  <Input
                    placeholder="ABC Realty"
                    value={customerData.company}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, company: e.target.value }))}
                    className="border-gray-300"
                    data-testid="input-company"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Category
                  </label>
                  <Select 
                    value={customerData.category} 
                    onValueChange={(value) => setCustomerData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger className="border-gray-300" data-testid="select-category">
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
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection('billingPreferences')}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
              data-testid="button-toggle-billing"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">Billing Preferences</h3>
              </div>
              {expandedSections.billingPreferences ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {expandedSections.billingPreferences && (
              <div className="px-4 pb-4 space-y-4 border-t border-gray-100 mt-0 pt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Billing Email</label>
                  <Input
                    type="email"
                    placeholder="billing@company.com"
                    value={customerData.billingEmail}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, billingEmail: e.target.value }))}
                    className="border-gray-300"
                    data-testid="input-billing-email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Billing Address</label>
                  <Input
                    placeholder="123 Main Street"
                    value={customerData.billingAddress}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, billingAddress: e.target.value }))}
                    className="border-gray-300"
                    data-testid="input-billing-address"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">City</label>
                    <Input
                      placeholder="Sydney"
                      value={customerData.city}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, city: e.target.value }))}
                      className="border-gray-300"
                      data-testid="input-city"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">State</label>
                    <Select 
                      value={customerData.state} 
                      onValueChange={(value) => setCustomerData(prev => ({ ...prev, state: value }))}
                    >
                      <SelectTrigger className="border-gray-300" data-testid="select-state">
                        <SelectValue placeholder="State" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NSW">NSW</SelectItem>
                        <SelectItem value="VIC">VIC</SelectItem>
                        <SelectItem value="QLD">QLD</SelectItem>
                        <SelectItem value="WA">WA</SelectItem>
                        <SelectItem value="SA">SA</SelectItem>
                        <SelectItem value="TAS">TAS</SelectItem>
                        <SelectItem value="ACT">ACT</SelectItem>
                        <SelectItem value="NT">NT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Postcode</label>
                    <Input
                      placeholder="2000"
                      value={customerData.postcode}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, postcode: e.target.value }))}
                      className="border-gray-300"
                      data-testid="input-postcode"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Payment Terms</label>
                  <Select 
                    value={customerData.paymentTerms} 
                    onValueChange={(value) => setCustomerData(prev => ({ ...prev, paymentTerms: value }))}
                  >
                    <SelectTrigger className="border-gray-300" data-testid="select-payment-terms">
                      <SelectValue placeholder="Select payment terms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="net_7">Net 7</SelectItem>
                      <SelectItem value="net_14">Net 14</SelectItem>
                      <SelectItem value="net_30">Net 30</SelectItem>
                      <SelectItem value="net_60">Net 60</SelectItem>
                      <SelectItem value="due_on_receipt">Due on Receipt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Tax ID / ABN</label>
                  <Input
                    placeholder="12 345 678 901"
                    value={customerData.taxId}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, taxId: e.target.value }))}
                    className="border-gray-300"
                    data-testid="input-tax-id"
                  />
                </div>

                {/* Accounting Integration */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Accounting Integration</label>
                  <Select 
                    value={customerData.accountingIntegration} 
                    onValueChange={(value) => setCustomerData(prev => ({ ...prev, accountingIntegration: value }))}
                  >
                    <SelectTrigger className="border-gray-300" data-testid="select-accounting-integration">
                      <div className="flex items-center justify-between w-full">
                        <SelectValue placeholder="Select accounting integration" />
                        {customerData.accountingIntegration && (
                          <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                            Connected
                          </Badge>
                        )}
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xero">Xero</SelectItem>
                      <SelectItem value="quickbooks">QuickBooks</SelectItem>
                      <SelectItem value="myob">MYOB</SelectItem>
                      <SelectItem value="freshbooks">FreshBooks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Match or Create Billing Contact */}
                {customerData.accountingIntegration && (
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Match or Create Billing Contact</label>
                    <Select 
                      value={customerData.accountingContactId} 
                      onValueChange={(value) => setCustomerData(prev => ({ ...prev, accountingContactId: value }))}
                    >
                      <SelectTrigger className="border-gray-300" data-testid="select-accounting-contact">
                        <SelectValue placeholder="Select an existing contact or create a new one" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-blue-600 font-medium cursor-pointer hover:bg-gray-100">
                          <Plus className="w-4 h-4" />
                          Create
                        </div>
                        <div className="border-t my-1"></div>
                        {/* Placeholder contacts - will be populated from API later */}
                        <SelectItem value="contact_1">One Agency Coast And Country</SelectItem>
                        <SelectItem value="contact_2">Danny Le</SelectItem>
                        <SelectItem value="contact_3">Jenny Keane</SelectItem>
                        <SelectItem value="contact_4">Paul Kemp</SelectItem>
                        <SelectItem value="contact_5">XTO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Team Members Section */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection('teamMembers')}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
              data-testid="button-toggle-team-members"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">Team Members</h3>
              </div>
              {expandedSections.teamMembers ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {expandedSections.teamMembers && (
              <div className="px-4 pb-4 space-y-4 border-t border-gray-100 mt-0 pt-4">
                {teamMembers.map((member, index) => (
                  <div key={member.id} className="space-y-3 p-4 bg-gray-50 rounded-lg relative">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700">Team Member {index + 1}</h4>
                      <button
                        onClick={() => removeTeamMember(member.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        data-testid={`button-remove-team-member-${index}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <Input
                      placeholder="Full name"
                      value={member.name}
                      onChange={(e) => updateTeamMember(member.id, 'name', e.target.value)}
                      className="border-gray-300 bg-white"
                      data-testid={`input-team-member-name-${index}`}
                    />
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={member.email}
                      onChange={(e) => updateTeamMember(member.id, 'email', e.target.value)}
                      className="border-gray-300 bg-white"
                      data-testid={`input-team-member-email-${index}`}
                    />
                    <Input
                      placeholder="Role (e.g., Marketing Manager)"
                      value={member.role}
                      onChange={(e) => updateTeamMember(member.id, 'role', e.target.value)}
                      className="border-gray-300 bg-white"
                      data-testid={`input-team-member-role-${index}`}
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={addTeamMember}
                  className="w-full border-gray-300 border-dashed"
                  data-testid="button-add-team-member"
                >
                  + Add Team Member
                </Button>
              </div>
            )}
          </div>

          {/* Customer Notes Section */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection('customerNotes')}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
              data-testid="button-toggle-notes"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">Customer Notes</h3>
              </div>
              {expandedSections.customerNotes ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {expandedSections.customerNotes && (
              <div className="px-4 pb-4 border-t border-gray-100 mt-0 pt-4">
                <Textarea
                  placeholder="Add any notes about this customer, special requirements, preferences, or important information..."
                  value={customerData.notes}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, notes: e.target.value }))}
                  className="border-gray-300 min-h-24"
                  data-testid="textarea-notes"
                />
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">* Required fields</p>
            <div className="flex gap-3">
              <Button 
                type="button"
                variant="outline" 
                onClick={onClose}
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={createCustomerMutation.isPending}
                className="hover:bg-rpp-red-dark text-white bg-[#ea580b]"
                data-testid="button-create-customer"
              >
                {createCustomerMutation.isPending ? "Creating..." : "Create Customer"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
