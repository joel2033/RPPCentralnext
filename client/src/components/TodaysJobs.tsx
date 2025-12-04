import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Clock, MapPin, User, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";

interface Job {
  id: string;
  jobId: string;
  address: string;
  jobName?: string;
  status: string;
  appointmentDate?: string | Date;
  customerName?: string;
  customer?: {
    firstName?: string;
    lastName?: string;
  };
}

interface TodaysJobsProps {
  jobs: Job[];
  isLoading?: boolean;
}

const formatTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'booked':
      return 'bg-blue-50 text-blue-600 border-blue-200';
    case 'pending':
      return 'bg-amber-50 text-amber-600 border-amber-200';
    case 'delivered':
      return 'bg-green-50 text-green-600 border-green-200';
    case 'on_hold':
      return 'bg-gray-50 text-gray-600 border-gray-200';
    case 'cancelled':
      return 'bg-red-50 text-red-600 border-red-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'booked':
      return 'Booked';
    case 'pending':
      return 'Pending';
    case 'delivered':
      return 'Delivered';
    case 'on_hold':
      return 'On Hold';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
};

export function TodaysJobs({ jobs, isLoading }: TodaysJobsProps) {
  const [, setLocation] = useLocation();

  // Filter jobs to only show today's appointments
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todaysJobs = jobs.filter((job) => {
    if (!job.appointmentDate) return false;
    const appointmentDate = new Date(job.appointmentDate);
    return appointmentDate >= today && appointmentDate < tomorrow;
  }).sort((a, b) => {
    // Sort by appointment time
    const dateA = new Date(a.appointmentDate!);
    const dateB = new Date(b.appointmentDate!);
    return dateA.getTime() - dateB.getTime();
  });

  const handleJobClick = (jobId: string) => {
    setLocation(`/jobs/${jobId}`);
  };

  return (
    <Card className="bg-white border-0 rounded-3xl shadow-rpp-card overflow-hidden">
      <CardHeader className="p-6 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2.5 text-base font-bold text-rpp-grey-dark">
                Today's Jobs
                {todaysJobs.length > 0 && (
                  <Badge className="rounded-full h-5 min-w-5 px-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-600">
                    {todaysJobs.length}
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-rpp-grey-medium mt-1">
                Scheduled appointments for today
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : todaysJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <CheckCircle2 className="w-12 h-12 text-support-green mb-3" />
              <p className="text-sm font-medium text-rpp-grey-dark">No jobs today</p>
              <p className="text-xs text-rpp-grey-medium mt-1">You have no scheduled appointments for today.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {todaysJobs.map((job) => {
                const customerName = job.customerName || 
                  (job.customer ? `${job.customer.firstName || ''} ${job.customer.lastName || ''}`.trim() : null);
                
                return (
                  <div
                    key={job.id}
                    onClick={() => handleJobClick(job.jobId)}
                    className="p-4 hover:bg-rpp-grey-bg/50 transition-colors cursor-pointer"
                  >
                    <div className="flex gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rpp-red-lighter to-rpp-red-light flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-4 h-4 text-rpp-red-main" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="text-sm font-semibold text-rpp-grey-dark truncate">
                            {job.jobName || job.address}
                          </h4>
                          <Badge
                            variant="outline"
                            className={`text-xs flex-shrink-0 h-5 font-semibold ${getStatusColor(job.status)}`}
                          >
                            {getStatusLabel(job.status)}
                          </Badge>
                        </div>

                        {job.jobName && (
                          <p className="text-xs text-rpp-grey-medium truncate mb-1">
                            {job.address}
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-xs text-rpp-grey-light mt-2">
                          {job.appointmentDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(job.appointmentDate)}
                            </span>
                          )}
                          {customerName && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {customerName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

