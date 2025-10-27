import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, MoreHorizontal } from "lucide-react";
import CreateProductModal from "@/components/modals/CreateProductModal";
import { apiRequest } from "@/lib/queryClient";

export default function Products() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: products = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return apiRequest("PATCH", `/api/products/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
  });

  const toggleProductStatus = (id: string, field: 'isActive' | 'isLive', currentValue: boolean) => {
    updateProductMutation.mutate({
      id,
      updates: { [field]: !currentValue }
    });
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-rpp-grey-dark">Manage Products</h2>
          <p className="text-rpp-grey-light">
            Easily add and manage your products, packages, and add-ons, and seamlessly integrate them anywhere in your business with a range of customisable preferences.
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="hover:bg-rpp-red-dark text-white bg-[#f05a2a]"
        >
          <Plus className="w-4 h-4 mr-2" />
          New product
        </Button>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm border border-rpp-grey-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-rpp-grey-surface border-b border-rpp-grey-border">
              <tr>
                <th className="text-left py-3 px-6 font-medium text-rpp-grey-dark">Product Description</th>
                <th className="text-left py-3 px-6 font-medium text-rpp-grey-dark">Type</th>
                <th className="text-left py-3 px-6 font-medium text-rpp-grey-dark">Category(s)</th>
                <th className="text-left py-3 px-6 font-medium text-rpp-grey-dark">Price</th>
                <th className="text-left py-3 px-6 font-medium text-rpp-grey-dark">Variants</th>
                <th className="text-left py-3 px-6 font-medium text-rpp-grey-dark">Showing (live)</th>
                <th className="text-left py-3 px-6 font-medium text-rpp-grey-dark">Status</th>
                <th className="text-left py-3 px-6 font-medium text-rpp-grey-dark"></th>
              </tr>
            </thead>
            <tbody>
              {(products || []).map((product: any) => (
                <tr 
                  key={product.id} 
                  className="border-b border-rpp-grey-border hover:bg-gray-50 cursor-pointer"
                  onClick={() => setLocation(`/products/${product.id}`)}
                  data-testid={`row-product-${product.id}`}
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded flex items-center justify-center">
                        {product.image ? (
                          <img src={product.image} alt={product.title} className="w-full h-full object-cover rounded" />
                        ) : (
                          <span className="text-blue-600 text-xs">📷</span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-rpp-grey-dark">{product.title}</p>
                        <p className="text-sm text-rpp-grey-light">{product.description || 'No description'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Product
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm">{product.category || '-'}</td>
                  <td className="py-4 px-6 text-sm">
                    {product.hasVariations && product.variations?.length > 0
                      ? `From $${Math.min(...product.variations.map((v: any) => parseFloat(v.price) || 0)).toFixed(2)}`
                      : `$${parseFloat(product.price || 0).toFixed(2)}`}
                  </td>
                  <td className="py-4 px-6 text-sm">
                    {product.hasVariations ? `${product.variants} variations` : 'N/A'}
                  </td>
                  <td className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={product.isLive}
                      onCheckedChange={() => toggleProductStatus(product.id, 'isLive', product.isLive)}
                    />
                  </td>
                  <td className="py-4 px-6">
                    {getStatusBadge(product.isActive)}
                  </td>
                  <td className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
                    <button className="text-rpp-grey-light hover:text-rpp-grey-dark">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
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
