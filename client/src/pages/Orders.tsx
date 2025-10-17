import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, User } from "lucide-react";
import CreateOrderModal from "@/components/modals/CreateOrderModal";

export default function Orders() {
  const [activeTab, setActiveTab] = useState("pending");
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const { data: orders = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/orders"],
  });

  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: partnerships = [] } = useQuery<any[]>({
    queryKey: ["/api/partnerships"],
  });

  const filteredOrders = (orders || []).filter((order: any) => {
    return order.status === activeTab;
  });

  const getJobAddress = (jobId: string) => {
    const job = jobs.find((j: any) => j.jobId === jobId || j.id === jobId);
    return job?.address || 'No address available';
  };

  const getEditorStudioName = (assignedToId: string) => {
    if (!assignedToId) return 'Unassigned';
    const partnership = partnerships.find((p: any) => p.editorId === assignedToId);
    console.log('Looking for editor:', assignedToId, 'Found partnership:', partnership);
    return partnership?.editorStudioName || 'Unknown Editor';
  };

  const tabs = [
    { id: "pending", label: "Pending", count: (orders || []).filter((o: any) => o.status === "pending").length },
    { id: "processing", label: "Processing", count: (orders || []).filter((o: any) => o.status === "processing").length },
    { id: "in_revision", label: "In Revision", count: (orders || []).filter((o: any) => o.status === "in_revision").length },
    { id: "completed", label: "Completed", count: (orders || []).filter((o: any) => o.status === "completed").length },
    { id: "cancelled", label: "Cancelled", count: (orders || []).filter((o: any) => o.status === "cancelled").length },
  ];

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
          <h2 className="text-2xl font-bold text-rpp-grey-dark">Orders</h2>
          <p className="text-rpp-grey-light">Create, view and manage your post-production orders, right here.</p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="bg-rpp-red-main hover:bg-rpp-red-dark text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New order
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-1 mb-6 border-b border-rpp-grey-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 border-b-2 font-medium ${
              activeTab === tab.id
                ? 'border-rpp-red-main text-rpp-red-main'
                : 'border-transparent text-rpp-grey-light hover:text-rpp-grey-dark'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-rpp-grey-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-rpp-grey-surface border-b border-rpp-grey-border">
              <tr>
                <th className="text-left py-3 px-6 font-medium text-rpp-grey-dark">Order</th>
                <th className="text-left py-3 px-6 font-medium text-rpp-grey-dark">Date Accepted</th>
                <th className="text-left py-3 px-6 font-medium text-rpp-grey-dark">Address</th>
                <th className="text-left py-3 px-6 font-medium text-rpp-grey-dark">Assigned</th>
                <th className="text-left py-3 px-6 font-medium text-rpp-grey-dark">Created By</th>
                <th className="text-left py-3 px-6 font-medium text-rpp-grey-dark">Est. Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order: any) => (
                <tr key={order.id} className="border-b border-rpp-grey-border hover:bg-gray-50">
                  <td className="py-4 px-6 font-medium text-rpp-grey-dark">{order.orderNumber}</td>
                  <td className="py-4 px-6 text-sm">
                    {order.dateAccepted ? new Date(order.dateAccepted).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="py-4 px-6 text-sm">
                    {getJobAddress(order.jobId)}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-rpp-grey-light" />
                      <span className="text-sm">{getEditorStudioName(order.assignedTo)}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-support-green rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">J</span>
                      </div>
                      <span className="text-sm">Admin</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm font-medium">${order.estimatedTotal}</td>
                </tr>
              )) || (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="text-rpp-grey-light">
                      <div className="text-6xl mb-4">📋</div>
                      <h3 className="text-lg font-medium mb-2">No {activeTab} orders</h3>
                      <p className="text-sm">Orders with {activeTab} status will appear here</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <CreateOrderModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
