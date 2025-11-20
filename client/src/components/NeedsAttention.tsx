import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell,
  MessageSquare,
  Clock,
  CheckCircle2,
  Image as ImageIcon,
  Package,
  Loader2,
} from "lucide-react";
import { useLocation } from "wouter";
import { useRealtimeAttentionItems } from "@/hooks/useFirestoreRealtime";
import { useAuth } from "@/contexts/AuthContext";
import { getAuth } from "firebase/auth";

const auth = getAuth();

interface AttentionItem {
  id: string;
  type: 'order_completed' | 'message' | 'revision' | 'notification' | 'approval' | 'deadline';
  title: string;
  description: string;
  time: string | Date;
  priority: 'high' | 'medium' | 'low';
  projectName?: string;
  unread?: boolean;
  orderId?: string;
  jobId?: string;
  orderNumber?: string;
  conversationId?: string;
  unreadCount?: number;
}

const getIcon = (type: AttentionItem['type']) => {
  switch (type) {
    case 'order_completed':
      return Package;
    case 'message':
      return MessageSquare;
    case 'revision':
      return MessageSquare;
    case 'notification':
      return Bell;
    case 'approval':
      return CheckCircle2;
    case 'deadline':
      return Clock;
    default:
      return Bell;
  }
};

const getPriorityColor = (priority: AttentionItem['priority']) => {
  switch (priority) {
    case 'high':
      return 'bg-rpp-red-lighter text-rpp-red-main border-rpp-red-light';
    case 'medium':
      return 'bg-support-green/10 text-support-green border-support-green/20';
    case 'low':
      return 'bg-muted text-muted-foreground border-border';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

const getPriorityLabel = (priority: AttentionItem['priority']) => {
  switch (priority) {
    case 'high':
      return 'Urgent';
    case 'medium':
      return 'Normal';
    case 'low':
      return 'Low';
    default:
      return 'Normal';
  }
};

const formatTimeAgo = (date: string | Date): string => {
  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  const diffInMs = now.getTime() - then.getTime();
  const diffInMinutes = Math.floor(diffInMs / 60000);
  const diffInHours = Math.floor(diffInMs / 3600000);
  const diffInDays = Math.floor(diffInMs / 86400000);

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  return then.toLocaleDateString();
};

export function NeedsAttention() {
  const [, setLocation] = useLocation();
  const { userData } = useAuth();
  const currentUser = auth.currentUser;

  // Get real-time attention items (no polling needed!)
  const { attentionItems = [], loading: isLoading } = useRealtimeAttentionItems(
    currentUser?.uid || null,
    userData?.partnerId || null
  );

  const unreadCount = attentionItems.filter(item => item.unread).length;

  const handleItemClick = (item: AttentionItem) => {
    if (item.type === 'order_completed' && item.jobId) {
      // Navigate to delivery page for completed orders
      setLocation(`/delivery/${item.jobId}`);
    } else if (item.type === 'message' && item.conversationId) {
      // Navigate to messages page
      setLocation('/messages');
    }
  };

  return (
    <Card className="bg-white border-0 rounded-3xl shadow-rpp-card overflow-hidden">
      <CardHeader className="p-6 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rpp-red-lighter to-rpp-red-light flex items-center justify-center">
              <Bell className="w-5 h-5 text-rpp-red-main" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2.5 text-base font-bold text-rpp-grey-dark">
                Needs Your Attention
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="rounded-full h-5 min-w-5 px-1.5 text-xs font-bold">
                    {unreadCount}
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-rpp-grey-medium mt-1">
                Stay on top of your important tasks
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-rpp-grey-medium" />
            </div>
          ) : attentionItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <CheckCircle2 className="w-12 h-12 text-support-green mb-3" />
              <p className="text-sm font-medium text-rpp-grey-dark">All caught up!</p>
              <p className="text-xs text-rpp-grey-medium mt-1">No items need your attention right now.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {attentionItems.map((item) => {
                const Icon = getIcon(item.type);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-4 hover:bg-rpp-grey-bg/50 transition-colors cursor-pointer relative ${
                      item.unread ? 'bg-rpp-red-lighter/20' : ''
                    }`}
                    data-testid={`attention-item-${item.id}`}
                  >
                    {item.priority === 'high' && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-rpp-red-main rounded-r-full" />
                    )}

                    <div className="flex gap-3 pl-2">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        item.type === 'order_completed' ? 'bg-gradient-to-br from-support-green/20 to-support-green/10' :
                        item.type === 'message' ? 'bg-gradient-to-br from-blue-100 to-blue-50' :
                        item.type === 'revision' ? 'bg-gradient-to-br from-rpp-red-lighter to-rpp-red-light' :
                        item.type === 'approval' ? 'bg-gradient-to-br from-support-green/20 to-support-green/10' :
                        item.type === 'deadline' ? 'bg-gradient-to-br from-amber-100 to-amber-50' :
                        'bg-gradient-to-br from-muted to-muted/60'
                      }`}>
                        <Icon className={`w-4 h-4 ${
                          item.type === 'order_completed' ? 'text-support-green' :
                          item.type === 'message' ? 'text-blue-600' :
                          item.type === 'revision' ? 'text-rpp-red-main' :
                          item.type === 'approval' ? 'text-support-green' :
                          item.type === 'deadline' ? 'text-amber-600' :
                          'text-muted-foreground'
                        }`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className={`text-sm text-rpp-grey-dark ${item.unread ? 'font-semibold' : 'font-medium'}`}>
                            {item.title}
                          </h4>
                          <Badge
                            variant="outline"
                            className={`text-xs flex-shrink-0 h-5 font-semibold ${getPriorityColor(item.priority)}`}
                          >
                            {getPriorityLabel(item.priority)}
                          </Badge>
                        </div>

                        <p className="text-xs text-rpp-grey-medium mb-2">
                          {item.description}
                        </p>

                        <div className="flex items-center gap-2 text-xs text-rpp-grey-light">
                          {item.projectName && (
                            <>
                              <span className="flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" />
                                {item.projectName}
                              </span>
                              <span>•</span>
                            </>
                          )}
                          {item.orderNumber && (
                            <>
                              <span className="flex items-center gap-1">
                                <Package className="w-3 h-3" />
                                {item.orderNumber}
                              </span>
                              <span>•</span>
                            </>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimeAgo(item.time)}
                          </span>
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
