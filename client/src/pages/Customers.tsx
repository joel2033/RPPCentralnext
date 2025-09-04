import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Mail, Phone, Search, Filter } from "lucide-react";
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
    const colors = ['bg-support-green', 'bg-rpp-red-main', 'bg-support-blue', 'bg-support-yellow'];
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
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-rpp-grey-border rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-rpp-grey-border rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-rpp-grey-dark">Customers</h2>
          <p className="text-rpp-grey-light">Manage your customer relationships and contact information</p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="bg-rpp-red-main hover:bg-rpp-red-dark text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Customer
        </Button>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-rpp-grey-light" />
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-80 border-rpp-grey-border"
            />
          </div>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48 border-rpp-grey-border">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
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
        
        <div className="text-sm text-rpp-grey-light">
          {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} found
        </div>
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map((customer: any) => (
          <Link key={customer.id} href={`/customers/${customer.id}`}>
            <Card className="border-rpp-grey-border hover:shadow-md transition-shadow cursor-pointer" data-testid={`customer-card-${customer.id}`}>
              <CardContent className="p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div className={`w-12 h-12 ${getAvatarColor(customer.firstName)} rounded-full flex items-center justify-center text-white font-medium`}>
                    {getInitials(customer.firstName, customer.lastName)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-rpp-grey-dark" data-testid={`text-customer-name-${customer.id}`}>
                      {customer.firstName} {customer.lastName}
                    </h3>
                    <p className="text-sm text-rpp-grey-light" data-testid={`text-customer-company-${customer.id}`}>
                      {customer.company || 'No company'}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-rpp-grey-light">
                    <Mail className="w-4 h-4 mr-2" />
                    <span className="truncate" data-testid={`text-customer-email-${customer.id}`}>
                      {customer.email}
                    </span>
                  </div>
                  {customer.phone && (
                    <div className="flex items-center text-sm text-rpp-grey-light">
                      <Phone className="w-4 h-4 mr-2" />
                      <span data-testid={`text-customer-phone-${customer.id}`}>
                        {customer.phone}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-lg font-semibold text-rpp-grey-dark" data-testid={`text-customer-total-value-${customer.id}`}>
                      ${customer.totalValue || '0.00'}
                    </p>
                    <p className="text-xs text-rpp-grey-light">Total Value</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-rpp-grey-dark" data-testid={`text-customer-avg-value-${customer.id}`}>
                      ${customer.averageJobValue || '0.00'}
                    </p>
                    <p className="text-xs text-rpp-grey-light">Average Job Value</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-rpp-grey-dark" data-testid={`text-customer-jobs-completed-${customer.id}`}>
                      {customer.jobsCompleted || 0}
                    </p>
                    <p className="text-xs text-rpp-grey-light">Jobs Completed</p>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full border-rpp-grey-border hover:bg-rpp-grey-surface"
                  data-testid={`button-view-profile-${customer.id}`}
                >
                  View Profile
                </Button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Empty States */}
      {customers.length === 0 && (
        <div className="col-span-full text-center py-12">
          <div className="text-rpp-grey-light">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-lg font-medium mb-2">No customers yet</h3>
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
          <div className="text-rpp-grey-light">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-lg font-medium mb-2">No customers found</h3>
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
