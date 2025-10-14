import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  Plus,
  Search,
  Clock
} from "lucide-react";
import CreateJobModal from "@/components/modals/CreateJobModal";
import CreateEventModal from "@/components/modals/CreateEventModal";
import AppointmentDetailsModal from "@/components/modals/AppointmentDetailsModal";

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

type ViewMode = 'month' | 'week' | 'day';

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [miniCalendarDate, setMiniCalendarDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [showCreateJobModal, setShowCreateJobModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([
    { id: 'photo', label: 'Photo Shoots', color: 'text-blue-600', bgColor: 'bg-blue-100', checked: true },
    { id: 'delivery', label: 'Deliveries', color: 'text-green-600', bgColor: 'bg-green-100', checked: true },
    { id: 'consultation', label: 'Consultations', color: 'text-purple-600', bgColor: 'bg-purple-100', checked: true },
    { id: 'editing', label: 'Editing', color: 'text-yellow-600', bgColor: 'bg-yellow-100', checked: true },
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

  const navigate = (direction: 'prev' | 'next') => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + (direction === 'next' ? 1 : -1),
        1
      ));
    } else if (viewMode === 'week') {
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
      setCurrentDate(newDate);
    } else if (viewMode === 'day') {
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
      setCurrentDate(newDate);
    }
  };

  const navigateMiniCalendar = (direction: 'prev' | 'next') => {
    setMiniCalendarDate(new Date(
      miniCalendarDate.getFullYear(),
      miniCalendarDate.getMonth() + (direction === 'next' ? 1 : -1),
      1
    ));
  };

  const getJobsForDate = (targetDate: Date) => {
    return (jobs as any[]).filter((job: any) => {
      const jobDate = new Date(job.appointmentDate || job.createdAt);
      return jobDate.toDateString() === targetDate.toDateString();
    }).map((job: any) => ({
      ...job,
      id: job.jobId,
      title: job.address,
      type: 'photo',
      time: job.appointmentDate ? new Date(job.appointmentDate).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }) : '',
      jobId: job.jobId
    }));
  };

  const getEventsForDate = (targetDate: Date) => {
    const mockEvents = [
      { id: 'e1', title: 'RESIDENTIAL ...', type: 'photo', time: '09:00', date: new Date(2025, 9, 1), address: '42 Martin Place', allDay: false },
      { id: 'e2', title: 'All day EXTER...', type: 'editing', time: '', date: new Date(2025, 9, 2), address: 'Matt on Terr...', allDay: true },
      { id: 'e3', title: 'COMMERCIAL ...', type: 'photo', time: '08:00', date: new Date(2025, 9, 3), address: '18 Beach Road', allDay: false },
      { id: 'e4', title: 'EDITING SESSI...', type: 'editing', time: '14:00', date: new Date(2025, 9, 3), address: '', allDay: false },
      { id: 'e5', title: 'DELIVERY', type: 'delivery', time: '10:00', date: new Date(2025, 9, 7), address: '', allDay: false },
      { id: 'e6', title: 'All day EXTER...', type: 'editing', time: '', date: new Date(2025, 9, 8), address: 'City Office', allDay: true },
      { id: 'e7', title: 'RESIDENTIAL ...', type: 'photo', time: '09:30', date: new Date(2025, 9, 9), address: '16 Collins Str...', allDay: false },
      { id: 'e8', title: 'EDITING SESSI...', type: 'editing', time: '13:00', date: new Date(2025, 9, 9), address: '', allDay: false },
      { id: 'e9', title: 'COMMERCIAL ...', type: 'photo', time: '08:00', date: new Date(2025, 9, 14), address: '25 King Stree...', allDay: false },
      { id: 'e10', title: 'ADMIN DAY', type: 'consultation', time: '', date: new Date(2025, 9, 15), address: '', allDay: true },
      { id: 'e11', title: 'DELIVERY', type: 'delivery', time: '11:00', date: new Date(2025, 9, 16), address: '', allDay: false },
      { id: 'e12', title: 'RESIDENTIAL ...', type: 'photo', time: '10:00', date: new Date(2025, 9, 21), address: '88 Harbour B...', allDay: false },
      { id: 'e13', title: 'EDITING SESSI...', type: 'editing', time: '09:00', date: new Date(2025, 9, 22), address: '', allDay: false },
      { id: 'e14', title: 'DELIVERY', type: 'delivery', time: '10:30', date: new Date(2025, 9, 23), address: '', allDay: false },
      { id: 'e15', title: 'COMMERCIAL ...', type: 'photo', time: '08:00', date: new Date(2025, 9, 28), address: '', allDay: false },
      { id: 'e16', title: 'CONSULTATION', type: 'consultation', time: '14:00', date: new Date(2025, 9, 29), address: '', allDay: false },
    ];

    if (!targetDate || typeof targetDate.toDateString !== 'function') {
      return [];
    }

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

  const handleAppointmentClick = (appointment: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedAppointment(appointment);
    setShowAppointmentModal(true);
  };

  const closeAppointmentModal = () => {
    setSelectedAppointment(null);
    setShowAppointmentModal(false);
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = ['bg-support-green', 'bg-rpp-red-main', 'bg-support-blue', 'bg-support-yellow'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getViewTitle = () => {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  const getMiniCalendarTitle = () => {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return `${monthNames[miniCalendarDate.getMonth()]} ${miniCalendarDate.getFullYear()}`;
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOfMonth = getFirstDayOfMonth(currentDate);
  const miniDaysInMonth = getDaysInMonth(miniCalendarDate);
  const miniFirstDayOfMonth = getFirstDayOfMonth(miniCalendarDate);
  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const miniDayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const renderMonthView = () => {
    const days = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="p-3 min-h-[100px] border-r border-b border-rpp-grey-border bg-gray-50"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayJobs = getJobsForDate(targetDate);
      const dayEvents = getEventsForDate(targetDate);
      const isToday = new Date().toDateString() === targetDate.toDateString();
      const allEvents = [...dayJobs, ...dayEvents];

      days.push(
        <div
          key={day}
          className={`p-3 min-h-[100px] border-r border-b border-rpp-grey-border bg-white hover:bg-gray-50 ${
            isToday ? 'bg-rpp-red-lighter' : ''
          }`}
          data-testid={`calendar-day-${day}`}
        >
          <div className={`text-sm font-semibold mb-2 ${isToday ? 'text-rpp-red-dark' : 'text-rpp-grey-dark'}`}>
            {day}
          </div>
          <div className="space-y-1">
            {allEvents.slice(0, 3).map((event: any, index: number) => {
              const eventType = eventTypes.find(type => type.id === event.type);
              if (!eventType?.checked) return null;

              return (
                <div
                  key={event.id || `event-${index}`}
                  className={`text-xs p-1.5 rounded text-left cursor-pointer hover:opacity-80 transition-opacity ${eventType?.bgColor || 'bg-gray-100'} ${eventType?.color || 'text-gray-700'}`}
                  title={event.title || event.address}
                  data-testid={`event-${event.id || index}`}
                  onClick={(e) => handleAppointmentClick(event, e)}
                >
                  <div className="font-medium">
                    {event.allDay && <Clock className="w-3 h-3 inline mr-1" />}
                    {!event.allDay && event.time && <span className="mr-1">{event.time}</span>}
                    {event.allDay ? 'All day ' : ''}{event.title}
                  </div>
                  {event.address && (
                    <div className="text-xs opacity-75 truncate">+ {event.address}</div>
                  )}
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
      <div className="grid grid-cols-7">
        {dayNames.map((dayName) => (
          <div
            key={dayName}
            className="p-3 bg-white text-left text-xs font-semibold text-rpp-grey-medium border-r border-b border-rpp-grey-border"
          >
            {dayName}
          </div>
        ))}
        {days}
      </div>
    );
  };

  const renderMiniCalendar = () => {
    const days = [];

    for (let i = 0; i < miniFirstDayOfMonth; i++) {
      const prevMonthDays = new Date(miniCalendarDate.getFullYear(), miniCalendarDate.getMonth(), 0).getDate();
      const day = prevMonthDays - miniFirstDayOfMonth + i + 1;
      days.push(
        <div key={`prev-${i}`} className="text-center py-1 text-sm text-gray-400">
          {day}
        </div>
      );
    }

    for (let day = 1; day <= miniDaysInMonth; day++) {
      const targetDate = new Date(miniCalendarDate.getFullYear(), miniCalendarDate.getMonth(), day);
      const isToday = new Date().toDateString() === targetDate.toDateString();

      days.push(
        <div
          key={day}
          className={`text-center py-1 text-sm cursor-pointer rounded hover:bg-gray-100 ${
            isToday ? 'bg-rpp-red-main text-white hover:bg-rpp-red-dark' : 'text-rpp-grey-dark'
          }`}
          onClick={() => setCurrentDate(targetDate)}
        >
          {day}
        </div>
      );
    }

    const totalCells = miniFirstDayOfMonth + miniDaysInMonth;
    const remainingCells = 42 - totalCells;
    for (let i = 1; i <= remainingCells; i++) {
      days.push(
        <div key={`next-${i}`} className="text-center py-1 text-sm text-gray-400">
          {i}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-7 gap-1">
        {miniDayNames.map((dayName) => (
          <div key={dayName} className="text-center text-xs font-medium text-rpp-grey-medium py-1">
            {dayName}
          </div>
        ))}
        {days}
      </div>
    );
  };

  const totalAppointments = jobs.length;

  return (
    <div className="flex h-screen bg-rpp-grey-surface">
      {/* Left Sidebar */}
      <div className="w-64 bg-white border-r border-rpp-grey-border p-4 overflow-y-auto">
        {/* Mini Calendar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0"
              onClick={() => navigateMiniCalendar('prev')}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h3 className="text-sm font-semibold text-rpp-grey-dark">{getMiniCalendarTitle()}</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0"
              onClick={() => navigateMiniCalendar('next')}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          {renderMiniCalendar()}
        </div>

        <Separator className="my-4" />

        {/* Teams Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-rpp-grey-dark">Teams</h3>
            <Button variant="link" size="sm" className="text-xs text-rpp-red-main h-auto p-0 hover:text-rpp-red-dark">
              Clear
            </Button>
          </div>
          <div className="space-y-2">
            {users.slice(0, 2).map((user) => (
              <div key={user.id} className="flex items-center space-x-3" data-testid={`team-member-${user.id}`}>
                <Checkbox
                  checked={selectedTeamMembers.includes(user.id)}
                  onCheckedChange={() => toggleTeamMember(user.id)}
                  className="border-rpp-grey-border data-[state=checked]:bg-rpp-red-main data-[state=checked]:border-rpp-red-main"
                />
                <span className="text-sm text-rpp-grey-dark">
                  {user.firstName} {user.lastName?.[0] || ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Separator className="my-4" />

        {/* Event Type Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-rpp-grey-dark">Event Type</h3>
            <Button variant="link" size="sm" className="text-xs text-rpp-red-main h-auto p-0 hover:text-rpp-red-dark">
              Clear
            </Button>
          </div>
          <div className="space-y-2">
            {eventTypes.map((eventType) => (
              <div key={eventType.id} className="flex items-center space-x-2" data-testid={`event-type-${eventType.id}`}>
                <Checkbox
                  checked={eventType.checked}
                  onCheckedChange={() => toggleEventType(eventType.id)}
                  className="border-rpp-grey-border data-[state=checked]:bg-rpp-red-main data-[state=checked]:border-rpp-red-main"
                />
                <span className="text-sm text-rpp-grey-dark">
                  {eventType.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-rpp-grey-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-rpp-grey-dark mb-1">Calendar</h1>
              <p className="text-sm text-rpp-grey-medium">Manage your shoots, appointments and schedule</p>
            </div>
            <Button 
              className="bg-rpp-red-main hover:bg-rpp-red-dark text-white"
              onClick={() => setShowCreateJobModal(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-rpp-grey-light" />
                <Input
                  placeholder="Search for jobs, orders, clients or properti"
                  className="pl-10 w-80 border-rpp-grey-border"
                />
              </div>
              <Button variant="outline" className="border-rpp-grey-border">
                <CalendarIcon className="w-4 h-4 mr-2" />
                Today
              </Button>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('prev')}
                  className="border-rpp-grey-border"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="text-base font-semibold text-rpp-grey-dark min-w-[140px] text-center">
                  {getViewTitle()}
                </h2>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('next')}
                  className="border-rpp-grey-border"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-sm text-rpp-grey-medium">
                {totalAppointments} Appointments · <span className="text-rpp-red-main">Google Calendar</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-rpp-grey-border">
                    Month
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setViewMode('month')}>Month</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setViewMode('week')}>Week</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setViewMode('day')}>Day</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto bg-rpp-grey-surface p-6">
          <div className="bg-white rounded-lg border border-rpp-grey-border overflow-hidden shadow-sm">
            {renderMonthView()}
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

      {showAppointmentModal && selectedAppointment && (
        <AppointmentDetailsModal
          appointment={selectedAppointment}
          onClose={closeAppointmentModal}
        />
      )}
    </div>
  );
}