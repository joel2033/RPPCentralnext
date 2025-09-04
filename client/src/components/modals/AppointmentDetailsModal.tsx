import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
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

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = ['bg-support-green', 'bg-rpp-red-main', 'bg-support-blue', 'bg-support-yellow'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const assignedUser = users.find(user => user.id === appointment.assignedTo);
  const isJob = appointment.type === 'job';

  const deleteAppointmentMutation = useMutation({
    mutationFn: async () => {
      // For jobs, we would call the jobs API
      if (isJob) {
        const response = await fetch(`/api/jobs/${appointment.id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          throw new Error("Failed to delete job");
        }
        return response.json();
      } else {
        // For events, simulate deletion
        return Promise.resolve();
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appointment deleted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
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
              
              {isJob && appointment.address && (
                <Link href={`/jobs/${appointment.jobId || appointment.id}`}>
                  <div className="flex items-center text-blue-600 hover:text-blue-800 cursor-pointer group" data-testid="link-job-address">
                    <MapPin className="w-4 h-4 mr-2" />
                    <span className="group-hover:underline">{appointment.address}</span>
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
                <div>
                  <div className="font-medium text-gray-900" data-testid="text-appointment-date">
                    Tue 2 Sep, 25
                  </div>
                  <div className="text-sm text-gray-500" data-testid="text-appointment-time">
                    {appointment.time || 'Time not specified'} (120 minutes)
                  </div>
                </div>
              </div>

              {/* Assigned User */}
              {assignedUser && (
                <div className="flex items-center space-x-3">
                  <User className="w-5 h-5 text-gray-400" />
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
                </div>
              )}

              {/* Status/Calendar */}
              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="font-medium text-gray-900">Calendar</div>
                  <div className="text-sm text-gray-500">
                    <span className="inline-flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      Delivered
                    </span>
                  </div>
                </div>
              </div>

              {/* Products */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">
                  10 products for this appointment
                </div>
              </div>
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