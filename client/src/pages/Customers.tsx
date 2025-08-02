import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone } from "lucide-react";
import CreateCustomerModal from "@/components/modals/CreateCustomerModal";

export default function Customers() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const { data: customers = [], isLoading } = useQuery({
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
      <div className="flex items-center justify-between mb-8">
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

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers?.map((customer: any) => (
          <Card key={customer.id} className="border-rpp-grey-border">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className={`w-12 h-12 ${getAvatarColor(customer.firstName)} rounded-full flex items-center justify-center text-white font-medium`}>
                  {getInitials(customer.firstName, customer.lastName)}
                </div>
                <div>
                  <h3 className="font-semibold text-rpp-grey-dark">
                    {customer.firstName} {customer.lastName}
                  </h3>
                  <p className="text-sm text-rpp-grey-light">{customer.company || 'No company'}</p>
                </div>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-rpp-grey-light">
                  <Mail className="w-4 h-4 mr-2" />
                  <span className="truncate">{customer.email}</span>
                </div>
                {customer.phone && (
                  <div className="flex items-center text-sm text-rpp-grey-light">
                    <Phone className="w-4 h-4 mr-2" />
                    <span>{customer.phone}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-lg font-semibold text-rpp-grey-dark">
                    ${customer.totalValue || '0.00'}
                  </p>
                  <p className="text-xs text-rpp-grey-light">Total Value</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-rpp-grey-dark">
                    ${customer.averageJobValue || '0.00'}
                  </p>
                  <p className="text-xs text-rpp-grey-light">Average Job Value</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-rpp-grey-dark">
                    {customer.jobsCompleted || 0}
                  </p>
                  <p className="text-xs text-rpp-grey-light">Jobs Completed</p>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full border-rpp-grey-border hover:bg-rpp-grey-surface"
              >
                View Profile
              </Button>
            </CardContent>
          </Card>
        )) || (
          <div className="col-span-full text-center py-12">
            <div className="text-rpp-grey-light">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-lg font-medium mb-2">No customers yet</h3>
              <p className="text-sm">Add your first customer to get started</p>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateCustomerModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
