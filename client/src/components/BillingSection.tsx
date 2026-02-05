import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { DollarSign, X, Package, Box, Plus as PlusIcon, ChevronDown, ChevronUp } from "lucide-react";
import { nanoid } from "nanoid";

// Billing item interface
export interface BillingItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number; // unitPrice * quantity (before tax)
}

// Product with its variations grouped
interface ProductWithVariations {
  id: string;
  title: string;
  type: string;
  price: number;
  taxRate: number;
  hasVariations: boolean;
  variations: { name: string; price: number; index: number }[];
}

interface BillingSectionProps {
  jobId: string;
  billingItems: BillingItem[];
  invoiceStatus: string;
  onBillingItemsChange: (items: BillingItem[]) => void;
  onInvoiceStatusChange: (status: string) => void;
  isReadOnly?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  xeroConnected?: boolean;
  xeroInvoiceId?: string | null;
  xeroInvoiceNumber?: string | null;
  onRaiseInvoice?: () => void;
  isRaisingInvoice?: boolean;
  /** When set, "View Invoice" opens this modal instead of linking to Xero */
  onViewInvoice?: () => void;
}

export function BillingSection({
  jobId,
  billingItems,
  invoiceStatus,
  onBillingItemsChange,
  onInvoiceStatusChange,
  isReadOnly = false,
  isCollapsed = false,
  onToggleCollapse,
  xeroConnected = false,
  xeroInvoiceId,
  xeroInvoiceNumber,
  onRaiseInvoice,
  isRaisingInvoice = false,
  onViewInvoice,
}: BillingSectionProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  // Track which price input is being edited to allow free-form typing
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceInputValue, setPriceInputValue] = useState<string>("");

  // Fetch products for the dropdown
  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  // Group products with their variations
  const groupedProducts = useMemo(() => {
    const packages: ProductWithVariations[] = [];
    const regularProducts: ProductWithVariations[] = [];
    const addons: ProductWithVariations[] = [];

    products
      .filter((p) => p.isActive !== false)
      .forEach((product) => {
        const taxRate = parseFloat(product.taxRate || "10");
        const basePrice = parseFloat(product.price || "0");

        let variations: { name: string; price: number; index: number }[] = [];

        if (product.hasVariations && product.variations) {
          try {
            const parsed = typeof product.variations === "string"
              ? JSON.parse(product.variations)
              : product.variations;

            if (Array.isArray(parsed) && parsed.length > 0) {
              variations = parsed.map((v: any, index: number) => ({
                name: v.name || `Option ${index + 1}`,
                price: parseFloat(v.price || "0"),
                index,
              }));
            }
          } catch (e) {
            console.error("Failed to parse variations:", e);
          }
        }

        const productData: ProductWithVariations = {
          id: product.id,
          title: product.title,
          type: product.type,
          price: basePrice,
          taxRate,
          hasVariations: variations.length > 0,
          variations,
        };

        if (product.type === "package") {
          packages.push(productData);
        } else if (product.type === "addon") {
          addons.push(productData);
        } else {
          regularProducts.push(productData);
        }
      });

    return { packages, regularProducts, addons };
  }, [products]);

  // Calculate totals
  const subtotal = billingItems.reduce((sum, item) => sum + item.amount, 0);
  const taxTotal = billingItems.reduce(
    (sum, item) => sum + (item.amount * item.taxRate) / 100,
    0
  );
  const total = subtotal + taxTotal;

  // Add a product to billing items
  const handleAddProduct = (selectionId: string) => {
    // Parse the selection ID - format: "productId" or "productId:variationIndex"
    const [productId, variationIndexStr] = selectionId.split(":");
    const variationIndex = variationIndexStr ? parseInt(variationIndexStr, 10) : null;

    // Find the product
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const taxRate = parseFloat(product.taxRate || "10");
    let name = product.title;
    let unitPrice = parseFloat(product.price || "0");

    // If it's a variation, get the variation details
    if (variationIndex !== null && product.variations) {
      try {
        const variations = typeof product.variations === "string"
          ? JSON.parse(product.variations)
          : product.variations;

        if (Array.isArray(variations) && variations[variationIndex]) {
          const variation = variations[variationIndex];
          name = `${product.title} - ${variation.name}`;
          unitPrice = parseFloat(variation.price || "0");
        }
      } catch (e) {
        console.error("Failed to parse variation:", e);
      }
    }

    const newItem: BillingItem = {
      id: nanoid(),
      productId: product.id,
      name,
      quantity: 1,
      unitPrice,
      taxRate,
      amount: unitPrice,
    };

    onBillingItemsChange([...billingItems, newItem]);
    setSelectedProductId("");
  };

  // Remove a billing item
  const handleRemoveItem = (itemId: string) => {
    onBillingItemsChange(billingItems.filter((item) => item.id !== itemId));
  };

  // Update item quantity
  const handleQuantityChange = (itemId: string, quantity: number) => {
    const newQuantity = Math.max(1, quantity);
    onBillingItemsChange(
      billingItems.map((item) =>
        item.id === itemId
          ? { ...item, quantity: newQuantity, amount: item.unitPrice * newQuantity }
          : item
      )
    );
  };

  // Update item price
  const handlePriceChange = (itemId: string, price: number) => {
    const newPrice = Math.max(0, price);
    onBillingItemsChange(
      billingItems.map((item) =>
        item.id === itemId
          ? { ...item, unitPrice: newPrice, amount: newPrice * item.quantity }
          : item
      )
    );
  };

  // Handle price input change (while typing)
  const handlePriceInputChange = (itemId: string, value: string) => {
    // Remove any non-numeric characters except decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = cleaned.split('.');
    const sanitized = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('') 
      : cleaned;
    
    setPriceInputValue(sanitized);
  };

  // Handle price input focus
  const handlePriceInputFocus = (itemId: string, currentPrice: number) => {
    setEditingPriceId(itemId);
    // Show raw number without .00 if it's a whole number
    const displayValue = currentPrice % 1 === 0 
      ? currentPrice.toString() 
      : currentPrice.toFixed(2);
    setPriceInputValue(displayValue);
  };

  // Handle price input blur (format on exit)
  const handlePriceInputBlur = (itemId: string) => {
    setEditingPriceId(null);
    const item = billingItems.find((i) => i.id === itemId);
    if (item) {
      // Ensure the price is properly set even if input was empty
      const finalValue = priceInputValue === "" || priceInputValue === "." 
        ? 0 
        : parseFloat(priceInputValue) || 0;
      handlePriceChange(itemId, Math.max(0, finalValue));
    }
    setPriceInputValue("");
  };

  // Get status badge styles
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-700";
      case "sent":
        return "bg-blue-100 text-blue-700";
      case "paid":
        return "bg-green-100 text-green-700";
      case "overdue":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "draft":
        return "Draft";
      case "sent":
        return "Sent";
      case "paid":
        return "Paid";
      case "overdue":
        return "Overdue";
      default:
        return "Draft";
    }
  };

  // Render product group with variations as sub-items
  const renderProductGroup = (
    title: string,
    icon: React.ReactNode,
    products: ProductWithVariations[]
  ) => {
    if (products.length === 0) return null;

    return (
      <SelectGroup>
        <SelectLabel className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 py-2 px-2 bg-gray-50">
          {icon}
          {title}
        </SelectLabel>
        {products.map((product) => (
          <div key={product.id}>
            {product.hasVariations ? (
              // Product with variations - show as header with sub-options
              <>
                <div className="px-3 py-1.5 text-xs font-medium text-gray-900 bg-gray-50/50">
                  {product.title}
                </div>
                {product.variations.map((variation) => (
                  <SelectItem
                    key={`${product.id}:${variation.index}`}
                    value={`${product.id}:${variation.index}`}
                    className="pl-6 py-1.5"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs text-gray-700">{variation.name}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        ${variation.price.toFixed(2)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </>
            ) : (
              // Product without variations
              <SelectItem value={product.id} className="py-1.5">
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs text-gray-700">{product.title}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    ${product.price.toFixed(2)}
                  </span>
                </div>
              </SelectItem>
            )}
          </div>
        ))}
      </SelectGroup>
    );
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader 
        className={`${onToggleCollapse ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
        onClick={onToggleCollapse}
      >
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <DollarSign className="h-5 w-5 mr-2" />
            Billing
          </div>
          {onToggleCollapse && (
            isCollapsed ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            )
          )}
        </CardTitle>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="px-4 pb-4 space-y-3">
        {/* Status & Actions Row */}
        <div className="flex items-center justify-between">
          <Badge className={`text-xs px-2.5 py-0.5 font-medium ${getStatusBadgeClass(invoiceStatus)}`}>
            {getStatusLabel(invoiceStatus)}
          </Badge>
          {xeroInvoiceId ? (
            onViewInvoice ? (
              <Button
                variant="outline"
                size="sm"
                className="text-sm h-8 px-3"
                onClick={onViewInvoice}
              >
                View Invoice{xeroInvoiceNumber ? ` (${xeroInvoiceNumber})` : ""}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-sm h-8 px-3"
                asChild
              >
                <a
                  href={`https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${xeroInvoiceId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Invoice{xeroInvoiceNumber ? ` (${xeroInvoiceNumber})` : ""}
                </a>
              </Button>
            )
          ) : xeroConnected && billingItems.length > 0 && onRaiseInvoice ? (
            <Button
              variant="outline"
              size="sm"
              className="text-sm h-8 px-3"
              onClick={onRaiseInvoice}
              disabled={isRaisingInvoice}
            >
              {isRaisingInvoice ? "Raising…" : "Raise Invoice to Xero"}
            </Button>
          ) : null}
        </div>

        {/* Product Selector */}
        {!isReadOnly && (
          <div className="flex gap-1.5">
            <Select
              value={selectedProductId}
              onValueChange={setSelectedProductId}
            >
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue placeholder="Select a product..." />
              </SelectTrigger>
              <SelectContent className="max-h-[280px] w-[280px]">
                {renderProductGroup(
                  "Packages",
                  <Package className="h-3 w-3" />,
                  groupedProducts.packages
                )}
                {groupedProducts.packages.length > 0 && groupedProducts.regularProducts.length > 0 && (
                  <SelectSeparator />
                )}
                {renderProductGroup(
                  "Products",
                  <Box className="h-3 w-3" />,
                  groupedProducts.regularProducts
                )}
                {(groupedProducts.packages.length > 0 || groupedProducts.regularProducts.length > 0) && groupedProducts.addons.length > 0 && (
                  <SelectSeparator />
                )}
                {renderProductGroup(
                  "Add-ons",
                  <PlusIcon className="h-3 w-3" />,
                  groupedProducts.addons
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={() => selectedProductId && handleAddProduct(selectedProductId)}
              disabled={!selectedProductId}
              size="sm"
              className="h-8 px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Add
            </Button>
          </div>
        )}

        {/* Line Items */}
        <div className="bg-gray-50 rounded-md overflow-hidden">
          {billingItems.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {billingItems.map((item) => (
                <div key={item.id} className="p-3 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {!isReadOnly && (
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-red-400 hover:text-red-600 mt-0.5 flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      <span className="text-sm font-medium text-gray-900 leading-snug" title={item.name}>
                        {item.name}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                      ${item.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 ml-6">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Qty</span>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          handleQuantityChange(item.id, parseInt(e.target.value) || 1)
                        }
                        className="h-7 w-14 text-sm text-center px-2"
                        disabled={isReadOnly}
                      />
                    </div>
                    <span className="text-gray-300">×</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">$</span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={editingPriceId === item.id ? priceInputValue : item.unitPrice.toFixed(2)}
                        onChange={(e) => handlePriceInputChange(item.id, e.target.value)}
                        onFocus={() => handlePriceInputFocus(item.id, item.unitPrice)}
                        onBlur={() => handlePriceInputBlur(item.id)}
                        className="h-7 w-20 text-sm text-right px-2"
                        disabled={isReadOnly}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-5 text-gray-400 text-sm">
              No items added yet
            </div>
          )}
        </div>

        {/* Totals */}
        {billingItems.length > 0 && (
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-700">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">GST</span>
              <span className="text-gray-700">${taxTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gray-200">
              <span className="text-gray-900">Total</span>
              <span className="text-gray-900">${total.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Payments */}
        {billingItems.length > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              No payments received
            </p>
          </div>
        )}
      </CardContent>
      )}
    </Card>
  );
}

export default BillingSection;
