import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, MapPin, Package, AlertCircle, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PendingOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  address: string;
  serviceCount: number;
  estimatedTotal: string;
  createdAt: string;
  filesExpiryDate: string;
  services: Array<{
    id: string;
    serviceId: string;
    quantity: number;
    instructions: string;
  }>;
}

interface TeamEditor {
  id: string;
  email: string;
  studioName: string;
  name: string;
  isActive: boolean;
}

export default function TeamAssignments() {
  const [selectedOrders, setSelectedOrders] = useState<Record<string, string>>({});
  const [isAssigning, setIsAssigning] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: pendingOrders = [], isLoading: isLoadingOrders } = useQuery<PendingOrder[]>({
    queryKey: ['/api/team/pending-orders'],
    retry: false
  });

  const { data: teamEditors = [], isLoading: isLoadingEditors } = useQuery<TeamEditor[]>({
    queryKey: ['/api/team/editors'],
    retry: false
  });

  const assignOrderMutation = useMutation({
    mutationFn: async ({ orderId, editorId }: { orderId: string; editorId: string }) => {
      return apiRequest('/api/team/assign-order', 'POST', { orderId, editorId });
    },
    onSuccess: (data: { message: string; order: { id: string } }) => {
      toast({
        title: "Order Assigned",
        description: data.message,
      });
      // Clear the selection for this order
      setSelectedOrders(prev => {
        const updated = { ...prev };
        delete updated[data.order.id];
        return updated;
      });
      // Refresh both pending orders and editor jobs
      queryClient.invalidateQueries({ queryKey: ['/api/team/pending-orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs-ready-for-upload'] });
      queryClient.invalidateQueries({ queryKey: ['/api/editor/jobs'] });
    },
    onError: (error: any) => {
      let title = "Assignment Failed";
      let description = "Failed to assign order";
      
      // Handle specific HTTP status codes with targeted messages
      if (error.status === 403) {
        if (error.message?.includes("Editor not in your team")) {
          title = "Unauthorized Editor";
          description = "The selected editor is not an active member of your team. Please select a valid team editor.";
        } else if (error.message?.includes("Order does not belong")) {
          title = "Access Denied";
          description = "This order does not belong to your organization.";
        } else {
          title = "Permission Denied";
          description = error.message || "You don't have permission to perform this action.";
        }
      } else if (error.status === 409) {
        title = "Order Already Assigned";
        description = "This order has already been assigned to another editor or is no longer available.";
      } else if (error.status === 404) {
        title = "Order Not Found";
        description = "The order you're trying to assign could not be found.";
      } else {
        // Fallback for other errors
        description = error.message || description;
      }
      
      toast({
        title,
        description,
        variant: "destructive"
      });
    },
    onSettled: (data, error, variables) => {
      setIsAssigning(prev => ({ ...prev, [variables.orderId]: false }));
    }
  });

  const handleAssignOrder = async (orderId: string) => {
    const editorId = selectedOrders[orderId];
    if (!editorId) {
      toast({
        title: "No Editor Selected",
        description: "Please select an editor before assigning",
        variant: "destructive"
      });
      return;
    }

    setIsAssigning(prev => ({ ...prev, [orderId]: true }));
    assignOrderMutation.mutate({ orderId, editorId });
  };

  const getEditorDisplayName = (editorId: string) => {
    const editor = teamEditors.find(e => e.id === editorId);
    return editor ? editor.studioName : 'Unknown Editor';
  };

  if (isLoadingOrders || isLoadingEditors) {
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
          <h2 className="text-2xl font-bold text-rpp-grey-dark">Team Assignments</h2>
          <p className="text-rpp-grey-light">Assign pending orders to your team editors for processing.</p>
        </div>
        <div className="flex items-center space-x-4">
          <Badge variant="outline" className="text-rpp-grey-dark">
            <Users className="w-4 h-4 mr-1" />
            {teamEditors.length} Team Editors
          </Badge>
          <Badge variant="outline" className="text-rpp-grey-dark">
            <Package className="w-4 h-4 mr-1" />
            {pendingOrders.length} Pending Orders
          </Badge>
        </div>
      </div>

      {teamEditors.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-rpp-grey-light">
              <Users className="w-16 h-16 mx-auto mb-4 text-rpp-grey-border" />
              <h3 className="text-lg font-medium mb-2">No Team Editors</h3>
              <p className="text-sm mb-4">You need to have partnered editors before you can assign orders.</p>
              <Button variant="outline" className="border-rpp-grey-border">
                Invite Editors
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : pendingOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-rpp-grey-light">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-support-green" />
              <h3 className="text-lg font-medium mb-2">All Orders Assigned</h3>
              <p className="text-sm">Great work! All pending orders have been assigned to team editors.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-rpp-grey-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-rpp-grey-surface border-b border-rpp-grey-border">
                <tr>
                  <th className="text-left py-3 px-6 font-medium text-rpp-grey-dark">Order Details</th>
                  <th className="text-left py-3 px-6 font-medium text-rpp-grey-dark">Customer</th>
                  <th className="text-left py-3 px-6 font-medium text-rpp-grey-dark">Services</th>
                  <th className="text-left py-3 px-6 font-medium text-rpp-grey-dark">Due Date</th>
                  <th className="text-left py-3 px-6 font-medium text-rpp-grey-dark">Assign Editor</th>
                  <th className="text-left py-3 px-6 font-medium text-rpp-grey-dark">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map((order) => (
                  <tr key={order.id} className="border-b border-rpp-grey-border hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <div>
                        <div className="font-medium text-rpp-grey-dark" data-testid={`text-order-${order.orderNumber}`}>
                          {order.orderNumber}
                        </div>
                        <div className="flex items-center text-sm text-rpp-grey-light mt-1">
                          <MapPin className="w-3 h-3 mr-1" />
                          {order.address}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        <div className="font-medium text-rpp-grey-dark" data-testid={`text-customer-${order.id}`}>
                          {order.customerName}
                        </div>
                        <div className="text-sm text-rpp-grey-light">{order.customerEmail}</div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        <Package className="w-4 h-4 mr-2 text-rpp-grey-light" />
                        <span className="text-sm" data-testid={`text-services-${order.id}`}>
                          {order.serviceCount} service{order.serviceCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-rpp-grey-light" />
                        <span className="text-sm">
                          {order.filesExpiryDate ? new Date(order.filesExpiryDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <Select
                        value={selectedOrders[order.id] || ""}
                        onValueChange={(value) => 
                          setSelectedOrders(prev => ({ ...prev, [order.id]: value }))
                        }
                        disabled={isAssigning[order.id]}
                      >
                        <SelectTrigger 
                          className="w-full border-rpp-grey-border"
                          data-testid={`select-editor-${order.id}`}
                        >
                          <SelectValue placeholder="Select editor..." />
                        </SelectTrigger>
                        <SelectContent>
                          {teamEditors.filter(editor => editor.isActive).map((editor) => (
                            <SelectItem key={editor.id} value={editor.id}>
                              <div className="flex items-center">
                                <div className="w-6 h-6 bg-rpp-red-main rounded-full flex items-center justify-center mr-2">
                                  <span className="text-white text-xs">
                                    {editor.studioName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <div className="font-medium">{editor.studioName}</div>
                                  <div className="text-xs text-rpp-grey-light">{editor.email}</div>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-4 px-6">
                      <Button
                        onClick={() => handleAssignOrder(order.id)}
                        disabled={!selectedOrders[order.id] || isAssigning[order.id]}
                        className="bg-rpp-red-main hover:bg-rpp-red-dark text-white disabled:bg-rpp-grey-border disabled:text-rpp-grey-light"
                        data-testid={`button-assign-${order.id}`}
                      >
                        {isAssigning[order.id] ? (
                          <div className="flex items-center">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Assigning...
                          </div>
                        ) : (
                          'Assign'
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pendingOrders.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">Assignment Instructions</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Orders will automatically change status from "pending" to "processing" when assigned</li>
                <li>• Assigned editors will see orders immediately in their dashboard</li>
                <li>• Only active team editors can be assigned orders</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}