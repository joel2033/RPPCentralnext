import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Briefcase, Users, Package, ShoppingCart, Grid3x3, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SearchResultsProps {
  query: string;
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  jobs: any[];
  customers: any[];
  products: any[];
  orders: any[];
}

export default function SearchResults({ query, isOpen, onClose }: SearchResultsProps) {
  const [selectedCategory, setSelectedCategory] = useState<"jobs" | "people" | "product" | "order">("jobs");
  const [, setLocation] = useLocation();
  const resultsRef = useRef<HTMLDivElement>(null);

  const { data: searchResults, isLoading, error } = useQuery<SearchResult>({
    queryKey: ["/api/search", query],
    queryFn: async () => {
      if (!query || query.trim().length === 0) {
        return { jobs: [], customers: [], products: [], orders: [] };
      }
      try {
        const response = await apiRequest(`/api/search?q=${encodeURIComponent(query)}`, "GET");
        return response.json();
      } catch (err) {
        console.error("Search error:", err);
        return { jobs: [], customers: [], products: [], orders: [] };
      }
    },
    enabled: isOpen && query.trim().length > 0,
  });

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const results = searchResults || { jobs: [], customers: [], products: [], orders: [] };
  const jobsCount = results.jobs.length;
  const customersCount = results.customers.length;
  const productsCount = results.products.length;
  const ordersCount = results.orders.length;

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "cancelled":
        return "text-red-600";
      case "booked":
        return "text-purple-600";
      case "delivered":
        return "text-green-600";
      case "pending":
        return "text-yellow-600";
      case "processing":
        return "text-blue-600";
      case "completed":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "cancelled":
        return "bg-red-100 text-red-700";
      case "booked":
        return "bg-purple-100 text-purple-700";
      case "delivered":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "processing":
        return "bg-blue-100 text-blue-700";
      case "completed":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const handleJobClick = (job: any) => {
    setLocation(`/jobs/${job.jobId || job.id}`);
    onClose();
  };

  const handleCustomerClick = (customer: any) => {
    setLocation(`/customers/${customer.id}`);
    onClose();
  };

  const handleProductClick = (product: any) => {
    setLocation(`/products/${product.id}`);
    onClose();
  };

  const handleOrderClick = (order: any) => {
    setLocation(`/orders`);
    onClose();
  };

  const getJobAddressForOrder = (order: any) => {
    if (order.jobAddress) return order.jobAddress;
    return `Order ${order.orderNumber}`;
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[99]" 
        onClick={onClose}
      />
      
      {/* Dropdown */}
      <div
        ref={resultsRef}
        className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 z-[100] max-h-[70vh] overflow-hidden flex flex-col"
        style={{ minWidth: "500px", width: "100%", maxWidth: "700px" }}
      >
        {/* Category Tabs */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory("jobs")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              selectedCategory === "jobs"
                ? "bg-rpp-orange text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Jobs
            <span className="ml-1 text-xs">{jobsCount}</span>
          </button>
          <button
            onClick={() => setSelectedCategory("people")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              selectedCategory === "people"
                ? "bg-rpp-orange text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Users className="w-4 h-4" />
            People
            <span className="ml-1 text-xs">{customersCount}</span>
          </button>
          <button
            onClick={() => setSelectedCategory("product")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              selectedCategory === "product"
                ? "bg-rpp-orange text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Package className="w-4 h-4" />
            Product
            <span className="ml-1 text-xs">{productsCount}</span>
          </button>
          <button
            onClick={() => setSelectedCategory("order")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              selectedCategory === "order"
                ? "bg-rpp-orange text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Order
            <span className="ml-1 text-xs">{ordersCount}</span>
          </button>
        </div>

        {/* Results Content */}
        <div className="flex-1 overflow-y-auto max-h-[400px]">
          {!query.trim() ? (
            <div className="p-8 text-center text-gray-500">
              Type to search...
            </div>
          ) : isLoading ? (
            <div className="p-8 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin mb-3" />
              <p className="text-sm text-gray-500">Searching...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-500">
              <p>Error searching. Please try again.</p>
            </div>
          ) : (
            <>
              {/* Jobs Section */}
              {selectedCategory === "jobs" && (
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Jobs</h3>
                  {jobsCount === 0 ? (
                    <p className="text-sm text-gray-500">
                      No jobs containing '{query}'
                    </p>
                  ) : (
                    <>
                      {results.jobs.slice(0, 5).map((job: any) => (
                        <div
                          key={job.id}
                          onClick={() => handleJobClick(job)}
                          className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <div className="mt-1">
                            <Grid3x3 className="w-5 h-5 text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {job.address}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                              <span>Created {formatDate(job.createdAt)}</span>
                              {job.status && (
                                <>
                                  <span>•</span>
                                  <span className={`${getStatusColor(job.status)}`}>
                                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {jobsCount > 5 && (
                        <button
                          onClick={() => {
                            setLocation(`/jobs?search=${encodeURIComponent(query)}`);
                            onClose();
                          }}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Show all {jobsCount} results
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* People Section */}
              {selectedCategory === "people" && (
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">People</h3>
                  {customersCount === 0 ? (
                    <p className="text-sm text-gray-500">
                      No people containing '{query}'
                    </p>
                  ) : (
                    <>
                      {results.customers.slice(0, 5).map((customer: any) => (
                        <div
                          key={customer.id}
                          onClick={() => handleCustomerClick(customer)}
                          className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <div className="mt-1">
                            <Users className="w-5 h-5 text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">
                              {customer.firstName} {customer.lastName}
                            </div>
                            {customer.email && (
                              <div className="text-xs text-gray-500 mt-1 truncate">
                                {customer.email}
                              </div>
                            )}
                            {customer.company && (
                              <div className="text-xs text-gray-500 mt-1 truncate">
                                {customer.company}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {customersCount > 5 && (
                        <button
                          onClick={() => {
                            setLocation(`/customers?search=${encodeURIComponent(query)}`);
                            onClose();
                          }}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Show all {customersCount} results
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Products Section */}
              {selectedCategory === "product" && (
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Products</h3>
                  {productsCount === 0 ? (
                    <p className="text-sm text-gray-500">
                      No product containing '{query}'
                    </p>
                  ) : (
                    <>
                      {results.products.slice(0, 5).map((product: any) => (
                        <div
                          key={product.id}
                          onClick={() => handleProductClick(product)}
                          className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <div className="mt-1">
                            <Package className="w-5 h-5 text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {product.title}
                            </div>
                            {product.description && (
                              <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                                {product.description}
                              </div>
                            )}
                            {product.price && (
                              <div className="text-xs text-gray-600 mt-1 font-medium">
                                ${parseFloat(product.price).toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {productsCount > 5 && (
                        <button
                          onClick={() => {
                            setLocation(`/products?search=${encodeURIComponent(query)}`);
                            onClose();
                          }}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Show all {productsCount} results
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Orders Section */}
              {selectedCategory === "order" && (
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Orders</h3>
                  {ordersCount === 0 ? (
                    <p className="text-sm text-gray-500">
                      No orders containing '{query}'
                    </p>
                  ) : (
                    <>
                      {results.orders.slice(0, 5).map((order: any) => {
                        const address = getJobAddressForOrder(order);
                        return (
                          <div
                            key={order.id}
                            onClick={() => handleOrderClick(order)}
                            className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <div className="mt-1">
                              <ShoppingCart className="w-5 h-5 text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {address}
                              </div>
                              {order.status && (
                                <div className="mt-2">
                                  <span
                                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(
                                      order.status
                                    )}`}
                                  >
                                    {order.status.charAt(0).toUpperCase() + order.status.slice(1).replace("_", " ")}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {ordersCount > 5 && (
                        <button
                          onClick={() => {
                            setLocation(`/orders?search=${encodeURIComponent(query)}`);
                            onClose();
                          }}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Show all {ordersCount} results
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
