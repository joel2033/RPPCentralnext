import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  Plus,
  MoreHorizontal,
  Clock,
  MapPin
} from "lucide-react";
import CreateJobModal from "@/components/modals/CreateJobModal";
import CreateEventModal from "@/components/modals/CreateEventModal";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface EventType {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  checked: boolean;
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreateJobModal, setShowCreateJobModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([
    { id: 'job', label: 'Job', color: 'text-blue-600', bgColor: 'bg-blue-100', checked: true },
    { id: 'unavailable', label: 'Unavailable', color: 'text-red-600', bgColor: 'bg-red-100', checked: true },
    { id: 'lunch', label: 'Lunch', color: 'text-green-600', bgColor: 'bg-green-100', checked: true },
    { id: 'meeting', label: 'Meeting', color: 'text-purple-600', bgColor: 'bg-purple-100', checked: true },
    { id: 'training', label: 'Training', color: 'text-yellow-600', bgColor: 'bg-yellow-100', checked: true },
    { id: 'other', label: 'Other', color: 'text-gray-600', bgColor: 'bg-gray-100', checked: true },
    { id: 'external', label: 'External Google', color: 'text-indigo-600', bgColor: 'bg-indigo-100', checked: true }
  ]);
  
  const { data: jobs = [] } = useQuery({
    queryKey: ["/api/jobs"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + (direction === 'next' ? 1 : -1),
      1
    ));
  };

  const getJobsForDate = (day: number) => {
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return jobs.filter((job: any) => {
      const jobDate = new Date(job.appointmentDate || job.createdAt);
      return jobDate.toDateString() === targetDate.toDateString();
    });
  };

  const getEventsForDate = (day: number) => {
    // Mock events for demonstration - in real app this would come from API
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const mockEvents = [
      { id: 'e1', title: 'EXTERNAL GOOGLE Ellie 5 Edna', type: 'external', time: '08:00-09:00', date: new Date(2025, 8, 5) },
      { id: 'e2', title: 'EXTERNAL GOOGLE Reilly 101 Reid', type: 'external', time: '09:00-10:00', date: new Date(2025, 8, 5) },
      { id: 'e3', title: 'EXTERNAL GOOGLE Ellie and another', type: 'external', time: '06:00-08:00', date: new Date(2025, 8, 12) },
      { id: 'e4', title: 'EXTERNAL GOOGLE 105 Elam Place', type: 'external', time: '06:00-08:00', date: new Date(2025, 8, 19) },
      { id: 'e5', title: 'EXTERNAL GOOGLE Glenview', type: 'external', time: '10:00-12:00', date: new Date(2025, 8, 26) },
    ];
    
    return mockEvents.filter(event => 
      event.date.toDateString() === targetDate.toDateString()
    );
  };

  const toggleEventType = (eventTypeId: string) => {
    setEventTypes(prev => 
      prev.map(type => 
        type.id === eventTypeId ? { ...type, checked: !type.checked } : type
      )
    );
  };

  const toggleTeamMember = (userId: string) => {
    setSelectedTeamMembers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = ['bg-support-green', 'bg-rpp-red-main', 'bg-support-blue', 'bg-support-yellow'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOfMonth = getFirstDayOfMonth(currentDate);
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  const days = [];
  
  // Empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className="p-2 min-h-[120px] border-r border-b border-rpp-grey-border bg-gray-50"></div>);
  }
  
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dayJobs = getJobsForDate(day);
    const dayEvents = getEventsForDate(day);
    const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
    const allEvents = [...dayJobs.map((job: any) => ({ ...job, type: 'job', title: job.address, time: job.appointmentDate ? new Date(job.appointmentDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '' })), ...dayEvents];
    
    days.push(
      <div
        key={day}
        className={`p-2 min-h-[120px] border-r border-b border-rpp-grey-border bg-white hover:bg-gray-50 ${
          isToday ? 'bg-blue-50' : ''
        }`}
        data-testid={`calendar-day-${day}`}
      >
        <div className={`text-sm font-medium mb-2 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
          {day}
        </div>
        <div className="space-y-1">
          {allEvents.slice(0, 3).map((event: any, index: number) => {
            const eventType = eventTypes.find(type => type.id === event.type);
            if (!eventType?.checked) return null;
            
            return (
              <div
                key={event.id || `event-${index}`}
                className={`text-xs p-1 rounded text-left ${eventType?.bgColor || 'bg-gray-100'} ${eventType?.color || 'text-gray-700'}`}
                title={event.title || event.address}
                data-testid={`event-${event.id || index}`}
              >
                <div className="font-medium truncate">
                  {event.time && <span className="mr-1">{event.time}</span>}
                  {(event.title || event.address)?.substring(0, 20)}
                  {(event.title || event.address)?.length > 20 && '...'}
                </div>
              </div>
            );
          })}
          {allEvents.length > 3 && (
            <div className="text-xs text-gray-500 pl-1">
              +{allEvents.length - 3} more
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            <Button variant="outline" size="sm" className="text-xs" data-testid="today-button">
              Today
            </Button>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" data-testid="create-button">
                <Plus className="w-4 h-4 mr-2" />
                Create
                <ChevronDown className="w-4 h-4 ml-auto" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => setShowCreateJobModal(true)}>
                New Job
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowCreateEventModal(true)}>
                Add Event
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Tomorrow Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Tomorrow</h3>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
          <div className="text-xs text-gray-500 mb-2">
            (UTC+10:00) Canberra, Melbourne, Sydney
          </div>
          <div className="text-xs text-blue-600 mb-2">All day EXTERNAL GOOGLE Ella</div>
        </div>

        <Separator className="my-4" />

        {/* Team Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">Team</h3>
            <Button variant="link" size="sm" className="text-xs text-blue-600 h-auto p-0">
              Clear
            </Button>
          </div>
          <div className="space-y-2">
            {users.map((user) => (
              <div key={user.id} className="flex items-center space-x-3" data-testid={`team-member-${user.id}`}>
                <Checkbox
                  checked={selectedTeamMembers.includes(user.id)}
                  onCheckedChange={() => toggleTeamMember(user.id)}
                />
                <Avatar className="w-6 h-6">
                  <AvatarFallback className={`${getAvatarColor(user.firstName)} text-white text-xs`}>
                    {getInitials(user.firstName, user.lastName)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-gray-700">
                  {user.firstName} {user.lastName}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Separator className="my-4" />

        {/* Event Type Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">Event Type</h3>
            <Button variant="link" size="sm" className="text-xs text-blue-600 h-auto p-0">
              Clear
            </Button>
          </div>
          <div className="space-y-2">
            {eventTypes.map((eventType) => (
              <div key={eventType.id} className="flex items-center space-x-2" data-testid={`event-type-${eventType.id}`}>
                <Checkbox
                  checked={eventType.checked}
                  onCheckedChange={() => toggleEventType(eventType.id)}
                />
                <div className={`w-3 h-3 rounded ${eventType.bgColor}`}></div>
                <span className={`text-sm ${eventType.color}`}>
                  {eventType.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Calendar Area */}
      <div className="flex-1 p-6 overflow-hidden">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" data-testid="month-nav-prev" onClick={() => navigateMonth('prev')}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-semibold text-gray-700 min-w-[200px] text-center">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              <Button variant="outline" size="sm" data-testid="month-nav-next" onClick={() => navigateMonth('next')}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>70 Appointments</span>
            </div>
            <div className="flex items-center space-x-1">
              <CalendarIcon className="w-4 h-4" />
              <span>Google Calendar</span>
            </div>
            <Button variant="ghost" size="sm" className="h-auto p-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7">
            {/* Day headers */}
            {dayNames.map((dayName) => (
              <div
                key={dayName}
                className="p-4 bg-gray-50 text-center text-sm font-medium text-gray-600 border-r border-b border-gray-200 last:border-r-0"
              >
                {dayName}
              </div>
            ))}
            
            {/* Calendar days */}
            {days}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateJobModal && (
        <CreateJobModal onClose={() => setShowCreateJobModal(false)} />
      )}
      
      {showCreateEventModal && (
        <CreateEventModal onClose={() => setShowCreateEventModal(false)} />
      )}
    </div>
  );
}