
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { X, CalendarIcon } from "lucide-react";

interface CreateEventModalProps {
  onClose: () => void;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export default function CreateEventModal({ onClose }: CreateEventModalProps) {
  const [eventTitle, setEventTitle] = useState("");
  const [eventType, setEventType] = useState("");
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("11:00");
  const [endTime, setEndTime] = useState("12:00");
  const [eventNotes, setEventNotes] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const days = [
    { value: "sun", label: "Sun" },
    { value: "mon", label: "Mon" },
    { value: "tue", label: "Tue" },
    { value: "wed", label: "Wed" },
    { value: "thu", label: "Thu" },
    { value: "fri", label: "Fri" },
    { value: "sat", label: "Sat" }
  ];

  const eventTypes = [
    { value: "unavailable", label: "Unavailable", color: "text-red-500" },
    { value: "lunch", label: "Lunch", color: "text-green-500" },
    { value: "meeting", label: "Meeting", color: "text-blue-500" },
    { value: "training", label: "Training", color: "text-yellow-500" },
    { value: "other", label: "Other", color: "text-gray-500" }
  ];

  const createEventMutation = useMutation({
    mutationFn: async (eventData: any) => {
      // For now, simulate event creation since /api/events doesn't exist yet
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ id: Date.now().toString(), ...eventData });
        }, 1000);
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Event created successfully!",
      });
      // queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create event",
        variant: "destructive",
      });
    },
  });

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!eventTitle.trim()) {
      toast({
        title: "Error",
        description: "Event title is required",
        variant: "destructive",
      });
      return;
    }

    const eventData = {
      title: eventTitle.trim(),
      type: eventType,
      teamMembers: selectedTeamMembers,
      startDate,
      endDate,
      startTime,
      endTime,
      notes: eventNotes.trim() || undefined,
      repeatDays: selectedDays,
    };

    createEventMutation.mutate(eventData);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Create Event</DialogTitle>
          <DialogDescription className="text-sm text-rpp-grey-light">
            Create an event to block time out of the calendar for other commitments.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Event Title */}
          <div className="space-y-2">
            <Label htmlFor="eventTitle">Event Title</Label>
            <Input
              id="eventTitle"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              placeholder="Give your event a title i.e Vacation"
              required
            />
            {!eventTitle.trim() && eventTitle !== "" && (
              <p className="text-sm text-rpp-red-main flex items-center">
                <span className="mr-1">⚠</span>
                Your event must have a title
              </p>
            )}
          </div>

          {/* Event Type */}
          <div className="space-y-3">
            <RadioGroup value={eventType} onValueChange={setEventType}>
              <div className="flex flex-wrap gap-4">
                {eventTypes.map((type) => (
                  <div key={type.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={type.value} id={type.value} />
                    <Label htmlFor={type.value} className={type.color}>
                      {type.label}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Team Members */}
          <div className="space-y-2">
            <Label>Team members</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Add team member" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select defaultValue="utc+10">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utc+10">(UTC+10:00) Canberra, Melbourne, Sydney</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start date</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-rpp-grey-light" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>End date</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-rpp-grey-light" />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Repeats */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Repeats</Label>
              <Button type="button" variant="link" className="h-auto p-0 text-xs">
                Select all
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {days.map((day) => (
                <Button
                  key={day.value}
                  type="button"
                  variant={selectedDays.includes(day.value) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleDay(day.value)}
                  className="rounded-full"
                >
                  {day.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Set Time */}
          <div className="space-y-2">
            <Label>Set Time</Label>
            <div className="text-sm text-rpp-grey-light mb-2">
              Thursday 4 September, 2025
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm">🕐</span>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0');
                      return (
                        <SelectItem key={`${hour}:00`} value={`${hour}:00`}>
                          {hour}:00
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm">🕐</span>
                <Select value={endTime} onValueChange={setEndTime}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0');
                      return (
                        <SelectItem key={`${hour}:00`} value={`${hour}:00`}>
                          {hour}:00
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Event Notes */}
          <div className="space-y-2">
            <Label htmlFor="eventNotes">Write event notes</Label>
            <p className="text-xs text-rpp-grey-light">
              Notes may be visible to customers if they are included as attendees on Google or Outlook Calendar events
            </p>
            <Textarea
              id="eventNotes"
              value={eventNotes}
              onChange={(e) => setEventNotes(e.target.value)}
              placeholder="Add notes for this event..."
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createEventMutation.isPending}
              className="bg-rpp-grey-dark hover:bg-rpp-grey-medium text-white"
            >
              {createEventMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
