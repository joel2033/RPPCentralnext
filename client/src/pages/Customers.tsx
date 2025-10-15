import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Mail, Phone, Search, Building2, Filter } from "lucide-react";
import CreateCustomerModal from "@/components/modals/CreateCustomerModal";

export default function Customers() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  
  const { data: customers = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/customers"],
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-orange-500',
      'bg-blue-500', 
      'bg-amber-500',
      'bg-emerald-500',
      'bg-purple-500',
      'bg-pink-500'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const filteredCustomers = (customers || []).filter((customer: any) => {
    const matchesSearch = 
      customer.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.company?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || customer.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Customers</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage your customer relationships and contact information</p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="bg-rpp-red-main hover:bg-rpp-red-dark text-white rounded-full px-6"
          data-testid="button-new-customer"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Customer
        </Button>
      </div>
      {/* Search and Filter Bar */}
      <div className="flex items-center justify-between mb-6 bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl"
              data-testid="input-search-customers"
            />
          </div>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48 border-gray-200 dark:border-gray-700 rounded-xl" data-testid="select-category-filter">
              <div className="flex items-center">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="residential">Residential</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="real_estate">Real Estate Agent</SelectItem>
              <SelectItem value="property_manager">Property Manager</SelectItem>
              <SelectItem value="architect">Architect</SelectItem>
              <SelectItem value="interior_designer">Interior Designer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="text-sm text-gray-500 dark:text-gray-400 ml-4" data-testid="text-customers-count">
          {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} found
        </div>
      </div>
      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map((customer: any) => (
          <Card key={customer.id} className="border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200 bg-white dark:bg-gray-800 rounded-3xl" data-testid={`customer-card-${customer.id}`}>
            <CardContent className="p-6">
              {/* Customer Info */}
              <div className="flex items-start gap-4 mb-6">
                <div className={`w-14 h-14 ${getAvatarColor(customer.firstName)} rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0`}>
                  {getInitials(customer.firstName, customer.lastName)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-gray-900 dark:text-white font-medium text-[20px]" data-testid={`text-customer-name-${customer.id}`}>
                    {customer.firstName} {customer.lastName}
                  </h3>
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <Building2 className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                    <span className="truncate" data-testid={`text-customer-company-${customer.id}`}>
                      {customer.company || 'No company'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Contact Info */}
              <div className="space-y-2.5 mb-6">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Mail className="w-4 h-4 mr-2.5 flex-shrink-0 text-gray-400" />
                  <span className="truncate" data-testid={`text-customer-email-${customer.id}`}>
                    {customer.email}
                  </span>
                </div>
                {customer.phone && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Phone className="w-4 h-4 mr-2.5 flex-shrink-0 text-gray-400" />
                    <span data-testid={`text-customer-phone-${customer.id}`}>
                      {customer.phone}
                    </span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 pb-6 border-b border-gray-100 dark:border-gray-700 mb-6">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Value</p>
                  <p className="text-base text-gray-900 dark:text-white font-medium" data-testid={`text-customer-total-value-${customer.id}`}>
                    ${customer.totalValue || '0'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 mb-1 text-[14px]">Average Job Value</p>
                  <p className="text-base text-gray-900 dark:text-white font-medium" data-testid={`text-customer-avg-value-${customer.id}`}>
                    ${customer.averageJobValue || '0'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 mb-1 text-[14px]">Jobs Completed</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-white" data-testid={`text-customer-jobs-completed-${customer.id}`}>
                    {customer.jobsCompleted || 0}
                  </p>
                </div>
              </div>

              {/* View Profile Button */}
              <Link href={`/customers/${customer.id}`}>
                <Button 
                  variant="outline" 
                  className="w-full border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl"
                  data-testid={`button-view-profile-${customer.id}`}
                >
                  View Profile
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Empty States */}
      {customers.length === 0 && (
        <div className="col-span-full text-center py-12">
          <div className="text-gray-400 dark:text-gray-500">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">No customers yet</h3>
            <p className="text-sm">Add your first customer to get started</p>
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="mt-4 bg-rpp-red-main hover:bg-rpp-red-dark text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Customer
            </Button>
          </div>
        </div>
      )}
      {customers.length > 0 && filteredCustomers.length === 0 && (
        <div className="col-span-full text-center py-12">
          <div className="text-gray-400 dark:text-gray-500">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">No customers found</h3>
            <p className="text-sm">Try adjusting your search or filter criteria</p>
          </div>
        </div>
      )}
      {showCreateModal && (
        <CreateCustomerModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
