import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { X, CloudUpload, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface CreateProductModalProps {
  onClose: () => void;
}

interface ProductVariation {
  name: string;
  price: string;
  appointmentDuration: string;
  noCharge: boolean;
}

export default function CreateProductModal({ onClose }: CreateProductModalProps) {
  const { userData } = useAuth();
  
  const [productData, setProductData] = useState({
    title: "",
    description: "",
    type: "",
    category: "",
    price: "",
    taxRate: "10",
    hasVariations: false,
    productType: "onsite",
    requiresAppointment: true,
    appointmentDuration: "60",
    exclusivityType: "none",
    isActive: true,
    isLive: true
  });

  const [variations, setVariations] = useState<ProductVariation[]>([
    { name: "", price: "", appointmentDuration: "60", noCharge: false }
  ]);
  
  const [productImage, setProductImage] = useState<File | null>(null);
  const [noCharge, setNoCharge] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch customers for exclusivity
  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["/api/customers"],
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Creating product with data:", data);
      return apiRequest("/api/products", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Product Created",
        description: "Product has been created successfully.",
      });
      onClose();
    },
    onError: (error: any) => {
      console.error("Product creation error:", error);
      const errorMessage = error?.message || error?.toString() || "Unknown error occurred";
      toast({
        title: "Error Creating Product",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

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
      
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please select a JPG or PNG image.",
          variant: "destructive",
        });
        return;
      }
      
      setProductImage(file);
    }
  };

  const addVariation = () => {
    setVariations([...variations, { name: "", price: "", appointmentDuration: "60", noCharge: false }]);
  };

  const removeVariation = (index: number) => {
    if (variations.length > 1) {
      setVariations(variations.filter((_, i) => i !== index));
    }
  };

  const updateVariation = (index: number, field: keyof ProductVariation, value: any) => {
    const newVariations = [...variations];
    newVariations[index] = { ...newVariations[index], [field]: value };
    setVariations(newVariations);
  };

  const handleSubmit = () => {
    if (!productData.title || !productData.type) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Validate variations if enabled
    if (productData.hasVariations) {
      const invalidVariation = variations.find(v => !v.name || (!v.noCharge && !v.price));
      if (invalidVariation) {
        toast({
          title: "Invalid Variation",
          description: "Please fill in all variation details.",
          variant: "destructive",
        });
        return;
      }
    }

    if (!noCharge && !productData.price && !productData.hasVariations) {
      toast({
        title: "Missing Price",
        description: "Please enter a price or mark as no charge.",
        variant: "destructive",
      });
      return;
    }

    // Prepare variations data
    const variationsData = productData.hasVariations ? variations.map(v => ({
      name: v.name,
      price: v.noCharge ? "0.00" : v.price,
      appointmentDuration: parseInt(v.appointmentDuration) || 60,
      noCharge: v.noCharge
    })) : null;

    // Validate partnerId exists
    if (!userData?.partnerId) {
      toast({
        title: "Authentication Error",
        description: "Unable to determine your partner ID. Please try logging out and back in.",
        variant: "destructive",
      });
      return;
    }

    // Add partnerId to product data for multi-tenancy
    const finalData = {
      partnerId: userData.partnerId,
      title: productData.title,
      type: productData.type,
      description: productData.description || null,
      price: noCharge ? "0.00" : (productData.hasVariations ? "0.00" : productData.price),
      category: productData.category || null,
      taxRate: productData.taxRate || "10",
      hasVariations: productData.hasVariations,
      variants: productData.hasVariations ? variations.length : 0,
      variations: variationsData ? JSON.stringify(variationsData) : null,
      productType: productData.productType || "onsite",
      requiresAppointment: productData.requiresAppointment,
      appointmentDuration: parseInt(productData.appointmentDuration) || 60,
      exclusivityType: productData.exclusivityType || "none",
      exclusiveCustomerIds: productData.exclusivityType === "exclusive" && selectedCustomers.length > 0 ? JSON.stringify(selectedCustomers) : null,
      isActive: productData.isActive,
      isLive: productData.isLive,
      image: null // Handle image upload later
    };

    createProductMutation.mutate(finalData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 modal-backdrop z-[100] flex items-center justify-center px-1 overflow-y-auto py-8">
      <div className="bg-white rounded-2xl w-full max-w-2xl my-auto relative z-[101] flex flex-col" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-rpp-grey-border">
          <div>
            <h2 className="text-xl font-semibold text-rpp-grey-dark">Create New Product</h2>
            <p className="text-sm text-rpp-grey-light mt-1">
              Create your new product, package or add-on by providing the necessary details below. 
              Once saved, you'll be able to seamlessly manage all advanced settings in one place.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" data-testid="button-close-modal">
            <X className="w-5 h-5 text-rpp-grey-light" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Product Type */}
          <div>
            <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
              Product Type
            </label>
            <Select 
              value={productData.type} 
              onValueChange={(value) => setProductData(prev => ({ ...prev, type: value }))}
            >
              <SelectTrigger className="border-rpp-grey-border" data-testid="select-product-type">
                <SelectValue placeholder="Select A Product Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="package">Package</SelectItem>
                <SelectItem value="addon">Add-on</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Product Title */}
          <div>
            <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
              Product Title
            </label>
            <Input
              type="text"
              placeholder="What is the name of your product or service?"
              value={productData.title}
              onChange={(e) => setProductData(prev => ({ ...prev, title: e.target.value }))}
              className="border-rpp-grey-border focus:ring-rpp-red-main"
              data-testid="input-product-title"
            />
          </div>

          {/* Product Description */}
          <div>
            <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
              Product Description (optional)
            </label>
            <Textarea
              rows={4}
              placeholder="Compose an engaging description that portrays the unique features, benefits and/or inclusions of your offering"
              value={productData.description}
              onChange={(e) => setProductData(prev => ({ ...prev, description: e.target.value }))}
              className="border-rpp-grey-border focus:ring-rpp-red-main resize-none"
              data-testid="textarea-product-description"
            />
            <div className="flex justify-end mt-1">
              <span className="text-xs text-rpp-grey-light">
                {productData.description.length}/400
              </span>
            </div>
          </div>

          {/* Product Picture */}
          <div>
            <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
              Product Picture (Optional)
            </label>
            <p className="text-sm text-rpp-grey-light mb-4">
              Capture attention and showcase your product effectively by uploading an eye-catching image.
            </p>
            
            <div className="border-2 border-dashed border-rpp-grey-border rounded-lg p-8 text-center hover:border-rpp-red-main transition-colors">
              {productImage ? (
                <div className="space-y-4">
                  <img 
                    src={URL.createObjectURL(productImage)} 
                    alt="Product preview" 
                    className="max-h-32 mx-auto rounded"
                  />
                  <p className="text-sm text-rpp-grey-dark">{productImage.name}</p>
                  <Button 
                    variant="outline" 
                    onClick={() => setProductImage(null)}
                    className="border-rpp-grey-border"
                    data-testid="button-remove-image"
                  >
                    Remove Image
                  </Button>
                </div>
              ) : (
                <>
                  <CloudUpload className="w-12 h-12 text-rpp-grey-light mx-auto mb-4" />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/jpg"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="product-image-upload"
                    data-testid="input-product-image"
                  />
                  <label htmlFor="product-image-upload">
                    <Button variant="outline" className="border-rpp-grey-border" asChild>
                      <span className="cursor-pointer">Upload image</span>
                    </Button>
                  </label>
                  <p className="text-xs text-rpp-grey-light mt-2">
                    Max file size: 2MB. Accepted: jpg, png
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Product Category */}
          <div>
            <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
              Product Category(s) (optional)
            </label>
            <Select 
              value={productData.category} 
              onValueChange={(value) => setProductData(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger className="border-rpp-grey-border" data-testid="select-product-category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="photography">Photography</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="floor_plans">Floor Plans</SelectItem>
                <SelectItem value="virtual_tours">Virtual Tours</SelectItem>
                <SelectItem value="drone">Drone Photography</SelectItem>
                <SelectItem value="editing">Photo Editing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Onsite or Digital Product */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-rpp-grey-dark mb-2">
              Onsite or Digital Product
            </h3>
            <p className="text-sm text-rpp-grey-light mb-4">
              Does this product require physical attendance by you, or can it be offered as a digital product only?
            </p>
            <RadioGroup 
              value={productData.productType} 
              onValueChange={(value) => setProductData(prev => ({ 
                ...prev, 
                productType: value,
                requiresAppointment: value === "onsite"
              }))}
            >
              <div className="flex items-center space-x-2 mb-3">
                <RadioGroupItem value="digital" id="digital" data-testid="radio-digital-product" />
                <Label htmlFor="digital" className="text-sm font-normal cursor-pointer">
                  Digital product only
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="onsite" id="onsite" data-testid="radio-onsite-product" />
                <Label htmlFor="onsite" className="text-sm font-normal cursor-pointer">
                  Requires onsite attendance
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Product Exclusivity */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-rpp-grey-dark mb-2">
              Product Exclusivity
            </h3>
            <p className="text-sm text-rpp-grey-light mb-4">
              Make this product exclusive to one or more customers, or make it available to all.
            </p>
            <RadioGroup 
              value={productData.exclusivityType} 
              onValueChange={(value) => setProductData(prev => ({ ...prev, exclusivityType: value }))}
            >
              <div className="flex items-center space-x-2 mb-3">
                <RadioGroupItem value="none" id="no-exclusivity" data-testid="radio-no-exclusivity" />
                <Label htmlFor="no-exclusivity" className="text-sm font-normal cursor-pointer">
                  No exclusivity
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="exclusive" id="set-exclusivity" data-testid="radio-set-exclusivity" />
                <Label htmlFor="set-exclusivity" className="text-sm font-normal cursor-pointer">
                  Set exclusivity
                </Label>
              </div>
            </RadioGroup>

            {productData.exclusivityType === "exclusive" && (
              <div className="mt-4">
                <Label className="text-sm font-medium text-rpp-grey-dark mb-2">
                  Select Exclusive Customers
                </Label>
                <Select 
                  onValueChange={(value) => {
                    if (!selectedCustomers.includes(value)) {
                      setSelectedCustomers([...selectedCustomers, value]);
                    }
                  }}
                >
                  <SelectTrigger className="border-rpp-grey-border mt-2" data-testid="select-exclusive-customers">
                    <SelectValue placeholder="Select customers..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer: any) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.firstName} {customer.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {selectedCustomers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedCustomers.map((customerId) => {
                      const customer = customers.find((c: any) => c.id === customerId);
                      return (
                        <div 
                          key={customerId} 
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                        >
                          <span>{customer?.firstName} {customer?.lastName}</span>
                          <button
                            onClick={() => setSelectedCustomers(selectedCustomers.filter(id => id !== customerId))}
                            className="hover:text-blue-900"
                            data-testid={`button-remove-customer-${customerId}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Variations */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-rpp-grey-dark mb-2">
              Variations
            </h3>
            <p className="text-sm text-rpp-grey-light mb-3">
              Does this product have variations?
            </p>
            <div className="flex items-center space-x-2 mb-4">
              <Checkbox
                id="has-variations"
                checked={productData.hasVariations}
                onCheckedChange={(checked) => setProductData(prev => ({ ...prev, hasVariations: !!checked }))}
                data-testid="checkbox-has-variations"
              />
              <label htmlFor="has-variations" className="text-sm text-rpp-grey-dark cursor-pointer">
                Yes
              </label>
            </div>
            
            {productData.hasVariations && (
              <div className="space-y-4 mt-4">
                {variations.map((variation, index) => (
                  <div key={index} className="border border-rpp-grey-border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-rpp-grey-dark">Option {index + 1}</h4>
                      {variations.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeVariation(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                          data-testid={`button-remove-variation-${index}`}
                        >
                          Remove
                        </Button>
                      )}
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-rpp-grey-dark">
                        Option Name
                      </Label>
                      <Input
                        type="text"
                        placeholder="Option name"
                        value={variation.name}
                        onChange={(e) => updateVariation(index, 'name', e.target.value)}
                        className="border-rpp-grey-border mt-1"
                        data-testid={`input-variation-name-${index}`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm font-medium text-rpp-grey-dark">
                          Price (before tax)
                        </Label>
                        <div className="flex mt-1">
                          <span className="inline-flex items-center px-3 py-2 border border-r-0 border-rpp-grey-border bg-rpp-grey-surface rounded-l-lg text-sm text-rpp-grey-dark">
                            AUD $
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={variation.price}
                            onChange={(e) => updateVariation(index, 'price', e.target.value)}
                            disabled={variation.noCharge}
                            className="flex-1 border-rpp-grey-border rounded-l-none"
                            data-testid={`input-variation-price-${index}`}
                          />
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                          <Checkbox
                            id={`no-charge-${index}`}
                            checked={variation.noCharge}
                            onCheckedChange={(checked) => {
                              updateVariation(index, 'noCharge', !!checked);
                              if (checked) {
                                updateVariation(index, 'price', '0');
                              }
                            }}
                            data-testid={`checkbox-no-charge-${index}`}
                          />
                          <label htmlFor={`no-charge-${index}`} className="text-sm text-rpp-grey-dark cursor-pointer">
                            No charge
                          </label>
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-rpp-grey-dark">
                          Appointment Duration (minutes)
                        </Label>
                        <Input
                          type="number"
                          placeholder="60"
                          value={variation.appointmentDuration}
                          onChange={(e) => updateVariation(index, 'appointmentDuration', e.target.value)}
                          className="border-rpp-grey-border mt-1"
                          data-testid={`input-variation-duration-${index}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={addVariation}
                  className="w-full border-dashed border-rpp-grey-border hover:border-blue-400 hover:bg-blue-50"
                  data-testid="button-add-variation"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New option
                </Button>
              </div>
            )}
          </div>

          {/* Pricing (only shown if no variations) */}
          {!productData.hasVariations && (
            <div className="grid grid-cols-2 gap-4 border-t pt-6">
              <div>
                <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                  Price (before tax)
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 py-2 border border-r-0 border-rpp-grey-border bg-rpp-grey-surface rounded-l-lg text-sm text-rpp-grey-dark">
                    AUD $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={productData.price}
                    onChange={(e) => setProductData(prev => ({ ...prev, price: e.target.value }))}
                    disabled={noCharge}
                    className="flex-1 border-rpp-grey-border rounded-l-none focus:ring-rpp-red-main"
                    data-testid="input-product-price"
                  />
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <Checkbox
                    id="no-charge"
                    checked={noCharge}
                    onCheckedChange={(checked) => {
                      setNoCharge(!!checked);
                      if (checked) {
                        setProductData(prev => ({ ...prev, price: "0" }));
                      }
                    }}
                    data-testid="checkbox-no-charge-base"
                  />
                  <label htmlFor="no-charge" className="text-sm text-rpp-grey-dark cursor-pointer">
                    No charge
                  </label>
                </div>
              </div>
              
              {productData.productType === "onsite" && (
                <div>
                  <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                    Appointment Duration (minutes)
                  </label>
                  <Input
                    type="number"
                    placeholder="60"
                    value={productData.appointmentDuration}
                    onChange={(e) => setProductData(prev => ({ ...prev, appointmentDuration: e.target.value }))}
                    className="border-rpp-grey-border focus:ring-rpp-red-main"
                    data-testid="input-appointment-duration"
                  />
                </div>
              )}
            </div>
          )}

          {/* Tax Rate */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-rpp-grey-dark mb-2">
              Tax Rate
            </h3>
            <Select 
              value={productData.taxRate} 
              onValueChange={(value) => setProductData(prev => ({ ...prev, taxRate: value }))}
            >
              <SelectTrigger className="border-rpp-grey-border" data-testid="select-tax-rate">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">GST (10%)</SelectItem>
                <SelectItem value="0">No Tax</SelectItem>
                <SelectItem value="5">5%</SelectItem>
                <SelectItem value="15">15%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-rpp-grey-border">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="text-rpp-red-main hover:text-rpp-red-dark"
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={createProductMutation.isPending}
            className="hover:bg-rpp-red-dark text-white bg-[#f05a2a]"
            data-testid="button-save-product"
          >
            {createProductMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
