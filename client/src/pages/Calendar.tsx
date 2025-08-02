import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const { data: jobs = [] } = useQuery({
    queryKey: ["/api/jobs"],
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

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOfMonth = getFirstDayOfMonth(currentDate);
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const days = [];
  
  // Empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className="p-2"></div>);
  }
  
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dayJobs = getJobsForDate(day);
    const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
    
    days.push(
      <div
        key={day}
        className={`p-2 border border-rpp-grey-border min-h-[80px] ${
          isToday ? 'bg-rpp-red-light bg-opacity-10 border-rpp-red-main' : 'hover:bg-rpp-grey-surface'
        }`}
      >
        <div className={`text-sm font-medium mb-1 ${isToday ? 'text-rpp-red-main' : 'text-rpp-grey-dark'}`}>
          {day}
        </div>
        <div className="space-y-1">
          {dayJobs.slice(0, 2).map((job: any, index: number) => (
            <div
              key={job.id}
              className="text-xs p-1 bg-support-blue text-white rounded truncate"
              title={job.address}
            >
              {job.address.substring(0, 20)}...
            </div>
          ))}
          {dayJobs.length > 2 && (
            <div className="text-xs text-rpp-grey-light">
              +{dayJobs.length - 2} more
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-rpp-grey-dark">Calendar</h2>
          <p className="text-rpp-grey-light">Schedule and manage your photography appointments</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="outline" className="border-rpp-grey-border">
            Today
          </Button>
          <Button className="bg-rpp-red-main hover:bg-rpp-red-dark text-white">
            <CalendarIcon className="w-4 h-4 mr-2" />
            New Appointment
          </Button>
        </div>
      </div>

      <Card className="border-rpp-grey-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl text-rpp-grey-dark">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('prev')}
                className="border-rpp-grey-border"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('next')}
                className="border-rpp-grey-border"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-0 border border-rpp-grey-border">
            {/* Day headers */}
            {dayNames.map((dayName) => (
              <div
                key={dayName}
                className="p-3 bg-rpp-grey-surface text-center font-medium text-rpp-grey-dark border-b border-rpp-grey-border"
              >
                {dayName}
              </div>
            ))}
            {/* Calendar days */}
            {days}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-support-blue rounded"></div>
              <span className="text-rpp-grey-light">Scheduled Jobs</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-rpp-red-light bg-opacity-20 border border-rpp-red-main rounded"></div>
              <span className="text-rpp-grey-light">Today</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
