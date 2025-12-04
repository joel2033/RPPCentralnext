import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  Plus,
  MoreHorizontal,
  Clock,
  MapPin,
  Loader2
} from "lucide-react";
import CreateJobModal from "@/components/modals/CreateJobModal";
import CreateEventModal from "@/components/modals/CreateEventModal";
import AppointmentDetailsModal from "@/components/modals/AppointmentDetailsModal";
import { useMasterView } from "@/contexts/MasterViewContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeAppointments } from "@/hooks/useFirestoreRealtime";

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

type EventKind = 'job' | 'unavailable' | 'lunch' | 'meeting' | 'training' | 'other' | 'external-google';

const getEventColor = (type: EventKind): string => {
  const colors: Record<EventKind, string> = {
    'job': 'bg-blue-50 text-blue-700 border-blue-200',
    'unavailable': 'bg-red-50 text-red-700 border-red-200',
    'lunch': 'bg-green-50 text-green-700 border-green-200',
    'meeting': 'bg-purple-50 text-purple-700 border-purple-200',
    'training': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'other': 'bg-gray-50 text-gray-700 border-gray-200',
    'external-google': 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return colors[type] || colors.other;
};

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [showCreateJobModal, setShowCreateJobModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [miniCalDate, setMiniCalDate] = useState<Date>(new Date());
  const { isReadOnly } = useMasterView();
  const { userData } = useAuth();
  const partnerId = userData?.partnerId || null;
  
  const [eventTypes, setEventTypes] = useState<EventType[]>([
    { id: 'job', label: 'Job', color: 'text-blue-600', bgColor: 'bg-blue-100', checked: true },
    { id: 'unavailable', label: 'Unavailable', color: 'text-red-600', bgColor: 'bg-red-100', checked: true },
    { id: 'lunch', label: 'Lunch', color: 'text-green-600', bgColor: 'bg-green-100', checked: true },
    { id: 'meeting', label: 'Meeting', color: 'text-purple-600', bgColor: 'bg-purple-100', checked: true },
    { id: 'training', label: 'Training', color: 'text-yellow-600', bgColor: 'bg-yellow-100', checked: true },
    { id: 'other', label: 'Other', color: 'text-gray-600', bgColor: 'bg-gray-100', checked: true },
    { id: 'external-google', label: 'External Google', color: 'text-blue-600', bgColor: 'bg-blue-100', checked: true }
  ]);

  const { data: jobs = [], isError: jobsError, isLoading: isLoadingJobs } = useQuery({
    queryKey: ["/api/jobs"],
    retry: 1,
    staleTime: 30000,
  });

  const { data: users = [], isError: usersError } = useQuery<User[]>({
    queryKey: ["/api/users"],
    retry: 1,
    staleTime: 30000,
  });

  // Use real-time appointments hook for instant updates
  const { appointments: realtimeAppointments = [], loading: isLoadingAppointments, error: appointmentsError } = useRealtimeAppointments(partnerId);

  // Create a map of job.id -> job for quick lookup
  const jobsById = useMemo(() => {
    const map = new Map<string, any>();
    jobs.forEach((job: any) => {
      map.set(job.id, job);
      map.set(job.jobId, job); // Also index by jobId (NanoID) for flexibility
    });
    return map;
  }, [jobs]);

  // Enrich appointments with job data
  const allAppointments = useMemo(() => {
    console.log('[Calendar] Processing appointments:', {
      count: realtimeAppointments.length,
      appointments: realtimeAppointments.map(apt => ({
        id: apt.id,
        appointmentId: apt.appointmentId,
        jobId: apt.jobId,
        appointmentDate: apt.appointmentDate,
        status: apt.status
      })),
      jobsCount: jobs.length,
      jobsByIdKeys: Array.from(jobsById.keys())
    });
    
    return realtimeAppointments.map((apt: any) => {
      // Find the job for this appointment
      const job = jobsById.get(apt.jobId) || null;
      
      if (!job) {
        console.warn('[Calendar] Job not found for appointment:', {
          appointmentId: apt.appointmentId,
          appointmentJobId: apt.jobId,
          availableJobIds: Array.from(jobsById.keys())
        });
      }
      
      // Normalize appointment date
      let appointmentDate: Date;
      if (apt.appointmentDate instanceof Date) {
        appointmentDate = apt.appointmentDate;
      } else if (apt.appointmentDate?.toDate) {
        appointmentDate = apt.appointmentDate.toDate();
      } else if (typeof apt.appointmentDate === 'string') {
        appointmentDate = new Date(apt.appointmentDate);
      } else if (apt.appointmentDate?.seconds) {
        appointmentDate = new Date(apt.appointmentDate.seconds * 1000);
      } else {
        appointmentDate = new Date(apt.appointmentDate);
      }
      
      return {
        ...apt,
        appointmentDate, // Normalized date
        job: job, // Include full job data
      };
    });
  }, [realtimeAppointments, jobsById, jobs.length]);

  // Load partner settings to get team member colors (if configured)
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
    retry: 1,
    staleTime: 60000,
  });

  const teamMemberColors: Record<string, string> = settings?.teamMemberColors || {};

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

  const getJobsForDate = (targetDate: Date) => {
    if (!allAppointments || !Array.isArray(allAppointments)) {
      return [];
    }

    const targetDateString = targetDate.toDateString();

    return allAppointments.filter((appointment: any) => {
      if (!appointment || !appointment.appointmentDate) {
        return false;
      }
      try {
        // Handle different date formats - appointmentDate should already be normalized from the query
        let appointmentDate: Date;
        if (appointment.appointmentDate instanceof Date) {
          appointmentDate = appointment.appointmentDate;
        } else if (appointment.appointmentDate?.toDate) {
          appointmentDate = appointment.appointmentDate.toDate();
        } else if (appointment.appointmentDate?.seconds) {
          appointmentDate = new Date(appointment.appointmentDate.seconds * 1000);
        } else {
          appointmentDate = new Date(appointment.appointmentDate);
        }
        
        if (isNaN(appointmentDate.getTime())) {
          return false;
        }
        
        return appointmentDate.toDateString() === targetDateString;
      } catch (error) {
        console.error('[Calendar] Error processing appointment date:', error, appointment);
        return false;
      }
    }).map((appointment: any) => {
      const job = appointment.job || {};
      
      // Normalize appointment date for time display
      let appointmentDate: Date;
      if (appointment.appointmentDate instanceof Date) {
        appointmentDate = appointment.appointmentDate;
      } else if (appointment.appointmentDate?.toDate) {
        appointmentDate = appointment.appointmentDate.toDate();
      } else if (appointment.appointmentDate?.seconds) {
        appointmentDate = new Date(appointment.appointmentDate.seconds * 1000);
      } else {
        appointmentDate = new Date(appointment.appointmentDate);
      }
      
      return {
        ...appointment,
        // Keep ALL appointment data including products field
        id: appointment.id, // Internal UUID - needed for fetching full appointment
        appointmentId: appointment.appointmentId, // NanoID for external reference
        title: job.address || 'Untitled Job',
        type: 'job',
        time: (() => {
          try {
            return appointmentDate.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });
          } catch (error) {
            return '';
          }
        })(),
        appointmentDate, // Use normalized date
        jobId: job.jobId || job.id,
        address: job.address,
        assignedTo: appointment.assignedTo || job.assignedTo,
        customerId: job.customerId,
        // Include appointment-specific data - ensure products is included
        estimatedDuration: appointment.estimatedDuration,
        products: appointment.products, // This should be the JSON string from the database
        notes: appointment.notes,
        status: appointment.status,
      };
    });
  };

  const getEventsForDate = (targetDate: Date) => {
    // Mock events for demonstration - in real app this would come from API
    const mockEvents = [
      { id: 'e1', title: 'EXTERNAL GOOGLE Ellie 5 Edna', type: 'external-google', time: '08:00-09:00', date: new Date(2025, 8, 5), address: '5 Edna Street' },
      { id: 'e2', title: 'EXTERNAL GOOGLE Reilly 101 Reid', type: 'external-google', time: '09:00-10:00', date: new Date(2025, 8, 5), address: '101 Reid Avenue' },
      { id: 'e3', title: 'EXTERNAL GOOGLE Ellie and another', type: 'external-google', time: '06:00-08:00', date: new Date(2025, 8, 12), address: '12 Ellie Place' },
      { id: 'e4', title: 'EXTERNAL GOOGLE 105 Elam Place', type: 'external-google', time: '06:00-08:00', date: new Date(2025, 8, 19), address: '105 Elam Place' },
      { id: 'e5', title: 'EXTERNAL GOOGLE Glenview', type: 'external-google', time: '10:00-12:00', date: new Date(2025, 8, 26), address: 'Glenview Terrace' },
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

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getAvatarColor = (name?: string) => {
    const colors = ['bg-support-green', 'bg-rpp-red-main', 'bg-support-blue', 'bg-support-yellow'];
    if (!name || name.length === 0) return colors[0];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getWeekDates = (date: Date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const weekDate = new Date(startOfWeek);
      weekDate.setDate(startOfWeek.getDate() + i);
      weekDates.push(weekDate);
    }
    return weekDates;
  };

  const getViewTitle = () => {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    if (viewMode === 'month') {
      return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else if (viewMode === 'week') {
      const weekDates = getWeekDates(currentDate);
      const startMonth = monthNames[weekDates[0].getMonth()];
      const endMonth = monthNames[weekDates[6].getMonth()];
      const startDay = weekDates[0].getDate();
      const endDay = weekDates[6].getDate();
      const year = weekDates[0].getFullYear();

      if (startMonth === endMonth) {
        return `${startMonth} ${startDay} - ${endDay}, ${year}`;
      } else {
        return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
      }
    } else {
      return `${monthNames[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
    }
  };

  const getTotalAppointments = (): number => {
    // Rough count based on current view
    if (viewMode === 'day') {
      return getJobsForDate(currentDate).length + getEventsForDate(currentDate).length;
    }
    if (viewMode === 'week') {
      return getWeekDates(currentDate).reduce((sum, d) => sum + getJobsForDate(d).length + getEventsForDate(d).length, 0);
    }
    // month
    const days = getDaysInMonth(currentDate);
    let count = 0;
    for (let day = 1; day <= days; day++) {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      count += getJobsForDate(d).length + getEventsForDate(d).length;
    }
    return count;
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setMiniCalDate(now);
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOfMonth = getFirstDayOfMonth(currentDate);
  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  const renderMonthView = () => {
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(
        <div
          key={`empty-${i}`}
          className="p-2 min-h-[120px] border-r border-b border-gray-100 bg-gray-50"
        ></div>
      );
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayJobs = getJobsForDate(targetDate);
      const dayEvents = getEventsForDate(targetDate);
      const isToday = new Date().toDateString() === targetDate.toDateString();
      const allEvents = [...dayJobs.map((job: any) => ({ ...job, type: 'job', title: job.address, time: job.appointmentDate ? new Date(job.appointmentDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '' })), ...dayEvents];

      days.push(
        <div
          key={day}
          className={`p-2 min-h-[120px] border-r border-b border-gray-100 bg-white hover:bg-gray-50 ${
            isToday ? 'bg-rpp-red-lighter' : ''
          }`}
          data-testid={`calendar-day-${day}`}
        >
          <div className={`text-sm font-medium mb-2 ${isToday ? 'text-rpp-red-dark' : 'text-gray-700'}`}>
            {day}
          </div>
          <div className="space-y-1">
            {allEvents.slice(0, 3).map((event: any, index: number) => {
              const typeId = (event.type || 'other') as EventKind;
              const visible = eventTypes.find(t => t.id === typeId)?.checked ?? true;
              if (!visible) return null;
              const title = ((event.title || event.address || '') as string);
              const short = title && title.length > 18 ? `${title.substring(0, 18)}...` : title;
              const jobColor =
                typeId === 'job' && event.assignedTo && teamMemberColors[event.assignedTo as string]
                  ? teamMemberColors[event.assignedTo as string]
                  : null;
              return (
                <div
                  key={event.id || `event-${index}`}
                  className={`rounded-lg p-2 text-xs mb-1 border cursor-pointer hover:shadow-md transition-shadow ${getEventColor(typeId)}`}
                  style={
                    jobColor
                      ? {
                          backgroundColor: jobColor,
                          color: '#ffffff',
                          borderColor: jobColor,
                        }
                      : undefined
                  }
                  title={title}
                  data-testid={`event-${event.id || index}`}
                  onClick={(e) => handleAppointmentClick(event, e)}
                >
                  <div className="font-medium leading-tight">{short}</div>
                  <div className="flex items-center gap-1 text-[10px] opacity-80">
                    {event.time && (<><Clock className="w-3 h-3" /> <span>{event.time}</span></>)}
                  </div>
                  {event.address && (
                    <div className="flex items-center gap-1 text-[10px] opacity-80">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{(event.address as string).length > 22 ? `${(event.address as string).substring(0,22)}...` : event.address}</span>
                    </div>
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

    // Trailing empty cells so the month grid is always 6 rows (6 * 7 = 42)
    const totalCells = firstDayOfMonth + daysInMonth;
    const maxCells = 42;
    for (let i = totalCells; i < maxCells; i++) {
      days.push(
        <div
          key={`trailing-${i}`}
          className="p-2 min-h-[120px] border-r border-b border-gray-100 bg-gray-50"
        ></div>
      );
    }

    return (
      <div className="grid grid-cols-7">
        {dayNames.map((dayName) => (
          <div
            key={dayName}
            className="uppercase text-xs font-medium text-gray-500 p-3 border-b border-gray-100 text-center bg-gray-50/50"
          >
            {dayName}
          </div>
        ))}
        {days}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDates = getWeekDates(currentDate);

    return (
      <div className="grid grid-cols-7">
        {dayNames.map((dayName, index) => (
          <div
            key={dayName}
            className="p-4 bg-gray-50 text-center text-sm font-medium text-gray-600 border-r border-b border-gray-200 last:border-r-0"
          >
            <div>{dayName}</div>
            <div className="text-lg font-bold text-gray-900">{weekDates[index].getDate()}</div>
          </div>
        ))}
        {weekDates.map((date, index) => {
          const dayJobs = getJobsForDate(date);
          const dayEvents = getEventsForDate(date);
          const isToday = new Date().toDateString() === date.toDateString();
          const allEvents = [...dayJobs.map((job: any) => ({ ...job, type: 'job', title: job.address, time: job.appointmentDate ? new Date(job.appointmentDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '' })), ...dayEvents];

          return (
            <div
              key={index}
              className={`p-2 min-h-[200px] border-r border-b border-gray-100 bg-white hover:bg-gray-50 ${
                isToday ? 'bg-rpp-red-lighter' : ''
              }`}
              data-testid={`week-day-${index}`}
            >
              <div className="space-y-1">
                {allEvents.map((event: any, eventIndex: number) => {
                  const typeId = (event.type || 'other') as EventKind;
                  const visible = eventTypes.find(t => t.id === typeId)?.checked ?? true;
                  if (!visible) return null;
                  const title = (event.title || event.address) as string;
                  const short = title.length > 28 ? `${title.substring(0, 28)}...` : title;
                  const jobColor =
                    typeId === 'job' && event.assignedTo && teamMemberColors[event.assignedTo as string]
                      ? teamMemberColors[event.assignedTo as string]
                      : null;
                  return (
                    <div
                      key={event.id || `event-${eventIndex}`}
                      className={`rounded-lg p-2 text-xs mb-1 border cursor-pointer hover:shadow-md transition-shadow ${getEventColor(typeId)}`}
                      style={
                        jobColor
                          ? {
                              backgroundColor: jobColor,
                              color: '#ffffff',
                              borderColor: jobColor,
                            }
                          : undefined
                      }
                      title={title}
                      data-testid={`week-event-${event.id || eventIndex}`}
                      onClick={(e) => handleAppointmentClick(event, e)}
                    >
                      <div className="font-medium leading-tight">{short}</div>
                      <div className="flex items-center gap-1 text-[10px] opacity-80">
                        {event.time && (<><Clock className="w-3 h-3" /> <span>{event.time}</span></>)}
                      </div>
                      {event.address && (
                        <div className="flex items-center gap-1 text-[10px] opacity-80">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{(event.address as string).length > 30 ? `${(event.address as string).substring(0,30)}...` : event.address}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDayView = () => {
    const dayJobs = getJobsForDate(currentDate);
    const dayEvents = getEventsForDate(currentDate);
    const isToday = new Date().toDateString() === currentDate.toDateString();
    const allEvents = [...dayJobs.map((job: any) => ({ ...job, type: 'job', title: job.address, time: job.appointmentDate ? new Date(job.appointmentDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '' })), ...dayEvents];

    // Create hourly time slots
    const timeSlots = [];
    for (let hour = 0; hour < 24; hour++) {
      const timeString = `${hour.toString().padStart(2, '0')}:00`;
      const hourEvents = allEvents.filter(event => event.time?.startsWith(hour.toString().padStart(2, '0')));

      timeSlots.push(
        <div key={hour} className="border-b border-gray-100 p-2 min-h-[60px] flex" data-testid={`day-hour-${hour}`}>
          <div className="w-16 text-sm text-gray-500 pr-4">{timeString}</div>
          <div className="flex-1 space-y-1">
            {hourEvents.map((event: any, index: number) => {
              const typeId = (event.type || 'other') as EventKind;
              const visible = eventTypes.find(t => t.id === typeId)?.checked ?? true;
              if (!visible) return null;
              const title = (event.title || event.address) as string;
              const short = title.length > 36 ? `${title.substring(0, 36)}...` : title;
              const jobColor =
                typeId === 'job' && event.assignedTo && teamMemberColors[event.assignedTo as string]
                  ? teamMemberColors[event.assignedTo as string]
                  : null;
              return (
                <div
                  key={event.id || `event-${index}`}
                  className={`rounded-lg p-2 text-xs mb-1 border cursor-pointer hover:shadow-md transition-shadow ${getEventColor(typeId)}`}
                  style={
                    jobColor
                      ? {
                          backgroundColor: jobColor,
                          color: '#ffffff',
                          borderColor: jobColor,
                        }
                      : undefined
                  }
                  title={title}
                  data-testid={`day-event-${event.id || index}`}
                  onClick={(e) => handleAppointmentClick(event, e)}
                >
                  <div className="font-medium leading-tight">{short}</div>
                  <div className="flex items-center gap-1 text-[10px] opacity-80">
                    {event.time && (<><Clock className="w-3 h-3" /> <span>{event.time}</span></>)}
                  </div>
                  {event.address && (
                    <div className="flex items-center gap-1 text-[10px] opacity-80">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{(event.address as string).length > 40 ? `${(event.address as string).substring(0,40)}...` : event.address}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white">
        <div className={`p-4 border-b border-gray-200 ${isToday ? 'bg-rpp-red-lighter' : 'bg-gray-50'}`}>
          <div className={`text-lg font-semibold ${isToday ? 'text-rpp-red-dark' : 'text-gray-900'}`}>
            {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          {timeSlots}
        </div>
      </div>
    );
  };

  return (
    <div className="flex gap-6 h-full bg-gray-50">
      {/* Sidebar - fixed width, hidden on mobile */}
      <aside className="hidden lg:block w-64 flex-shrink-0 bg-white border-r border-gray-200 p-4 overflow-y-auto">
        {/* Mini Calendar */}
        <div className="mb-4 rounded-xl border border-gray-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <button aria-label="Prev month" className="p-1 hover:bg-gray-100 rounded" onClick={() => setMiniCalDate(new Date(miniCalDate.getFullYear(), miniCalDate.getMonth()-1, 1))}>
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <div className="text-sm font-medium text-gray-800">
              {miniCalDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <button aria-label="Next month" className="p-1 hover:bg-gray-100 rounded" onClick={() => setMiniCalDate(new Date(miniCalDate.getFullYear(), miniCalDate.getMonth()+1, 1))}>
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-[10px] text-gray-500 mb-1">
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (<div key={d} className="text-center py-1">{d}</div>))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {(() => {
              const first = new Date(miniCalDate.getFullYear(), miniCalDate.getMonth(), 1).getDay();
              const days = new Date(miniCalDate.getFullYear(), miniCalDate.getMonth()+1, 0).getDate();
              const cells: JSX.Element[] = [];

              // Leading empty cells before the first of the month
              for (let i = 0; i < first; i++) {
                cells.push(<div key={`e-${i}`} className="py-1" />);
              }

              // Actual days of the month
              for (let d = 1; d <= days; d++) {
                const thisDate = new Date(miniCalDate.getFullYear(), miniCalDate.getMonth(), d);
                const isSelected = thisDate.toDateString() === currentDate.toDateString();
                const isToday = thisDate.toDateString() === new Date().toDateString();
                cells.push(
                  <button
                    key={`d-${d}`}
                    onClick={() => setCurrentDate(thisDate)}
                    className={`text-xs text-center py-1.5 rounded-md border ${isSelected ? 'bg-rpp-red-palest border-rpp-red-pale text-rpp-red-dark' : 'border-transparent hover:bg-gray-50'} ${isToday && !isSelected ? 'font-semibold text-gray-900' : 'text-gray-700'}`}
                  >
                    {d}
                  </button>
                );
              }

              // Trailing empty cells so the grid is always 6 rows (6 * 7 = 42)
              const totalCells = first + days;
              const maxCells = 42;
              for (let i = totalCells; i < maxCells; i++) {
                cells.push(<div key={`t-${i}`} className="py-1" />);
              }
              return cells;
            })()}
          </div>
        </div>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Filters</h2>
          </div>
        </div>

        {/* Team Section */}
        <div className="mb-4 rounded-xl border border-gray-200 p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900">Team</h3>
            <Button variant="link" size="sm" className="text-xs text-rpp-red-main h-auto p-0">
              Clear
            </Button>
          </div>
          <div className="space-y-2">
            {users.map((user) => (
              <label key={user.id} className="flex items-center gap-3 py-2 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors" data-testid={`team-member-${user.id}`}>
                <input type="radio" name="team" className="w-4 h-4" />
                <div
                  className={`w-8 h-8 rounded-full ${teamMemberColors[user.id] ? '' : getAvatarColor(user.firstName || user.email)} text-white flex items-center justify-center text-sm font-medium`}
                  style={teamMemberColors[user.id] ? { backgroundColor: teamMemberColors[user.id] } : undefined}
                >
                  {getInitials(user.firstName, user.lastName) || user.email?.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-sm text-gray-700">
                  {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Event Type Section */}
        <div className="mb-4 rounded-xl border border-gray-200 p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900">Event Type</h3>
            <Button variant="link" size="sm" className="text-xs text-rpp-red-main h-auto p-0">
              Clear
            </Button>
          </div>
          <div className="space-y-2">
            {eventTypes.map((eventType) => (
              <label key={eventType.id} className="flex items-center gap-2 cursor-pointer" data-testid={`event-type-${eventType.id}`}>
                <Checkbox
                  checked={eventType.checked}
                  onCheckedChange={() => toggleEventType(eventType.id)}
                />
                <div className={`w-3 h-3 rounded-full ${eventType.bgColor}`}></div>
                <span className={`text-sm text-gray-700`}>
                  {eventType.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      </aside>
      {/* Main Calendar Area */}
      <div className="flex-1 p-6 overflow-hidden">
        <div className="mb-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
            {/* Left controls: search, view dropdown, Today */}
            <div className="flex items-center gap-3 flex-1">
              <div className="relative max-w-xs w-full">
                <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                <CalendarIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={goToToday}>
                <CalendarIcon className="w-4 h-4 mr-2" />
                Today
              </Button>
            </div>
            {/* Center date with chevrons */}
            <div className="flex items-center gap-2">
              <button aria-label="Previous" onClick={() => navigate('prev')} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" data-testid="nav-prev">
                <ChevronLeft className="w-5 h-5 text-gray-700" />
              </button>
              <span className="text-base font-semibold text-gray-900 min-w-[180px] text-center">{getViewTitle()}</span>
              <button aria-label="Next" onClick={() => navigate('next')} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" data-testid="nav-next">
                <ChevronRight className="w-5 h-5 text-gray-700" />
              </button>
            </div>
            {/* Right summary and actions */}
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span>{getTotalAppointments()} Appointments</span>
              <Button variant="outline" size="sm" disabled title="Coming soon">
                Google Calendar
              </Button>
              {!isReadOnly && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="bg-gradient-to-r from-[#F05A2A] to-[#ff6b3d] text-white rounded-lg px-3 py-2 shadow-lg shadow-orange-500/30 hover:shadow-xl transition-all" data-testid="create-button">
                      <Plus className="w-4 h-4 mr-2" />
                      Create
                      <ChevronDown className="w-4 h-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setShowCreateJobModal(true)}>
                      New Job
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowCreateEventModal(true)}>
                      Add Event
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden relative">
          {/* Loading Overlay */}
          {(isLoadingJobs || isLoadingAppointments) && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-rpp-red-main animate-spin" />
                <p className="text-sm text-gray-600 font-medium">
                  {isLoadingJobs ? 'Loading calendar...' : 'Loading appointments...'}
                </p>
              </div>
            </div>
          )}
          
          {/* Error State */}
          {appointmentsError && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
              <div className="flex flex-col items-center gap-3 text-center p-4">
                <p className="text-sm text-red-600 font-medium">
                  Error loading appointments. Please refresh the page.
                </p>
                <p className="text-xs text-gray-500">
                  {appointmentsError.message}
                </p>
              </div>
            </div>
          )}
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'day' && renderDayView()}
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