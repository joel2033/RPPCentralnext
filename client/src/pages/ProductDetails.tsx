import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, Plus, Trash2, X, Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { nanoid } from "nanoid";

interface ProductVariation {
  name: string;
  price: string;
  appointmentDuration: number;
  noCharge: boolean;
}

export default function ProductDetails() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch product data
  const { data: product, isLoading, error } = useQuery({
    queryKey: [`/api/products/${id}`],
    enabled: !!id,
  });

  // Fetch customers for exclusivity
  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["/api/customers"],
  });

  // Fetch team members (photographers only)
  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Filter for photographers only
  const teamMembers = allUsers.filter((user: any) => user.role === 'photographer');

  // Local state for editing
  const [formData, setFormData] = useState<any>(null);
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Initialize form data when product loads or changes
  useEffect(() => {
    if (product) {
      const productData: any = product;
      setFormData({
        title: productData.title || "",
        description: productData.description || "",
        type: productData.type || "",
        category: productData.category || "",
        price: productData.price || "",
        taxRate: productData.taxRate || "10",
        hasVariations: productData.hasVariations || false,
        productType: productData.productType || "onsite",
        requiresAppointment: productData.requiresAppointment !== undefined ? productData.requiresAppointment : true,
        appointmentDuration: productData.appointmentDuration || 60,
        exclusivityType: productData.exclusivityType || "none",
        isActive: productData.isActive !== undefined ? productData.isActive : true,
        isLive: productData.isLive !== undefined ? productData.isLive : true,
      });

      // Set image preview and uploaded URL if exists
      if (productData.image) {
        setImagePreview(productData.image);
        setUploadedImageUrl(productData.image);
      }

      // Parse variations if they exist
      if (productData.variations) {
        try {
          const parsedVariations = JSON.parse(productData.variations);
          setVariations(parsedVariations);
        } catch (e) {
          console.error("Failed to parse variations:", e);
          setVariations([]);
        }
      } else {
        setVariations([]);
      }

      // Parse exclusive customer IDs
      if (productData.exclusiveCustomerIds) {
        try {
          const parsedIds = JSON.parse(productData.exclusiveCustomerIds);
          setSelectedCustomers(parsedIds);
        } catch (e) {
          console.error("Failed to parse exclusive customer IDs:", e);
          setSelectedCustomers([]);
        }
      } else {
        setSelectedCustomers([]);
      }
    }
  }, [product, id]);

  const updateProductMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/products/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: [`/api/products/${id}`] });
      toast({
        title: "Changes Saved",
        description: "Product has been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Product update error:", error);
      toast({
        title: "Error Saving Changes",
        description: error?.message || "Failed to update product",
        variant: "destructive",
      });
    },
  });

  const handleImageUpload = async () => {
    if (!productImage) {
      console.log("No product image to upload");
      return;
    }

    console.log("Starting image upload...", productImage.name);
    setIsUploadingImage(true);
    
    try {
      const fileName = `product-${nanoid()}.jpg`;
      console.log("Uploading with filename:", fileName);
      
      // Convert image to base64
      const reader = new FileReader();
      const imageData = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(productImage);
      });

      // Upload via backend endpoint (bypasses CORS)
      const response = await fetch('/api/products/upload-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageData,
          fileName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const { thumbnailUrl } = await response.json();
      
      console.log("Upload successful! URL:", thumbnailUrl);
      setUploadedImageUrl(thumbnailUrl);
      setImagePreview(thumbnailUrl);
      setProductImage(null);
      
      toast({
        title: "Image Uploaded",
        description: "Product image uploaded successfully. Click 'Save changes' to update the product.",
      });
    } catch (uploadError: any) {
      console.error("Image upload error:", uploadError);
      toast({
        title: "Upload Failed",
        description: uploadError?.message || "Failed to upload product image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!formData) return;

    const variationsData = formData.hasVariations ? variations.map(v => ({
      name: v.name,
      price: v.noCharge ? "0.00" : v.price,
      appointmentDuration: v.appointmentDuration || 60,
      noCharge: v.noCharge
    })) : null;

    const updateData = {
      ...formData,
      variations: variationsData ? JSON.stringify(variationsData) : null,
      variants: formData.hasVariations ? variations.length : 0,
      exclusiveCustomerIds: formData.exclusivityType === "exclusive" && selectedCustomers.length > 0 
        ? JSON.stringify(selectedCustomers) 
        : null,
      image: uploadedImageUrl || null,
    };

    updateProductMutation.mutate(updateData);
  };

  const addVariation = () => {
    setVariations([...variations, { name: "", price: "", appointmentDuration: 60, noCharge: false }]);
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 2MB.",
          variant: "destructive",
        });
        return;
      }

      setProductImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      // Clear the uploaded URL since this is a new selection
      setUploadedImageUrl(null);
    }
  };

  const removeImage = () => {
    setProductImage(null);
    setImagePreview(null);
    setUploadedImageUrl(null);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-rpp-grey-border rounded w-1/4"></div>
          <div className="h-96 bg-rpp-grey-border rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-red-600">Product not found</h2>
          <p className="text-rpp-grey-light mt-2">This product doesn't exist or has been deleted.</p>
          <Button onClick={() => setLocation("/products")} className="mt-4">
            Back to Products
          </Button>
        </div>
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-blue-600">Loading product data...</h2>
          <p className="text-rpp-grey-light mt-2">Please wait while we load the product information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rpp-grey-surface">
      {/* Header */}
      <div className="bg-white border-b border-rpp-grey-border px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/products")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Products
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-rpp-grey-dark">{(product as any)?.title}</h1>
              <p className="text-sm text-rpp-grey-light">Product Details</p>
            </div>
          </div>
          <Button
            onClick={handleSaveChanges}
            disabled={updateProductMutation.isPending}
            className="bg-[#f05a2a] hover:bg-rpp-red-dark text-white"
            data-testid="button-save-changes"
          >
            {updateProductMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Product Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Photography Section */}
            <div className="bg-white rounded-xl border border-rpp-grey-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-rpp-grey-dark">Photography</h2>
              </div>
              <p className="text-sm text-rpp-grey-light mb-6">
                Use this section to manage more advanced fields for your product.
              </p>

              {/* Product Image Upload */}
              <div className="mb-6">
                <Label className="text-sm font-medium text-rpp-grey-dark mb-2">
                  Product Image (Optional)
                </Label>
                <p className="text-xs text-rpp-grey-light mb-3">
                  Upload an image to display as a thumbnail for the booking page and form
                </p>
                {imagePreview ? (
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Product thumbnail"
                        className="w-24 h-24 object-cover rounded-lg border border-rpp-grey-border"
                      />
                      <button
                        onClick={removeImage}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        data-testid="button-remove-image"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {uploadedImageUrl && (
                        <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-0.5">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {productImage && !uploadedImageUrl && (
                        <Button
                          onClick={handleImageUpload}
                          disabled={isUploadingImage}
                          size="sm"
                          className="bg-[#f05a2a] hover:bg-rpp-red-dark text-white"
                          data-testid="button-upload-image"
                        >
                          {isUploadingImage ? (
                            <>
                              <Upload className="w-3 h-3 mr-1 animate-pulse" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-3 h-3 mr-1" />
                              Upload
                            </>
                          )}
                        </Button>
                      )}
                      {uploadedImageUrl && (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <Check className="w-3 h-3" />
                          Uploaded
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-rpp-grey-border rounded-lg p-6 flex flex-col items-center justify-center bg-rpp-grey-surface/50">
                    <Upload className="w-8 h-8 text-rpp-grey-light mb-2" />
                    <p className="text-sm text-rpp-grey-light mb-1">
                      Max file size: 2MB image. Accepted: jpg, png
                    </p>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      onChange={handleImageChange}
                      className="hidden"
                      id="product-image-upload"
                      data-testid="input-product-image"
                    />
                    <label
                      htmlFor="product-image-upload"
                      className="text-sm text-[#f05a2a] hover:underline cursor-pointer"
                    >
                      Choose file
                    </label>
                  </div>
                )}
              </div>

              {/* Product Title */}
              <div className="mb-4">
                <Label className="text-sm font-medium text-rpp-grey-dark mb-2">
                  Product Title
                </Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter product title"
                  className="border-rpp-grey-border"
                  data-testid="input-product-title"
                />
              </div>

              {/* Product Description */}
              <div className="mb-4">
                <Label className="text-sm font-medium text-rpp-grey-dark mb-2">
                  Product Description (optional)
                </Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter product description"
                  className="border-rpp-grey-border min-h-[100px]"
                  data-testid="textarea-product-description"
                />
                <div className="text-right text-xs text-rpp-grey-light mt-1">
                  {formData.description?.length || 0}/500
                </div>
              </div>

              {/* Product Category */}
              <div className="mb-6">
                <Label className="text-sm font-medium text-rpp-grey-dark mb-2">
                  Product Category(s) (Optional)
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className="border-rpp-grey-border" data-testid="select-product-category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="photography">Photography</SelectItem>
                    <SelectItem value="videography">Videography</SelectItem>
                    <SelectItem value="editing">Editing</SelectItem>
                    <SelectItem value="drone">Drone Services</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Onsite or Digital Product - Moved before Variations */}
              <div className="border-t border-rpp-grey-border pt-6 mb-6">
                <h3 className="text-md font-semibold text-rpp-grey-dark mb-2">
                  Product Type
                </h3>
                <p className="text-sm text-rpp-grey-light mb-4">
                  Does this product require physical attendance by you, or can it be offered as a digital product only?
                </p>
                <RadioGroup
                  value={formData.productType}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    productType: value,
                    requiresAppointment: value === "onsite"
                  })}
                >
                  <div className="flex items-center space-x-2 mb-3">
                    <RadioGroupItem value="onsite" id="onsite" data-testid="radio-onsite" />
                    <Label htmlFor="onsite" className="text-sm font-normal cursor-pointer">
                      Requires onsite attendance
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="digital" id="digital" data-testid="radio-digital" />
                    <Label htmlFor="digital" className="text-sm font-normal cursor-pointer">
                      Digital product only
                    </Label>
                  </div>
                </RadioGroup>

                {/* Duration field - only shown and editable when onsite is selected */}
                {formData.productType === "onsite" && !formData.hasVariations && (
                  <div className="mt-4">
                    <Label className="text-sm font-medium text-rpp-grey-dark mb-2">
                      Appointment Duration
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={formData.appointmentDuration}
                        onChange={(e) => setFormData({ ...formData, appointmentDuration: parseInt(e.target.value) || 60 })}
                        className="border-rpp-grey-border w-24"
                        data-testid="input-appointment-duration"
                      />
                      <span className="text-sm text-rpp-grey-light">minutes</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Variations Section */}
              <div className="border-t border-rpp-grey-border pt-6">
                <h3 className="text-md font-semibold text-rpp-grey-dark mb-2">Variations</h3>
                <p className="text-sm text-rpp-grey-light mb-4">
                  Does this product have variations?
                </p>
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="has-variations"
                    checked={formData.hasVariations}
                    onCheckedChange={(checked) => {
                      setFormData({ ...formData, hasVariations: checked as boolean });
                      if (!checked) {
                        setVariations([{ name: "", price: "", appointmentDuration: 60, noCharge: false }]);
                      }
                    }}
                    data-testid="checkbox-has-variations"
                  />
                  <Label htmlFor="has-variations" className="text-sm font-normal cursor-pointer">
                    Yes
                  </Label>
                </div>

                {formData.hasVariations && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full border border-rpp-grey-border rounded-lg">
                        <thead className="bg-rpp-grey-surface">
                          <tr>
                            <th className="text-left py-3 px-4 text-sm font-medium text-rpp-grey-dark">
                              Option Name
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-rpp-grey-dark">
                              Price (Before tax)
                            </th>
                            {formData.productType === "onsite" && (
                              <th className="text-left py-3 px-4 text-sm font-medium text-rpp-grey-dark">
                                Duration
                              </th>
                            )}
                            <th className="text-left py-3 px-4 text-sm font-medium text-rpp-grey-dark">
                              No charge
                            </th>
                            <th className="w-20"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {variations.map((variation, index) => (
                            <tr key={index} className="border-t border-rpp-grey-border">
                              <td className="py-3 px-4">
                                <Input
                                  value={variation.name}
                                  onChange={(e) => updateVariation(index, "name", e.target.value)}
                                  placeholder="e.g., 8 Images"
                                  className="border-rpp-grey-border"
                                  data-testid={`input-variation-name-${index}`}
                                />
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-rpp-grey-light">AUD $</span>
                                  <Input
                                    type="number"
                                    value={variation.price}
                                    onChange={(e) => updateVariation(index, "price", e.target.value)}
                                    disabled={variation.noCharge}
                                    placeholder="0.00"
                                    className="border-rpp-grey-border"
                                    data-testid={`input-variation-price-${index}`}
                                  />
                                </div>
                              </td>
                              {formData.productType === "onsite" && (
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      value={variation.appointmentDuration}
                                      onChange={(e) => updateVariation(index, "appointmentDuration", parseInt(e.target.value) || 60)}
                                      placeholder="60"
                                      className="border-rpp-grey-border w-20"
                                      data-testid={`input-variation-duration-${index}`}
                                    />
                                    <span className="text-sm text-rpp-grey-light">min.</span>
                                  </div>
                                </td>
                              )}
                              <td className="py-3 px-4">
                                <Checkbox
                                  checked={variation.noCharge}
                                  onCheckedChange={(checked) => {
                                    updateVariation(index, "noCharge", checked as boolean);
                                    if (checked) {
                                      updateVariation(index, "price", "0.00");
                                    }
                                  }}
                                  data-testid={`checkbox-variation-nocharge-${index}`}
                                />
                              </td>
                              <td className="py-3 px-4">
                                {variations.length > 1 && (
                                  <button
                                    onClick={() => removeVariation(index)}
                                    className="text-red-500 hover:text-red-700 text-sm"
                                    data-testid={`button-remove-variation-${index}`}
                                  >
                                    Remove
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addVariation}
                      className="w-full border-rpp-grey-border text-[#f05a2a] hover:bg-rpp-grey-surface"
                      data-testid="button-add-variation"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      New option
                    </Button>
                  </div>
                )}
              </div>

              {/* Tax Rate */}
              <div className="border-t border-rpp-grey-border pt-6 mt-6">
                <Label className="text-sm font-medium text-rpp-grey-dark mb-2">
                  Tax Rate
                </Label>
                <Select
                  value={formData.taxRate}
                  onValueChange={(value) => setFormData({ ...formData, taxRate: value })}
                >
                  <SelectTrigger className="border-rpp-grey-border" data-testid="select-tax-rate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">GST Free (0%)</SelectItem>
                    <SelectItem value="10">GST (10%)</SelectItem>
                    <SelectItem value="15">GST (15%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Right Column - Additional Settings */}
          <div className="space-y-6">
            {/* Team Providers */}
            <div className="bg-white rounded-xl border border-rpp-grey-border p-6">
              <h3 className="text-md font-semibold text-rpp-grey-dark mb-2">Team Providers</h3>
              <p className="text-sm text-rpp-grey-light mb-4">
                Choose the photographer team members eligible to provide this product. By default, all team members will be selected.
              </p>
              {teamMembers.length > 0 ? (
                <div className="space-y-2">
                  {teamMembers.map((member: any) => (
                    <div key={member.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`provider-${member.id}`} 
                        defaultChecked 
                        data-testid={`checkbox-provider-${member.id}`} 
                      />
                      <Label htmlFor={`provider-${member.id}`} className="text-sm font-normal cursor-pointer">
                        {member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : member.email}
                      </Label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-rpp-grey-light italic">
                  No photographer team members found. Add photographers to assign them to products.
                </p>
              )}
            </div>

            {/* Service Area Availability */}
            <div className="bg-white rounded-xl border border-rpp-grey-border p-6">
              <h3 className="text-md font-semibold text-rpp-grey-dark mb-2">Service Area Availability</h3>
              <p className="text-sm text-rpp-grey-light mb-4">
                Select which service areas this product will be made available.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  This feature will be connected to the service areas settings page when it's created.
                </p>
              </div>
            </div>

            {/* Product Exclusivity */}
            <div className="bg-white rounded-xl border border-rpp-grey-border p-6">
              <h3 className="text-md font-semibold text-rpp-grey-dark mb-2">Product Exclusivity</h3>
              <p className="text-sm text-rpp-grey-light mb-4">
                Make this product exclusive to one or more customers, or make it available to all.
              </p>
              <RadioGroup
                value={formData.exclusivityType}
                onValueChange={(value) => setFormData({ ...formData, exclusivityType: value })}
              >
                <div className="flex items-center space-x-2 mb-3">
                  <RadioGroupItem value="none" id="no-exclusivity" data-testid="radio-no-exclusivity-detail" />
                  <Label htmlFor="no-exclusivity" className="text-sm font-normal cursor-pointer">
                    No exclusivity
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="exclusive" id="set-exclusivity" data-testid="radio-set-exclusivity-detail" />
                  <Label htmlFor="set-exclusivity" className="text-sm font-normal cursor-pointer">
                    Set exclusivity
                  </Label>
                </div>
              </RadioGroup>

              {formData.exclusivityType === "exclusive" && (
                <div className="mt-4">
                  <Select
                    onValueChange={(value) => {
                      if (!selectedCustomers.includes(value)) {
                        setSelectedCustomers([...selectedCustomers, value]);
                      }
                    }}
                  >
                    <SelectTrigger className="border-rpp-grey-border" data-testid="select-exclusive-customers-detail">
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
                    <div className="mt-3 space-y-2">
                      {selectedCustomers.map((customerId) => {
                        const customer = customers.find((c: any) => c.id === customerId);
                        return (
                          <div
                            key={customerId}
                            className="flex items-center justify-between p-2 bg-rpp-grey-surface rounded"
                          >
                            <span className="text-sm">{customer?.firstName} {customer?.lastName}</span>
                            <button
                              onClick={() => setSelectedCustomers(selectedCustomers.filter(id => id !== customerId))}
                              className="text-red-500 hover:text-red-700"
                              data-testid={`button-remove-customer-${customerId}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Exclude on Booking Form */}
            <div className="bg-white rounded-xl border border-rpp-grey-border p-6">
              <h3 className="text-md font-semibold text-rpp-grey-dark mb-2">Exclude on Booking Form</h3>
              <p className="text-sm text-rpp-grey-light mb-4">
                By default, this product will be excluded from your booking form. If you would like this to show, please tick 'Show on Booking Form'
              </p>
              <RadioGroup defaultValue="exclude">
                <div className="flex items-center space-x-2 mb-3">
                  <RadioGroupItem value="exclude" id="exclude" data-testid="radio-exclude-booking" />
                  <Label htmlFor="exclude" className="text-sm font-normal cursor-pointer">
                    Exclude
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="show" id="show" data-testid="radio-show-booking" />
                  <Label htmlFor="show" className="text-sm font-normal cursor-pointer">
                    Show on Booking Form
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Product Mapping */}
            <div className="bg-white rounded-xl border border-rpp-grey-border p-6">
              <h3 className="text-md font-semibold text-rpp-grey-dark mb-2">Product Mapping</h3>
              <p className="text-sm text-rpp-grey-light mb-4">
                Choose an account and tax to assign this product for XERO invoicing.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  This feature will be connected when Xero integration is set up.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
