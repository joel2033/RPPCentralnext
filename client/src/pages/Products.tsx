import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, MoreHorizontal, Archive, Edit } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CreateProductModal from "@/components/modals/CreateProductModal";
import { apiRequest } from "@/lib/queryClient";
import { useMasterView } from "@/contexts/MasterViewContext";

export default function Products() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { isReadOnly } = useMasterView();

  const { data: products = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  // Debug logging to see product structure
  if (products.length > 0) {
    console.log('Sample product data:', products[0]);
  }

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return apiRequest(`/api/products/${id}`, "PATCH", updates);
    },
    onMutate: async ({ id, updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/products"] });
      
      // Snapshot the previous value
      const previousProducts = queryClient.getQueryData<any[]>(["/api/products"]);
      
      // Optimistically update the cache
      queryClient.setQueryData<any[]>(["/api/products"], (old) =>
        old?.map((product) =>
          product.id === id ? { ...product, ...updates } : product
        )
      );
      
      return { previousProducts };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousProducts) {
        queryClient.setQueryData(["/api/products"], context.previousProducts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
  });

  const archiveProductMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/products/${id}`, "PATCH", { isActive: false });
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["/api/products"] });
      const previousProducts = queryClient.getQueryData<any[]>(["/api/products"]);
      
      queryClient.setQueryData<any[]>(["/api/products"], (old) =>
        old?.map((product) =>
          product.id === id ? { ...product, isActive: false } : product
        )
      );
      
      return { previousProducts };
    },
    onError: (_err, _id, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(["/api/products"], context.previousProducts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
  });

  const toggleProductStatus = (id: string, field: 'isActive' | 'isLive', currentValue: boolean) => {
    updateProductMutation.mutate({
      id,
      updates: { [field]: !currentValue }
    });
  };

  const handleArchiveProduct = (id: string) => {
    if (confirm("Are you sure you want to archive this product?")) {
      archiveProductMutation.mutate(id);
    }
  };

  const handleEditProduct = (id: string) => {
    setLocation(`/products/${id}`);
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge className="bg-green-100 text-green-800">Active</Badge>
    ) : (
      <Badge variant="secondary">Inactive</Badge>
    );
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

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="max-w-2xl">
          <h2 className="text-xl md:text-2xl font-bold text-rpp-grey-dark">Manage Products</h2>
          <p className="text-sm text-rpp-grey-light hidden md:block">
            Add and manage your products, packages, and add-ons with customizable preferences.
          </p>
        </div>
        {!isReadOnly && (
          <Button
            onClick={() => setShowCreateModal(true)}
            className="hover:bg-rpp-red-dark text-white bg-[#f05a2a] whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-2" />
            New product
          </Button>
        )}
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm border border-rpp-grey-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-rpp-grey-surface border-b border-rpp-grey-border">
              <tr>
                <th className="text-left py-2.5 px-4 font-medium text-rpp-grey-dark text-xs">Product</th>
                <th className="text-left py-2.5 px-3 font-medium text-rpp-grey-dark text-xs">Type</th>
                <th className="text-left py-2.5 px-3 font-medium text-rpp-grey-dark text-xs">Category</th>
                <th className="text-left py-2.5 px-3 font-medium text-rpp-grey-dark text-xs">Price</th>
                <th className="text-left py-2.5 px-3 font-medium text-rpp-grey-dark text-xs">Variants</th>
                <th className="text-left py-2.5 px-3 font-medium text-rpp-grey-dark text-xs text-center">Live</th>
                <th className="text-left py-2.5 px-3 font-medium text-rpp-grey-dark text-xs">Status</th>
                <th className="text-left py-2.5 px-3 font-medium text-rpp-grey-dark text-xs w-10"></th>
              </tr>
            </thead>
            <tbody>
              {(products || []).map((product: any) => (
                <tr
                  key={product.id}
                  className="border-b border-rpp-grey-border hover:bg-gray-50"
                  data-testid={`row-product-${product.id}`}
                >
                  <td 
                    className="py-3 px-4 cursor-pointer"
                    onClick={() => setLocation(`/products/${product.id}`)}
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded flex items-center justify-center flex-shrink-0">
                        {product.image ? (
                          <img src={product.image} alt={product.title} className="w-full h-full object-cover rounded" />
                        ) : (
                          <span className="text-blue-600 text-xs">📷</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-rpp-grey-dark text-sm truncate">{product.title}</p>
                        <p className="text-xs text-rpp-grey-light truncate">{product.description || 'No description'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    {(() => {
                      const type = product.type?.toLowerCase() || 'product';
                      const typeLabels: Record<string, string> = {
                        'product': 'Product',
                        'package': 'Package',
                        'addon': 'Add-on'
                      };
                      const typeColors: Record<string, string> = {
                        'product': 'bg-blue-100 text-blue-800',
                        'package': 'bg-purple-100 text-purple-800',
                        'addon': 'bg-green-100 text-green-800'
                      };
                      const displayType = typeLabels[type] || 'Product';
                      const colorClass = typeColors[type] || 'bg-blue-100 text-blue-800';
                      
                      return (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
                          {displayType}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-3 px-3 text-sm">{product.category || '-'}</td>
                  <td className="py-3 px-3 text-sm font-medium">
                    {(() => {
                      if (product.hasVariations && product.variations) {
                        try {
                          // Parse variations if it's a JSON string
                          let variationsArray: any[] = [];
                          
                          if (typeof product.variations === 'string') {
                            variationsArray = JSON.parse(product.variations);
                          } else if (Array.isArray(product.variations)) {
                            variationsArray = product.variations;
                          } else if (typeof product.variations === 'object') {
                            variationsArray = Object.values(product.variations);
                          }

                          if (variationsArray.length > 0) {
                            const prices = variationsArray
                              .map((v: any) => parseFloat(v?.price || 0))
                              .filter((p: number) => !isNaN(p) && p > 0);

                            if (prices.length > 0) {
                              return `From $${Math.min(...prices).toFixed(2)}`;
                            }
                          }
                        } catch (error) {
                          console.error('Error processing variations:', error);
                        }
                      }

                      // Fallback to base price
                      const basePrice = parseFloat(product.price || 0);
                      return `$${basePrice.toFixed(2)}`;
                    })()}
                  </td>
                  <td className="py-3 px-3 text-xs text-rpp-grey-light">
                    {product.hasVariations ? `${product.variants} variations` : 'N/A'}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <Switch
                      checked={!!product.isLive}
                      onCheckedChange={() => toggleProductStatus(product.id, 'isLive', !!product.isLive)}
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="py-3 px-3">
                    {getStatusBadge(product.isActive)}
                  </td>
                  <td className="py-3 px-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-rpp-grey-light hover:text-rpp-grey-dark">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditProduct(product.id)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleArchiveProduct(product.id)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Archive className="w-4 h-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              )) || (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="text-rpp-grey-light">
                      <div className="text-6xl mb-4">📦</div>
                      <h3 className="text-lg font-medium mb-2">No products yet</h3>
                      <p className="text-sm">Create your first product to get started</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <CreateProductModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}