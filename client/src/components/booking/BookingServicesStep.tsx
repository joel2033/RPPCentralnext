import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBookingProducts } from "@/lib/booking";
import type { SelectedProduct, SelectedAddOn, BookingProduct, ProductVariation } from "@/lib/booking/types";
import {
  ChevronRight,
  ChevronLeft,
  Clock,
  Check,
  Camera,
  Video,
  Plane,
  Box,
  Building2,
  Plus,
  Minus,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Package,
} from "lucide-react";

interface BookingServicesStepProps {
  partnerId: string;
  selectedProducts: SelectedProduct[];
  selectedAddOns: SelectedAddOn[];
  onServicesChange: (data: {
    selectedProducts: SelectedProduct[];
    selectedAddOns: SelectedAddOn[];
  }) => void;
  onNext: () => void;
  onBack: () => void;
}

// Icon mapping based on product category
const getCategoryIcon = (category?: string, type?: string) => {
  if (type === "package") return Package;
  switch (category?.toLowerCase()) {
    case "photo":
    case "photography":
      return Camera;
    case "video":
      return Video;
    case "drone":
      return Plane;
    case "floorplan":
    case "floor plan":
      return Building2;
    case "addon":
      return Box;
    default:
      return Camera;
  }
};

// Helper to safely format price values
const formatPrice = (price: unknown): string => {
  const numPrice = typeof price === 'number' ? price : parseFloat(String(price) || '0');
  return numPrice.toFixed(2);
};

// Helper to format price with tax included (GST)
const formatPriceWithTax = (price: unknown, taxRate: number = 10): string => {
  const numPrice = typeof price === 'number' ? price : parseFloat(String(price) || '0');
  const priceWithTax = numPrice * (1 + taxRate / 100);
  return priceWithTax.toFixed(2);
};

// Helper to calculate price with tax
const getPriceWithTax = (price: unknown, taxRate: number = 10): number => {
  const numPrice = typeof price === 'number' ? price : parseFloat(String(price) || '0');
  return numPrice * (1 + taxRate / 100);
};

