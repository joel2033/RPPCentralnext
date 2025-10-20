import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Bell, 
  MessageSquare, 
  Clock, 
  CheckCircle2,
  Image as ImageIcon,
} from "lucide-react";

interface AttentionItem {
  id: string;
  type: 'revision' | 'notification' | 'approval' | 'deadline';
  title: string;
  description: string;
  time: string;
  priority: 'high' | 'medium' | 'low';
  projectName?: string;
  unread?: boolean;
}

const attentionItems: AttentionItem[] = [
  {
    id: '1',
    type: 'revision',
    title: 'Revision Request - Kitchen Photo',
    description: 'Client requested brightness adjustment on image #4',
    time: '2 hours ago',
    priority: 'high',
    projectName: '123 Main St',
    unread: true,
  },
  {
    id: '2',
    type: 'approval',
    title: 'Photos Ready for Review',
    description: '24 photos edited and ready for client approval',
    time: '3 hours ago',
    priority: 'medium',
    projectName: '456 Oak Avenue',
    unread: false,
  },
  {
    id: '3',
    type: 'revision',
    title: 'Revision Request - Living Room',
    description: 'Client wants to tone down countertop reflection',
    time: '5 hours ago',
    priority: 'high',
    projectName: '789 Pine Road',
    unread: true,
  },
  {
    id: '4',
    type: 'deadline',
    title: 'Upcoming Deadline',
    description: 'Drone shoot scheduled for tomorrow at 10 AM',
    time: '1 day',
    priority: 'medium',
    projectName: '321 Elm Street',
    unread: false,
  },
];

const getIcon = (type: AttentionItem['type']) => {
  switch (type) {
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

export function NeedsAttention() {
  const unreadCount = attentionItems.filter(item => item.unread).length;

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
          <Button variant="ghost" size="sm" className="text-sm font-semibold text-rpp-red-main hover:bg-rpp-red-lighter rounded-xl">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="divide-y divide-border/50">
            {attentionItems.map((item) => {
              const Icon = getIcon(item.type);
              return (
                <div
                  key={item.id}
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
                      item.type === 'revision' ? 'bg-gradient-to-br from-rpp-red-lighter to-rpp-red-light' :
                      item.type === 'approval' ? 'bg-gradient-to-br from-support-green/20 to-support-green/10' :
                      item.type === 'deadline' ? 'bg-gradient-to-br from-amber-100 to-amber-50' :
                      'bg-gradient-to-br from-muted to-muted/60'
                    }`}>
                      <Icon className={`w-4 h-4 ${
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
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {item.time}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <Separator />
        
        <div className="p-4">
          <Button 
            variant="outline" 
            className="w-full rounded-xl border-border/50 hover:border-rpp-red-main/50 hover:bg-rpp-red-lighter h-10 text-sm font-semibold"
            data-testid="button-mark-all-read"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Mark All as Read
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
