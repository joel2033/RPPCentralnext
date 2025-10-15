import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X, CloudUpload } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CreateProductModalProps {
  onClose: () => void;
}

export default function CreateProductModal({ onClose }: CreateProductModalProps) {
  const [productData, setProductData] = useState({
    title: "",
    description: "",
    type: "",
    category: "",
    price: "",
    taxRate: "10",
    hasVariations: false,
    variants: 0,
    isActive: true,
    isLive: true
  });

  const [productImage, setProductImage] = useState<File | null>(null);
  const [noCharge, setNoCharge] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createProductMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Product Created",
        description: "Product has been created successfully.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create product. Please try again.",
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

  const handleSubmit = () => {
    if (!productData.title || !productData.type) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (!noCharge && !productData.price) {
      toast({
        title: "Missing Price",
        description: "Please enter a price or mark as no charge.",
        variant: "destructive",
      });
      return;
    }

    // Add partnerId to product data for multi-tenancy
    const finalData = {
      partnerId: "partner_192l9bh1xmduwueha", // Use actual partnerId from auth context
      title: productData.title,
      type: productData.type,
      description: productData.description || null,
      price: noCharge ? "0.00" : productData.price,
      category: productData.category || null,
      taxRate: productData.taxRate || null,
      hasVariations: productData.hasVariations || null,
      variants: productData.hasVariations ? productData.variants : null,
      isActive: productData.isActive,
      isLive: productData.isLive,
      image: null // Handle image upload later
    };

    createProductMutation.mutate(finalData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 modal-backdrop z-50 flex items-center justify-center px-1">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-rpp-grey-border">
          <div>
            <h2 className="text-xl font-semibold text-rpp-grey-dark">Create New Product</h2>
            <p className="text-sm text-rpp-grey-light mt-1">
              Create your new product, package or add-on by providing the necessary details below. 
              Once saved, you'll be able to seamlessly manage all advanced settings in one place.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-rpp-grey-light" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* Product Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
              Product Type
            </label>
            <Select value={productData.type} onValueChange={(value) => setProductData(prev => ({ ...prev, type: value }))}>
              <SelectTrigger className="border-rpp-grey-border">
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
          <div className="mb-6">
            <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
              Product Title
            </label>
            <Input
              type="text"
              placeholder="What is the name of your product or service?"
              value={productData.title}
              onChange={(e) => setProductData(prev => ({ ...prev, title: e.target.value }))}
              className="border-rpp-grey-border focus:ring-rpp-red-main"
            />
          </div>

          {/* Product Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
              Product Description (optional)
            </label>
            <Textarea
              rows={4}
              placeholder="Compose an engaging description that portrays the unique features, benefits and/or inclusions of your offering"
              value={productData.description}
              onChange={(e) => setProductData(prev => ({ ...prev, description: e.target.value }))}
              className="border-rpp-grey-border focus:ring-rpp-red-main resize-none"
            />
            <div className="flex justify-end mt-1">
              <span className="text-xs text-rpp-grey-light">
                {productData.description.length}/400
              </span>
            </div>
          </div>

          {/* Product Picture */}
          <div className="mb-6">
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
          <div className="mb-6">
            <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
              Product Category(s) (optional)
            </label>
            <Select value={productData.category} onValueChange={(value) => setProductData(prev => ({ ...prev, category: value }))}>
              <SelectTrigger className="border-rpp-grey-border">
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

          {/* Variations */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
              Variations
            </label>
            <p className="text-sm text-rpp-grey-light mb-3">
              Does this product have variations?
            </p>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="has-variations"
                checked={productData.hasVariations}
                onCheckedChange={(checked) => setProductData(prev => ({ ...prev, hasVariations: !!checked }))}
              />
              <label htmlFor="has-variations" className="text-sm text-rpp-grey-dark">
                Yes
              </label>
            </div>
            
            {productData.hasVariations && (
              <div className="mt-3">
                <Input
                  type="number"
                  placeholder="Number of variations"
                  value={productData.variants}
                  onChange={(e) => setProductData(prev => ({ ...prev, variants: parseInt(e.target.value) || 0 }))}
                  className="border-rpp-grey-border focus:ring-rpp-red-main w-32"
                />
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-4 mb-6">
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
                />
                <label htmlFor="no-charge" className="text-sm text-rpp-grey-dark">
                  No charge
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                Tax Rate
              </label>
              <Select value={productData.taxRate} onValueChange={(value) => setProductData(prev => ({ ...prev, taxRate: value }))}>
                <SelectTrigger className="border-rpp-grey-border">
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
            disabled={createProductMutation.isPending}
            className="bg-rpp-grey-medium hover:bg-rpp-grey-dark text-white"
          >
            {createProductMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
