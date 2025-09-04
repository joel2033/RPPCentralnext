import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  X, 
  Clock, 
  Plus,
  Minus
} from "lucide-react";

interface EditAppointmentModalProps {
  appointment: any;
  onClose: () => void;
  onSave: () => void;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface Product {
  id: string;
  title: string;
  description: string;
  price: string;
  type: string;
}

export default function EditAppointmentModal({ appointment, onClose, onSave }: EditAppointmentModalProps) {
  const [assignedOperators, setAssignedOperators] = useState<string[]>(appointment.assignedTo ? [appointment.assignedTo] : []);
  const [timezone, setTimezone] = useState("utc+10");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState("120");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  useEffect(() => {
    // Set initial values from appointment
    if (appointment.appointmentDate) {
      const date = new Date(appointment.appointmentDate);
      setAppointmentDate(date.toISOString().split('T')[0]);
      setStartTime(date.toTimeString().split(' ')[0].substring(0, 5));
    }
    if (appointment.notes) {
      setNotes(appointment.notes);
    }
  }, [appointment]);

  const updateAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      const response = await fetch(`/api/jobs/${appointment.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(appointmentData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update appointment");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appointment updated successfully!",
      });
      onSave();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update appointment",
        variant: "destructive",
      });
    },
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = ['bg-support-green', 'bg-rpp-red-main', 'bg-support-blue', 'bg-support-yellow'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const appointmentDateTime = appointmentDate && startTime 
      ? `${appointmentDate}T${startTime}:00`
      : undefined;

    const appointmentData = {
      appointmentDate: appointmentDateTime,
      assignedTo: assignedOperators.length > 0 ? assignedOperators[0] : undefined,
      notes: notes.trim() || undefined,
    };

    updateAppointmentMutation.mutate(appointmentData);
  };

  const toggleOperator = (userId: string) => {
    setAssignedOperators(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [userId]; // Only allow one operator for simplicity
      }
    });
  };

  const removeOperator = (userId: string) => {
    setAssignedOperators(prev => prev.filter(id => id !== userId));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">Edit Appointment</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
              data-testid="button-close-edit"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription className="text-sm text-rpp-grey-light">
            Modify details of your existing appointment below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Assign Operators */}
          <div className="space-y-2">
            <Label>Assign operator(s)</Label>
            <Select onValueChange={toggleOperator}>
              <SelectTrigger data-testid="select-assign-operators">
                <SelectValue placeholder="Add yourself or other team members" />
              </SelectTrigger>
              <SelectContent>
                {users.filter(user => user.role !== 'partner').map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Selected Operators */}
            {assignedOperators.length > 0 && (
              <div className="space-y-2">
                {assignedOperators.map((userId) => {
                  const user = users.find(u => u.id === userId);
                  if (!user) return null;
                  
                  return (
                    <div key={userId} className="flex items-center justify-between p-2 bg-gray-50 rounded" data-testid={`assigned-operator-${userId}`}>
                      <div className="flex items-center space-x-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className={`${getAvatarColor(user.firstName)} text-white text-xs`}>
                            {getInitials(user.firstName, user.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{user.firstName} {user.lastName}</span>
                        <Badge variant="outline" className="text-xs">{user.role}</Badge>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOperator(userId)}
                        className="text-red-500 hover:text-red-700"
                        data-testid={`button-remove-operator-${userId}`}
                      >
                        Remove
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Timezone and Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger data-testid="select-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="utc+10">(UTC+10:00) Canberra...</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Select a day</Label>
              <Input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                data-testid="input-appointment-date"
              />
            </div>
          </div>

          {/* Time and Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Set a start time</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-rpp-grey-light" />
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="pl-10"
                  data-testid="input-start-time"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Add duration</Label>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-20"
                  data-testid="input-duration"
                />
                <span className="text-sm text-rpp-grey-light">Minutes</span>
              </div>
              <Button type="button" variant="link" className="h-auto p-0 text-xs">
                Manually set duration
              </Button>
            </div>
          </div>

          {/* Products */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Products</Label>
              <Button type="button" variant="outline" size="sm" data-testid="button-create-product">
                Create
              </Button>
            </div>
            
            {/* Mock selected product */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg" data-testid="selected-product-1">
                <div>
                  <div className="font-medium text-sm">1</div>
                  <div className="text-xs text-gray-500">Essentials</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700"
                  data-testid="button-remove-product-1"
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>

          {/* Write Appointment Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Write appointment notes</Label>
            <p className="text-xs text-rpp-grey-light">
              Notes may be visible to customers if they are included as attendees on Google or Outlook Calendar events
            </p>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes for this appointment..."
              rows={4}
              data-testid="textarea-appointment-notes"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateAppointmentMutation.isPending}
              className="bg-rpp-grey-dark hover:bg-rpp-grey-medium text-white"
              data-testid="button-save-appointment"
            >
              {updateAppointmentMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}