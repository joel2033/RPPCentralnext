import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, User, Upload, Download, FileText, CheckCircle, Clock, AlertCircle, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, Query } from "firebase/firestore";

interface ActivityData {
  id: string;
  partnerId: string;
  jobId: string | null;
  orderId: string | null;
  userId: string;
  userEmail: string;
  userName: string;
  action: string;
  category: string;
  title: string;
  description: string;
  metadata: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface ActivityTimelineProps {
  jobId?: string;
  orderId?: string;
  className?: string;
}

export default function ActivityTimeline({ jobId, orderId, className }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Don't subscribe if we don't have a jobId or orderId
    if (!jobId && !orderId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Build Firestore query with filters
    let q: Query = collection(db, "activities");
    
    // Filter by jobId or orderId
    if (jobId) {
      q = query(q, where("jobId", "==", jobId));
    }
    if (orderId) {
      q = query(q, where("orderId", "==", orderId));
    }
    
    // Order by creation time (oldest first - so job creation is always first)
    q = query(q, orderBy("createdAt", "asc"));

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const activitiesData: ActivityData[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            partnerId: data.partnerId,
            jobId: data.jobId || null,
            orderId: data.orderId || null,
            userId: data.userId,
            userEmail: data.userEmail,
            userName: data.userName,
            action: data.action,
            category: data.category,
            title: data.title,
            description: data.description,
            metadata: data.metadata || null,
            ipAddress: data.ipAddress || null,
            userAgent: data.userAgent || null,
            createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt)
          };
        });
        
        setActivities(activitiesData);
        setIsLoading(false);
      },
      (err) => {
        console.error("Error listening to activities:", err);
        console.error("Error code:", (err as any).code);
        console.error("Error message:", (err as any).message);
        console.error("Query details:", { jobId, orderId });
        setError(err as Error);
        setIsLoading(false);
      }
    );

    // Cleanup: unsubscribe when component unmounts or dependencies change
    return () => unsubscribe();
  }, [jobId, orderId]);

  const getActivityIcon = (action: string, category: string) => {
    switch (action) {
      case 'creation':
        return category === 'job' ? <CheckCircle className="h-4 w-4" /> : <FileText className="h-4 w-4" />;
      case 'assignment':
        return <UserPlus className="h-4 w-4" />;
      case 'upload':
        return <Upload className="h-4 w-4" />;
      case 'download':
        return <Download className="h-4 w-4" />;
      case 'status_change':
        return <Clock className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActivityColor = (action: string) => {
    switch (action) {
      case 'creation':
        return 'border-green-200 bg-green-50 text-green-700';
      case 'assignment':
        return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'upload':
        return 'border-purple-200 bg-purple-50 text-purple-700';
      case 'download':
        return 'border-orange-200 bg-orange-50 text-orange-700';
      case 'status_change':
        return 'border-yellow-200 bg-yellow-50 text-yellow-700';
      default:
        return 'border-gray-200 bg-gray-50 text-gray-700';
    }
  };

  const parseMetadata = (metadata: string | null) => {
    if (!metadata) return null;
    try {
      return JSON.parse(metadata);
    } catch {
      return null;
    }
  };

  if (isLoading) {
    return (
      <Card className={className} data-testid="activity-timeline-loading">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="border-l-2 border-gray-200 pl-4 py-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className} data-testid="activity-timeline-error">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Failed to load activity timeline</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid="activity-timeline">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Activity className="h-5 w-5 mr-2" />
          Activity
        </CardTitle>
        {activities.length > 0 && (
          <div className="text-sm text-gray-500">
            {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-6" data-testid="no-activities">
            <Activity className="h-8 w-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">No activities yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity, index) => {
              const metadata = parseMetadata(activity.metadata);
              const isLastItem = index === activities.length - 1;
              
              return (
                <div 
                  key={activity.id} 
                  className={`relative ${!isLastItem ? 'pb-4' : ''}`}
                  data-testid={`activity-${activity.action}-${activity.id}`}
                >
                  {/* Timeline Line */}
                  {!isLastItem && (
                    <div className="absolute left-3 top-8 bottom-0 w-0.5 bg-gray-200"></div>
                  )}
                  
                  {/* Activity Item */}
                  <div className="flex items-start space-x-3">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${getActivityColor(activity.action)}`}>
                      {getActivityIcon(activity.action, activity.category)}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-gray-900">
                          {activity.title}
                        </h4>
                        <time className="text-xs text-gray-500">
                          {format(new Date(activity.createdAt), 'MMM dd, h:mm a')}
                        </time>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-1">
                        {activity.description}
                      </p>
                      
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <User className="h-3 w-3" />
                        <span>{activity.userName}</span>
                        <Badge variant="outline" className="text-xs">
                          {activity.action.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      {/* Metadata Details */}
                      {metadata && (
                        <div className="mt-2 text-xs text-gray-500 space-y-1">
                          {metadata.fileName && (
                            <div>File: {metadata.fileName}</div>
                          )}
                          {metadata.fileSize && (
                            <div>Size: {(metadata.fileSize / 1024 / 1024).toFixed(2)} MB</div>
                          )}
                          {metadata.orderNumber && (
                            <div>Order: #{metadata.orderNumber}</div>
                          )}
                          {metadata.previousStatus && metadata.newStatus && (
                            <div>Status: {metadata.previousStatus} → {metadata.newStatus}</div>
                          )}
                          {metadata.editorEmail && (
                            <div>Editor: {metadata.editorEmail}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}