import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Activity, User, Upload, Download, FileText, CheckCircle, Clock, AlertCircle, UserPlus, ChevronDown, MessageSquare, Eye, Mail, Trash2, Edit, FolderPlus, Send } from "lucide-react";
import { format } from "date-fns";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, Query } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";

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
  const [isOpen, setIsOpen] = useState(true); // Default to open
  const { userData } = useAuth();

  useEffect(() => {
    // Don't subscribe if we don't have a jobId or orderId or partnerId
    if ((!jobId && !orderId) || !userData?.partnerId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Build Firestore query with filters
    let q: Query = collection(db, "activities");
    
    // CRITICAL: Filter by partnerId FIRST (required by security rules for queries)
    q = query(q, where("partnerId", "==", userData.partnerId));
    
    // Filter by jobId or orderId
    if (jobId) {
      q = query(q, where("jobId", "==", jobId));
    }
    if (orderId) {
      q = query(q, where("orderId", "==", orderId));
    }
    
    // Order by creation time (oldest first - so job creation is always first)
    q = query(q, orderBy("createdAt", "asc"));

    console.log("[ActivityTimeline] Subscribing with:", { 
      partnerId: userData.partnerId, 
      jobId, 
      orderId 
    });

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log("[ActivityTimeline] Received snapshot:", {
          docCount: snapshot.docs.length,
          jobId,
          orderId
        });

        const activitiesData: ActivityData[] = snapshot.docs
          .map(doc => {
            const data = doc.data();
            console.log("[ActivityTimeline] Activity doc:", {
              id: doc.id,
              jobId: data.jobId,
              title: data.title,
              createdAt: data.createdAt
            });
            
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
          })
          .filter(activity => {
            // Filter out folder visibility updated activities
            const title = activity.title?.toLowerCase() || '';
            return !title.includes('folder visibility updated');
          });
        
        console.log("[ActivityTimeline] Setting activities:", activitiesData);
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
  }, [jobId, orderId, userData?.partnerId]);

  const getActivityIcon = (action: string, category: string) => {
    switch (action) {
      case 'creation':
        return category === 'job' ? <CheckCircle className="h-4 w-4" /> :
               category === 'file' ? <FolderPlus className="h-4 w-4" /> :
               <FileText className="h-4 w-4" />;
      case 'assignment':
        return <UserPlus className="h-4 w-4" />;
      case 'submission':
        return <Send className="h-4 w-4" />;
      case 'upload':
        return <Upload className="h-4 w-4" />;
      case 'download':
        return <Download className="h-4 w-4" />;
      case 'status_change':
        return <Clock className="h-4 w-4" />;
      case 'comment':
        return <MessageSquare className="h-4 w-4" />;
      case 'read':
        return <Eye className="h-4 w-4" />;
      case 'notification':
        return <Mail className="h-4 w-4" />;
      case 'delete':
        return <Trash2 className="h-4 w-4" />;
      case 'update':
        return <Edit className="h-4 w-4" />;
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
      case 'submission':
        return 'border-teal-200 bg-teal-50 text-teal-700';
      case 'upload':
        return 'border-purple-200 bg-purple-50 text-purple-700';
      case 'download':
        return 'border-orange-200 bg-orange-50 text-orange-700';
      case 'status_change':
        return 'border-yellow-200 bg-yellow-50 text-yellow-700';
      case 'comment':
        return 'border-cyan-200 bg-cyan-50 text-cyan-700';
      case 'read':
        return 'border-indigo-200 bg-indigo-50 text-indigo-700';
      case 'notification':
        return 'border-pink-200 bg-pink-50 text-pink-700';
      case 'delete':
        return 'border-red-200 bg-red-50 text-red-700';
      case 'update':
        return 'border-amber-200 bg-amber-50 text-amber-700';
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
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={className} data-testid="activity-timeline">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Activity
                </CardTitle>
                {activities.length > 0 && (
                  <div className="text-sm text-gray-500">
                    {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
                  </div>
                )}
              </div>
              <ChevronDown
                className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
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
        </CollapsibleContent>
    </Card>
    </Collapsible>
  );
}