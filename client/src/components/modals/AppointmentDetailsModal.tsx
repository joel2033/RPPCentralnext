import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { auth } from "@/lib/firebase";
import { 
  X, 
  MapPin, 
  Clock, 
  User, 
  Calendar,
  Edit,
  Trash2,
  ExternalLink
} from "lucide-react";
import EditAppointmentModal from "./EditAppointmentModal";

interface AppointmentDetailsModalProps {
  appointment: any;
  onClose: () => void;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export default function AppointmentDetailsModal({ appointment, onClose }: AppointmentDetailsModalProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const assignedUser = users.find(user => user.id === appointment.assignedTo);
  const isJob = appointment.type === 'job' || appointment.jobId; // Support both old format and new appointments format

  // Fetch job data if this is an appointment with a jobId
  const jobId = appointment.jobId || (appointment.job?.jobId);
  const { data: job, isLoading: isLoadingJob } = useQuery<any>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      if (!jobId) return null;
      try {
        // First try to get by jobId (NanoID)
        const response = await fetch(`/api/jobs?jobId=${jobId}`, {
          credentials: 'include',
        });
        if (response.ok) {
          const jobs = await response.json();
          return jobs.find((j: any) => j.jobId === jobId) || null;
        }
        return null;
      } catch (error) {
        console.error('[AppointmentDetailsModal] Error fetching job:', error);
        return null;
      }
    },
  });

  // Fetch full appointment data using the internal ID (UUID, not appointmentId NanoID)
  // The appointment prop should have the internal id from the appointments table
  const appointmentInternalId = appointment.id; // Internal UUID from appointments table
  const { data: fullAppointment, isLoading: isLoadingFullAppointment } = useQuery<any>({
    queryKey: ["/api/appointments", appointmentInternalId],
    enabled: !!appointmentInternalId && !!appointment.appointmentId, // Only fetch if we have both IDs
    queryFn: async () => {
      if (!appointmentInternalId) {
        console.log('[AppointmentDetailsModal] No appointment internal ID available');
        return null;
      }
      try {
        const { auth } = await import("@/lib/firebase");
        const token = await auth.currentUser?.getIdToken();
        console.log('[AppointmentDetailsModal] Fetching appointment with internal ID:', appointmentInternalId);
        const response = await fetch(`/api/appointments/${appointmentInternalId}`, {
          headers: token ? {
            'Authorization': `Bearer ${token}`,
          } : {},
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          console.log('[AppointmentDetailsModal] Fetched full appointment data:', data);
          return data;
        } else {
          console.error('[AppointmentDetailsModal] Failed to fetch appointment:', response.status, response.statusText);
          return null;
        }
      } catch (error) {
        console.error('[AppointmentDetailsModal] Error fetching appointment:', error);
        return null;
      }
    },
  });

  // Get products from appointment.products field (JSON string)
  // Use fullAppointment if available, otherwise fall back to appointment prop
  const bookingProducts = (() => {
    const appointmentData = fullAppointment || appointment;
    console.log('[AppointmentDetailsModal] Getting products from appointment:', {
      hasFullAppointment: !!fullAppointment,
      appointmentId: appointment.appointmentId,
      appointmentInternalId: appointment.id,
      hasProducts: !!appointmentData.products,
      productsType: typeof appointmentData.products,
      productsValue: appointmentData.products ? (typeof appointmentData.products === 'string' ? appointmentData.products.substring(0, 200) : JSON.stringify(appointmentData.products).substring(0, 200)) : 'null/undefined',
      fullAppointmentKeys: fullAppointment ? Object.keys(fullAppointment) : [],
      appointmentPropKeys: Object.keys(appointment)
    });
    
    if (!appointmentData.products) {
      console.log('[AppointmentDetailsModal] No products field in appointment data');
      return [];
    }
    
    try {
      const products = typeof appointmentData.products === 'string' 
        ? JSON.parse(appointmentData.products) 
        : appointmentData.products;
      
      console.log('[AppointmentDetailsModal] Parsed products:', products);
      
      if (Array.isArray(products) && products.length > 0) {
        console.log('[AppointmentDetailsModal] Returning products:', products.length, 'items');
        return products;
      } else {
        console.log('[AppointmentDetailsModal] Products is not a valid array or is empty');
      }
    } catch (error) {
      console.error('[AppointmentDetailsModal] Error parsing appointment products:', error, appointmentData.products);
    }
    
    return [];
  })();

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = ['bg-support-green', 'bg-rpp-red-main', 'bg-support-blue', 'bg-support-yellow'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const deleteAppointmentMutation = useMutation({
    mutationFn: async () => {
      // If this is an appointment (has appointmentId or id from appointments table), delete it
      if (appointment.appointmentId || appointment.id) {
        const appointmentId = appointment.appointmentId || appointment.id;
        const response = await fetch(`/api/appointments/${appointmentId}`, {
          method: "DELETE",
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error("Failed to delete appointment");
        }
        return response.json();
      } else {
        // Fallback: For old format jobs, delete the job
        const response = await fetch(`/api/jobs/${appointment.id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          throw new Error("Failed to delete job");
        }
        return response.json();
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appointment deleted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete appointment",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this appointment?")) {
      deleteAppointmentMutation.mutate();
    }
  };

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Appointment Details</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Appointment Title and Address */}
            <div>
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-medium text-gray-900" data-testid="text-appointment-title">
                  {appointment.title || appointment.address}
                </h3>
                <Badge 
                  variant="outline" 
                  className={`${
                    isJob ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                  }`}
                  data-testid="badge-appointment-type"
                >
                  {isJob ? 'Job' : 'Event'}
                </Badge>
              </div>
              
              {isJob && (appointment.address || job?.address) && (
                <Link href={`/jobs/${appointment.jobId || job?.jobId || appointment.id}`}>
                  <div className="flex items-center text-blue-600 hover:text-blue-800 cursor-pointer group" data-testid="link-job-address">
                    <MapPin className="w-4 h-4 mr-2" />
                    <span className="group-hover:underline">{appointment.address || job?.address}</span>
                    <ExternalLink className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              )}
            </div>

            <Separator />

            {/* Appointment Details */}
            <div className="space-y-4">
              {/* Date and Time */}
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                {isLoadingFullAppointment ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ) : (
                  <div>
                    <div className="font-medium text-gray-900" data-testid="text-appointment-date">
                      {appointment.appointmentDate 
                        ? new Date(appointment.appointmentDate).toLocaleDateString('en-AU', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: '2-digit'
                          })
                        : 'Date not set'}
                    </div>
                    <div className="text-sm text-gray-500" data-testid="text-appointment-time">
                      {appointment.appointmentDate 
                        ? new Date(appointment.appointmentDate).toLocaleTimeString('en-AU', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })
                        : appointment.time || 'Time not specified'}
                    </div>
                  </div>
                )}
              </div>

              {/* Assigned User */}
              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-gray-400" />
                {isLoadingUsers ? (
                  <div className="flex items-center space-x-2">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                ) : assignedUser ? (
                  <div className="flex items-center space-x-2">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className={`${getAvatarColor(assignedUser.firstName)} text-white text-xs`}>
                        {getInitials(assignedUser.firstName, assignedUser.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-gray-900" data-testid="text-assigned-user">
                      {assignedUser.firstName} {assignedUser.lastName}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {assignedUser.role}
                    </Badge>
                  </div>
                ) : (
                  <span className="text-gray-500 italic" data-testid="text-no-assigned-user">
                    No photographer assigned
                  </span>
                )}
              </div>

              {/* Status */}
              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="font-medium text-gray-900">Status</div>
                  <div className="text-sm text-gray-500">
                    <span className="inline-flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        appointment.status === 'delivered' ? 'bg-green-500' :
                        appointment.status === 'booked' ? 'bg-blue-500' :
                        appointment.status === 'scheduled' ? 'bg-blue-500' :
                        appointment.status === 'in_progress' ? 'bg-yellow-500' :
                        appointment.status === 'completed' ? 'bg-green-500' :
                        appointment.status === 'cancelled' ? 'bg-red-500' :
                        'bg-gray-500'
                      }`}></div>
                      {appointment.status 
                        ? appointment.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                        : job?.status 
                        ? job.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                        : 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Value */}
              {(appointment.totalValue || job?.totalValue) && parseFloat(appointment.totalValue || job?.totalValue || '0') > 0 && (
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 flex items-center justify-center text-gray-400 font-bold">$</div>
                  <div>
                    <div className="font-medium text-gray-900">Total Value</div>
                    <div className="text-sm text-gray-500">
                      ${parseFloat(appointment.totalValue || job?.totalValue || '0').toFixed(2)}
                    </div>
                  </div>
                </div>
              )}

              {/* Products */}
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 flex items-center justify-center text-gray-400 mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 mb-2">Products</div>
                  {bookingProducts.length > 0 ? (
                    <div className="space-y-1">
                      {bookingProducts.map((product: any, index: number) => (
                        <div key={index} className="text-sm text-gray-600">
                          {product.name || product.title || product.id} 
                          {product.quantity && product.quantity > 1 && ` (x${product.quantity})`}
                          {product.variationName && ` - ${product.variationName}`}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No products found</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              {appointment.notes && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-700 mb-1">Notes</div>
                  <div className="text-sm text-gray-600">{appointment.notes}</div>
                </div>
              )}
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="flex justify-between">
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowEditModal(true)}
                  className="flex items-center"
                  data-testid="button-edit-appointment"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit appointment
                </Button>
              </div>
              
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                disabled={deleteAppointmentMutation.isPending}
                data-testid="button-cancel-appointment"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {deleteAppointmentMutation.isPending ? "Deleting..." : "Cancel appointment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Appointment Modal */}
      {showEditModal && (
        <EditAppointmentModal
          appointment={appointment}
          onClose={() => setShowEditModal(false)}
          onSave={() => {
            setShowEditModal(false);
            onClose();
            queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
          }}
        />
      )}
    </>
  );
}