export function BookingServicesStep({
  partnerId,
  selectedProducts,
  selectedAddOns,
  onServicesChange,
  onNext,
  onBack,
}: BookingServicesStepProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>(() => {
    // Initialize from existing selections
    const initial: Record<string, number> = {};
    selectedProducts.forEach((p) => {
      initial[p.id] = p.quantity;
    });
    return initial;
  });
  const [showAddOnsModal, setShowAddOnsModal] = useState(false);
  const [selectedForAddOns, setSelectedForAddOns] = useState<BookingProduct | null>(null);
  const [modalQuantity, setModalQuantity] = useState(1);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>(() =>
    selectedAddOns.map((a) => a.id)
  );
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  // Track selected variations per product (productId -> variation)
  const [productVariations, setProductVariations] = useState<Record<string, ProductVariation>>({});

  // Fetch products from API
  const { data: products = [], isLoading } = useBookingProducts(partnerId);

  // Filter and categorize products
  const { packages, regularProducts, addons } = useMemo(() => {
    const filtered = products.filter(
      (p) =>
        p.isActive &&
        p.isLive &&
        (searchQuery === "" ||
          p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return {
      packages: filtered.filter((p) => p.type === "package"),
      regularProducts: filtered.filter((p) => p.type === "product"),
      addons: filtered.filter((p) => p.type === "addon"),
    };
  }, [products, searchQuery]);

  // Update quantity for a product
  const updateQuantity = (product: BookingProduct, change: number) => {
    setProductQuantities((prev) => {
      const current = prev[product.id] || 0;
      const newValue = Math.max(0, current + change);
      return { ...prev, [product.id]: newValue };
    });
  };

  // Handle product click to open add-ons modal
  const handleProductClick = (product: BookingProduct) => {
    setSelectedForAddOns(product);
    setModalQuantity(productQuantities[product.id] || 1);
    // Restore previously selected variation for this product, or null
    setSelectedVariation(productVariations[product.id] || null);
    setShowAddOnsModal(true);
  };

  // Toggle add-on selection
  const toggleAddOn = (addonId: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId)
        ? prev.filter((id) => id !== addonId)
        : [...prev, addonId]
    );
  };

  // Handle modal continue - add product to selection
  const handleModalContinue = () => {
    if (selectedForAddOns) {
      setProductQuantities((prev) => ({
        ...prev,
        [selectedForAddOns.id]: modalQuantity,
      }));
      
      // Store selected variation if product has variations
      if (selectedVariation) {
        setProductVariations((prev) => ({
          ...prev,
          [selectedForAddOns.id]: selectedVariation,
        }));
      }
    }
    setShowAddOnsModal(false);
  };

  // Calculate total
  const calculateTotal = () => {
    let total = 0;

    // Products total (use variation price if selected, with tax)
    Object.entries(productQuantities).forEach(([id, qty]) => {
      if (qty > 0) {
        const product = products.find((p) => p.id === id);
        if (product) {
          const variation = productVariations[id];
          const basePrice = (product.hasVariations && variation)
            ? (typeof variation.price === 'number' ? variation.price : parseFloat(String(variation.price) || '0'))
            : product.price;
          // Apply tax to the product price
          const priceWithTax = getPriceWithTax(basePrice, product.taxRate);
          total += priceWithTax * qty;
        }
      }
    });

    // Add-ons total (with tax)
    selectedAddonIds.forEach((id) => {
      const addon = addons.find((a) => a.id === id);
      if (addon) {
        total += getPriceWithTax(addon.price, addon.taxRate);
      }
    });

    return total;
  };

  // Handle continue - pass selections to parent
  const handleContinue = () => {
    const selectedProductsData: SelectedProduct[] = [];

    Object.entries(productQuantities).forEach(([id, quantity]) => {
      if (quantity > 0) {
        const product = products.find((p) => p.id === id);
        if (product) {
          // Check if there's a selected variation for this product
          const variation = productVariations[id];
          const useVariation = product.hasVariations && variation;
          
          selectedProductsData.push({
            id: product.id,
            name: useVariation ? `${product.title} - ${variation.name}` : product.title,
            price: useVariation 
              ? (typeof variation.price === 'number' ? variation.price : parseFloat(String(variation.price) || '0'))
              : product.price,
            taxRate: product.taxRate || 10,
            quantity,
            category: product.category || product.type,
            duration: useVariation && variation.appointmentDuration 
              ? variation.appointmentDuration 
              : product.appointmentDuration,
            variationName: useVariation ? variation.name : undefined,
          });
        }
      }
    });

    const selectedAddOnsData: SelectedAddOn[] = selectedAddonIds
      .map((id) => {
        const addon = addons.find((a) => a.id === id);
        return addon ? { id: addon.id, name: addon.title, price: addon.price, taxRate: addon.taxRate || 10 } : null;
      })
      .filter((a): a is SelectedAddOn => a !== null);

    onServicesChange({
      selectedProducts: selectedProductsData,
      selectedAddOns: selectedAddOnsData,
    });

    onNext();
  };

  const hasSelections = Object.values(productQuantities).some((q) => q > 0);

  if (isLoading) {
    return (
      <div className="relative min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-[#f2572c] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <button
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              onClick={onBack}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold">Select your services</h1>
            <div className="w-9" /> {/* Spacer for alignment */}
          </div>
          <p className="text-sm text-gray-500 text-center">
            Choose from our packages and products for your shoot
          </p>

          {/* Search */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl h-11"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {/* Packages */}
        {packages.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-semibold">Packages</h2>
              <Badge variant="secondary" className="text-xs">
                Popular Choice
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {packages.map((product) => {
                const Icon = getCategoryIcon(product.category, product.type);
                const quantity = productQuantities[product.id] || 0;

                return (
                  <Card
                    key={product.id}
                    className="rounded-3xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 group flex flex-col"
                  >
                    <div className="h-48 bg-gradient-to-br from-[#f2572c]/10 via-[#f2572c]/5 to-orange-50 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-[#f2572c]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Icon className="w-16 h-16 text-[#f2572c]/70 relative z-10" />
                      )}
                    </div>
                    <CardContent className="p-5 flex flex-col flex-1">
                      {/* Fixed height content area */}
                      <div className="flex-1 min-h-[100px]">
                        <h3 className="text-lg font-semibold mb-2">{product.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                          <Clock className="w-3.5 h-3.5 text-[#f2572c]" />
                          <span>{product.appointmentDuration} min</span>
                        </div>
                        {product.description && (
                          <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                            {product.description}
                          </p>
                        )}
                      </div>

                      {/* Options/View details - always at same position */}
                      <div className="flex items-center gap-3 mb-3 h-6">
                        <button
                          className="flex items-center gap-1.5 text-xs text-[#f2572c] hover:text-[#d94820] transition-colors"
                          onClick={() => handleProductClick(product)}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>View details</span>
                        </button>
                      </div>

                      {quantity === 0 ? (
                        <button
                          className="w-full bg-gradient-to-r from-[#f2572c] to-[#f2572c]/90 hover:from-[#d94820] hover:to-[#f2572c] text-white rounded-xl p-3 flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#f2572c]/20 hover:shadow-xl hover:shadow-[#f2572c]/30"
                          onClick={() => handleProductClick(product)}
                        >
                          <Plus className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {product.hasVariations && product.variations && product.variations.length > 0
                              ? `From AUD $${formatPriceWithTax(Math.min(...product.variations.map(v => typeof v.price === 'number' ? v.price : parseFloat(String(v.price) || '0'))), product.taxRate)} inc. GST`
                              : `AUD $${formatPriceWithTax(product.price, product.taxRate)} inc. GST`
                            }
                          </span>
                        </button>
                      ) : (
                        <button
                          className="w-full bg-gradient-to-r from-[#f2572c] to-[#f2572c]/90 text-white rounded-xl p-3 flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#f2572c]/20"
                          onClick={() => handleProductClick(product)}
                        >
                          <div className="flex items-center gap-3 flex-1 justify-center">
                            <div className="flex items-center gap-2 bg-white/20 rounded-lg px-2.5 py-1.5">
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQuantity(product, -1);
                                }}
                                className="hover:bg-white/10 rounded p-0.5 transition-colors cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-sm min-w-[24px] text-center font-medium">
                                {quantity}
                              </span>
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQuantity(product, 1);
                                }}
                                className="hover:bg-white/10 rounded p-0.5 transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </div>
                            </div>
                            <span className="text-sm font-medium">
                              AUD ${formatPriceWithTax((() => {
                                const variation = productVariations[product.id];
                                const unitPrice = (product.hasVariations && variation)
                                  ? (typeof variation.price === 'number' ? variation.price : parseFloat(String(variation.price) || '0'))
                                  : (typeof product.price === 'number' ? product.price : parseFloat(String(product.price) || '0'));
                                return unitPrice * quantity;
                              })(), product.taxRate)}
                            </span>
                          </div>
                        </button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Products */}
        {regularProducts.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-5">Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {regularProducts.map((product) => {
                const Icon = getCategoryIcon(product.category, product.type);
                const quantity = productQuantities[product.id] || 0;

                return (
                  <Card
                    key={product.id}
                    className="rounded-3xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 group flex flex-col"
                  >
                    <div className="h-48 bg-gradient-to-br from-gray-100 via-gray-50 to-white flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-[#f2572c]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Icon className="w-16 h-16 text-gray-400/50 relative z-10 group-hover:text-[#f2572c]/70 transition-colors duration-300" />
                      )}
                    </div>
                    <CardContent className="p-5 flex flex-col flex-1">
                      {/* Fixed height content area */}
                      <div className="flex-1 min-h-[100px]">
                        <h3 className="text-lg font-semibold mb-2">{product.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                          <Clock className="w-3.5 h-3.5 text-[#f2572c]" />
                          <span>
                            {product.appointmentDuration} -{" "}
                            {product.appointmentDuration + 30} min
                          </span>
                        </div>
                        {product.description && (
                          <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                            {product.description}
                          </p>
                        )}
                      </div>

                      {/* Options button - always at same position */}
                      <div className="flex items-center gap-3 mb-3 h-6">
                        {product.hasVariations ? (
                          <button
                            className="flex items-center gap-1.5 text-xs text-[#f2572c] hover:text-[#d94820] transition-colors"
                            onClick={() => handleProductClick(product)}
                          >
                            <span>{product.variations?.length || 0} Options</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-xs text-transparent">-</span>
                        )}
                      </div>

                      <button
                        className={`w-full rounded-xl p-3 flex items-center justify-center gap-2 transition-all ${
                          quantity > 0
                            ? "bg-gradient-to-r from-[#f2572c] to-[#f2572c]/90 text-white shadow-lg shadow-[#f2572c]/20"
                            : "bg-gradient-to-r from-[#f2572c] to-[#f2572c]/90 hover:from-[#d94820] hover:to-[#f2572c] text-white shadow-lg shadow-[#f2572c]/20 hover:shadow-xl hover:shadow-[#f2572c]/30"
                        }`}
                        onClick={() => {
                          // Always open modal for products with variations
                          if (product.hasVariations) {
                            handleProductClick(product);
                          } else if (quantity === 0) {
                            updateQuantity(product, 1);
                          } else {
                            handleProductClick(product);
                          }
                        }}
                      >
                        {quantity === 0 ? (
                          <>
                            <Plus className="w-4 h-4" />
                            <span className="text-sm font-medium">
                              {product.hasVariations && product.variations && product.variations.length > 0
                                ? `From AUD $${formatPriceWithTax(Math.min(...product.variations.map(v => typeof v.price === 'number' ? v.price : parseFloat(String(v.price) || '0'))), product.taxRate)} inc. GST`
                                : `AUD $${formatPriceWithTax(product.price, product.taxRate)} inc. GST`
                              }
                            </span>
                          </>
                        ) : (
                          <div className="flex items-center gap-3 flex-1 justify-center">
                            <div className="flex items-center gap-2 bg-white/20 rounded-lg px-2.5 py-1.5">
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQuantity(product, -1);
                                }}
                                className="hover:bg-white/10 rounded p-0.5 transition-colors cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-sm min-w-[24px] text-center font-medium">
                                {quantity}
                              </span>
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQuantity(product, 1);
                                }}
                                className="hover:bg-white/10 rounded p-0.5 transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </div>
                            </div>
                            <span className="text-sm font-medium">
                              AUD ${formatPriceWithTax((() => {
                                const variation = productVariations[product.id];
                                const unitPrice = (product.hasVariations && variation)
                                  ? (typeof variation.price === 'number' ? variation.price : parseFloat(String(variation.price) || '0'))
                                  : (typeof product.price === 'number' ? product.price : parseFloat(String(product.price) || '0'));
                                return unitPrice * quantity;
                              })(), product.taxRate)}
                            </span>
                          </div>
                        )}
                      </button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Add-ons Section */}
        {addons.length > 0 && hasSelections && (
          <div>
            <h2 className="text-xl font-semibold mb-5">Add-ons</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {addons.map((addon) => {
                const isSelected = selectedAddonIds.includes(addon.id);

                return (
                  <button
                    key={addon.id}
                    onClick={() => toggleAddOn(addon.id)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? "border-[#f2572c] bg-[#f2572c]/5 shadow-md"
                        : "border-gray-200 hover:border-[#f2572c]/50 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1">{addon.title}</p>
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {addon.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <span className="text-sm font-medium">
                          ${formatPriceWithTax(addon.price, addon.taxRate)}
                        </span>
                        {isSelected ? (
                          <div className="w-5 h-5 bg-[#f2572c] rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 border-2 border-gray-300 rounded-full flex items-center justify-center">
                            <Plus className="w-3 h-3 text-gray-400" />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {packages.length === 0 && regularProducts.length === 0 && (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No services available</p>
            <p className="text-sm text-gray-500">
              {searchQuery
                ? "Try adjusting your search"
                : "Please contact us for available services"}
            </p>
          </div>
        )}
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t shadow-2xl">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={onBack}
            className="rounded-xl h-11 px-6"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <button className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors">
            <span className="text-sm text-gray-500">Total (inc. GST)</span>
            <span className="text-lg font-semibold">
              AUD ${calculateTotal().toFixed(2)}
            </span>
            <ChevronUp className="w-4 h-4 text-gray-400" />
          </button>

          <Button
            onClick={handleContinue}
            disabled={!hasSelections}
            className="bg-[#f2572c] hover:bg-[#d94820] text-white rounded-xl px-8 h-11 shadow-lg shadow-[#f2572c]/25 hover:shadow-xl hover:shadow-[#f2572c]/30 transition-all disabled:opacity-50 disabled:shadow-none"
          >
            Continue
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Product Details Modal */}
      {showAddOnsModal && selectedForAddOns && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-3xl rounded-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-[#f2572c]/5 to-transparent">
              <div>
                <h3 className="text-xl font-semibold mb-1">{selectedForAddOns.title}</h3>
                <p className="text-xs text-gray-500">Customize your selection</p>
              </div>
              <button
                onClick={() => setShowAddOnsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Product Details */}
                <div>
                  <div className="h-56 bg-gradient-to-br from-[#f2572c]/10 via-[#f2572c]/5 to-orange-50 rounded-2xl flex items-center justify-center mb-5 shadow-inner">
                    {selectedForAddOns.image ? (
                      <img
                        src={selectedForAddOns.image}
                        alt={selectedForAddOns.title}
                        className="w-full h-full object-cover rounded-2xl"
                      />
                    ) : (
                      <Camera className="w-20 h-20 text-[#f2572c]/70" />
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                    <Clock className="w-3.5 h-3.5 text-[#f2572c]" />
                    <span>Duration - {selectedForAddOns.appointmentDuration} min</span>
                  </div>

                  <p className="text-sm leading-relaxed text-gray-600">
                    {selectedForAddOns.description}
                  </p>
                </div>

                {/* Right: Options & Add-ons */}
                <div className="space-y-6">
                  {/* Variations - Selectable Options */}
                  {selectedForAddOns.hasVariations && selectedForAddOns.variations && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="text-sm font-medium mb-3">Options</h4>
                      <div className="space-y-2">
                        {selectedForAddOns.variations.map((variant, idx) => {
                          const isSelected = selectedVariation?.name === variant.name;
                          const variantPrice = typeof variant.price === 'number' 
                            ? variant.price 
                            : parseFloat(String(variant.price) || '0');
                          
                          return (
                            <button
                              key={idx}
                              onClick={() => setSelectedVariation(variant)}
                              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                                isSelected
                                  ? "border-[#f2572c] bg-[#f2572c]/5 shadow-md"
                                  : "border-gray-200 hover:border-[#f2572c]/50 hover:bg-white"
                              }`}
                            >
                              <span className="text-sm">{variant.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  AUD ${formatPriceWithTax(variantPrice, selectedForAddOns.taxRate)} inc. GST
                                </span>
                                {isSelected ? (
                                  <div className="w-5 h-5 bg-[#f2572c] rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 border-2 border-gray-300 rounded-full flex items-center justify-center">
                                    <Plus className="w-3 h-3 text-gray-400" />
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Add-ons - filtered by product's availableAddons */}
                  {(() => {
                    // Debug logging
                    console.log('Selected product:', selectedForAddOns.title);
                    console.log('Available addons config:', selectedForAddOns.availableAddons);
                    console.log('All addons:', addons.map(a => ({ id: a.id, title: a.title })));
                    
                    // Only show addons that are explicitly configured for this product
                    // If no addons are configured, don't show any
                    const filteredAddons = selectedForAddOns.availableAddons && selectedForAddOns.availableAddons.length > 0
                      ? addons.filter(addon => selectedForAddOns.availableAddons?.includes(addon.id))
                      : []; // Don't show any addons if none are configured
                    
                    console.log('Filtered addons:', filteredAddons.map(a => ({ id: a.id, title: a.title })));
                    
                    return filteredAddons.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-base font-medium">Add-ons</h4>
                          <Badge variant="secondary" className="text-xs">
                            Optional
                          </Badge>
                        </div>
                        <div className="space-y-3">
                          {filteredAddons.map((addon) => {
                            const isAddonSelected = selectedAddonIds.includes(addon.id);

                            return (
                              <button
                                key={addon.id}
                                onClick={() => toggleAddOn(addon.id)}
                                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                                  isAddonSelected
                                    ? "border-[#f2572c] bg-[#f2572c]/5 shadow-md"
                                    : "border-gray-200 hover:border-[#f2572c]/50 hover:bg-gray-50"
                                }`}
                              >
                                <div className="text-left flex-1">
                                  <p className="text-sm font-medium mb-0.5">{addon.title}</p>
                                  <p className="text-xs text-gray-500 line-clamp-1">
                                    {addon.description}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 ml-4">
                                  <span className="text-sm font-medium">
                                    ${formatPriceWithTax(addon.price, addon.taxRate)} inc. GST
                                  </span>
                                  {isAddonSelected ? (
                                    <div className="w-6 h-6 bg-[#f2572c] rounded-full flex items-center justify-center shadow-sm">
                                      <Check className="w-3.5 h-3.5 text-white" />
                                    </div>
                                  ) : (
                                    <div className="w-6 h-6 border-2 border-gray-300 rounded-full flex items-center justify-center">
                                      <Plus className="w-3.5 h-3.5 text-gray-400" />
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gradient-to-r from-gray-50 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">Quantity</span>
                <div className="flex items-center gap-2 border-2 border-gray-200 rounded-xl px-3 py-2 bg-white">
                  <button
                    onClick={() => setModalQuantity(Math.max(1, modalQuantity - 1))}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sm min-w-[28px] text-center font-medium">
                    {modalQuantity}
                  </span>
                  <button
                    onClick={() => setModalQuantity(modalQuantity + 1)}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-5">
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-0.5">Total (inc. GST)</p>
                  <span className="text-2xl font-semibold">
                    AUD $
                    {(() => {
                      // Use selected variation price if available, otherwise base price
                      const basePrice = selectedVariation 
                        ? (typeof selectedVariation.price === 'number' ? selectedVariation.price : parseFloat(String(selectedVariation.price) || '0'))
                        : (typeof selectedForAddOns.price === 'number' ? selectedForAddOns.price : parseFloat(String(selectedForAddOns.price) || '0'));
                      
                      // Apply tax to base price
                      const basePriceWithTax = getPriceWithTax(basePrice, selectedForAddOns.taxRate);
                      
                      // Calculate addons total with tax
                      const addonsTotal = selectedAddonIds.reduce((sum, id) => {
                        const addon = addons.find((a) => a.id === id);
                        if (addon) {
                          return sum + getPriceWithTax(addon.price, addon.taxRate);
                        }
                        return sum;
                      }, 0);
                      
                      return (basePriceWithTax * modalQuantity + addonsTotal).toFixed(2);
                    })()}
                  </span>
                </div>
                <Button
                  onClick={handleModalContinue}
                  disabled={selectedForAddOns.hasVariations && !selectedVariation}
                  className="bg-[#f2572c] hover:bg-[#d94820] text-white rounded-xl px-8 h-11 shadow-lg shadow-[#f2572c]/25 hover:shadow-xl hover:shadow-[#f2572c]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add to Order
                  <Check className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default BookingServicesStep;

