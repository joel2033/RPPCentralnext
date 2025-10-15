import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Upload, Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

interface CreateOrderModalProps {
  onClose: () => void;
}

export default function CreateOrderModal({ onClose }: CreateOrderModalProps) {
  const [orderData, setOrderData] = useState({
    orderNumber: `ORDER-${Date.now()}`,
    jobId: "",
    customerId: "",
    assignedTo: "",
    estimatedTotal: "",
    notes: "",
    specifications: [],
    files: []
  });

  const [newSpecification, setNewSpecification] = useState("");
  const [sendConfirmationEmail, setSendConfirmationEmail] = useState(true);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { userData } = useAuth();

  // Get jobs and customers for dropdowns
  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["/api/customers"],
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/orders", "POST", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Order Created",
        description: "Order has been created successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create order. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addSpecification = () => {
    if (newSpecification.trim()) {
      setOrderData(prev => ({
        ...prev,
        specifications: [...prev.specifications, newSpecification.trim()]
      }));
      setNewSpecification("");
    }
  };

  const removeSpecification = (index: number) => {
    setOrderData(prev => ({
      ...prev,
      specifications: prev.specifications.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = () => {
    if (!userData?.partnerId) {
      toast({
        title: "Authentication Error",
        description: "User partner ID not found. Please log in again.",
        variant: "destructive",
      });
      return;
    }

    const orderPayload = {
      partnerId: userData.partnerId,
      jobId: orderData.jobId || null,
      customerId: orderData.customerId || null,
      assignedTo: orderData.assignedTo || null,
      createdBy: userData?.email || "admin",
      estimatedTotal: orderData.estimatedTotal || "0.00",
      status: "pending"
    };

    createOrderMutation.mutate(orderPayload);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 modal-backdrop z-50 flex items-center justify-center px-1">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-rpp-grey-border">
          <div>
            <h2 className="text-xl font-semibold text-rpp-grey-dark">New Order Information</h2>
            <p className="text-sm text-rpp-grey-light mt-1">
              All work (to your Freelancer and Suppliers)
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-rpp-grey-light" />
          </button>
        </div>

        <div className="flex">
          {/* Main Content */}
          <div className="flex-1 p-6">
            {/* Order Information */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-rpp-grey-dark mb-4">Order Information</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                    Order Number
                  </label>
                  <Input
                    value={orderData.orderNumber}
                    onChange={(e) => setOrderData(prev => ({ ...prev, orderNumber: e.target.value }))}
                    className="border-rpp-grey-border"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                    Assign to Job (Optional)
                  </label>
                  <Select value={orderData.jobId} onValueChange={(value) => setOrderData(prev => ({ ...prev, jobId: value }))}>
                    <SelectTrigger className="border-rpp-grey-border">
                      <SelectValue placeholder="Select a job" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No job assignment</SelectItem>
                      {jobs.map((job: any) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                    Customer (Optional)
                  </label>
                  <Select value={orderData.customerId} onValueChange={(value) => setOrderData(prev => ({ ...prev, customerId: value }))}>
                    <SelectTrigger className="border-rpp-grey-border">
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No customer</SelectItem>
                      {customers.map((customer: any) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.firstName} {customer.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                    Estimated Total
                  </label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 py-2 border border-r-0 border-rpp-grey-border bg-rpp-grey-surface rounded-l-lg text-sm text-rpp-grey-dark">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={orderData.estimatedTotal}
                      onChange={(e) => setOrderData(prev => ({ ...prev, estimatedTotal: e.target.value }))}
                      className="flex-1 border-rpp-grey-border rounded-l-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Supplier Assignment */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-rpp-grey-dark mb-4">Supplier</h3>
              <p className="text-sm text-rpp-grey-light mb-4">
                Choose your freelancer who will complete the edit. Learn more about creating suppliers here.
              </p>
              
              <Select value={orderData.assignedTo} onValueChange={(value) => setOrderData(prev => ({ ...prev, assignedTo: value }))}>
                <SelectTrigger className="border-rpp-grey-border">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="photographer1">Photographer Team</SelectItem>
                  <SelectItem value="editor1">Editing Team</SelectItem>
                  <SelectItem value="external">External Editor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Services */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-rpp-grey-dark mb-4">Services</h3>
              <p className="text-sm text-rpp-grey-light mb-4">
                Choose the service which applies to this order.
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-rpp-grey-border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600 text-sm">📷</span>
                    </div>
                    <div>
                      <h4 className="font-medium">Image Enhancement - Real</h4>
                      <p className="text-xs text-rpp-grey-light">$35.00</p>
                    </div>
                  </div>
                </div>
                
                <div className="border border-rpp-grey-border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <span className="text-green-600 text-sm">🏠</span>
                    </div>
                    <div>
                      <h4 className="font-medium">Quantity X</h4>
                      <p className="text-xs text-rpp-grey-light">24</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-rpp-grey-dark mb-4">Instructions</h3>
              <p className="text-sm text-rpp-grey-light mb-4">
                Any special requests or notes for the supplier should be captured here for this order.
              </p>
              
              <Textarea
                placeholder="Add notes here..."
                value={orderData.notes}
                onChange={(e) => setOrderData(prev => ({ ...prev, notes: e.target.value }))}
                className="border-rpp-grey-border min-h-24"
              />
            </div>

            {/* Expert Notes */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-rpp-grey-dark mb-4">Expert Notes</h3>
              <p className="text-sm text-rpp-grey-light mb-4">
                Specify requirements or preferences about the supplier experience and competency.
              </p>
              
              <div className="space-y-2 mb-4">
                {orderData.specifications.map((spec, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span className="text-sm">{spec}</span>
                    <button
                      onClick={() => removeSpecification(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="flex space-x-2">
                <Input
                  placeholder="Add specification..."
                  value={newSpecification}
                  onChange={(e) => setNewSpecification(e.target.value)}
                  className="flex-1 border-rpp-grey-border"
                  onKeyPress={(e) => e.key === 'Enter' && addSpecification()}
                />
                <Button
                  onClick={addSpecification}
                  variant="outline"
                  className="border-rpp-grey-border"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-80 bg-rpp-grey-surface p-6 border-l border-rpp-grey-border">
            <h3 className="text-lg font-medium text-rpp-grey-dark mb-4">Supplier</h3>
            
            <div className="mb-6">
              <div className="border border-rpp-grey-border bg-white rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm">📷</span>
                  </div>
                  <div>
                    <h4 className="font-medium">PPT Studio</h4>
                    <p className="text-xs text-rpp-grey-light">Live Support • 5AM - 9PM</p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-rpp-grey-light">Avg Delivery</span>
                    <span>6h 25m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-rpp-grey-light">On-time Delivery</span>
                    <span>98.4%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-rpp-grey-light">Satisfaction</span>
                    <span>95.8%</span>
                  </div>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-medium text-rpp-grey-dark mb-4">Order Summary</h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span>Service</span>
                <span>Est. cost</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Image Enhancement - Real</span>
                <span>$35.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Quantity X</span>
                <span>24</span>
              </div>
              <div className="border-t border-rpp-grey-border pt-2">
                <div className="flex justify-between font-medium">
                  <span>Estimated total</span>
                  <span>${orderData.estimatedTotal || "0.00"}</span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-xs text-rpp-grey-light mb-2">
                Your estimated total will be used for cost tracking and reporting.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-rpp-grey-border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="send-confirmation"
                checked={sendConfirmationEmail}
                onCheckedChange={(checked) => setSendConfirmationEmail(!!checked)}
              />
              <label htmlFor="send-confirmation" className="text-sm text-rpp-grey-dark">
                Send customer confirmation email
              </label>
            </div>
            
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                onClick={onClose}
                className="text-rpp-red-main border-rpp-red-main hover:bg-rpp-red-main hover:text-white"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={createOrderMutation.isPending}
                className="bg-rpp-grey-dark hover:bg-rpp-grey-medium text-white"
              >
                {createOrderMutation.isPending ? "Creating..." : "Continue"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}