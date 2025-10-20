import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { 
  Bell, 
  AlertCircle, 
  MessageSquare, 
  Clock, 
  CheckCircle2,
  ChevronRight,
  Image as ImageIcon,
  Calendar
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
    unread: true,
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
  {
    id: '5',
    type: 'notification',
    title: 'Payment Received',
    description: 'John Smith completed payment for recent project',
    time: '1 day ago',
    priority: 'low',
    unread: false,
  },
  {
    id: '6',
    type: 'revision',
    title: 'Revision Completed',
    description: 'Your edits have been uploaded and sent to client',
    time: '2 days ago',
    priority: 'low',
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
      return AlertCircle;
  }
};

const getPriorityColor = (priority: AttentionItem['priority']) => {
  switch (priority) {
    case 'high':
      return 'bg-primary/10 text-primary border-primary/20';
    case 'medium':
      return 'bg-muted text-muted-foreground border-border';
    case 'low':
      return 'bg-secondary text-secondary-foreground border-border';
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
    <Card className="border-border/50 shadow-lg shadow-black/5 rounded-2xl overflow-hidden">
      <CardHeader className="border-b border-border/50 bg-gradient-to-br from-card to-muted/20 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 ring-1 ring-primary/20 shadow-sm flex items-center justify-center">
              <Bell className="w-4 h-4 text-primary drop-shadow-sm" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                Needs Your Attention
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="rounded-full h-4 min-w-4 px-1.5 text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Stay on top of your important tasks
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="rounded-xl text-xs h-8 px-3">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[380px]">
          <div className="divide-y divide-border/50">
            {attentionItems.map((item) => {
              const Icon = getIcon(item.type);
              return (
                <div
                  key={item.id}
                  className={`p-3 hover:bg-muted/30 transition-colors cursor-pointer group relative ${
                    item.unread ? 'bg-primary/5' : ''
                  }`}
                >
                  {item.unread && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                  )}
                  
                  <div className="flex gap-2.5 pl-1.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${
                      item.type === 'revision' ? 'bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 ring-1 ring-primary/20' :
                      item.type === 'approval' ? 'bg-gradient-to-br from-emerald-500/20 via-emerald-500/15 to-emerald-500/10 ring-1 ring-emerald-500/20' :
                      item.type === 'deadline' ? 'bg-gradient-to-br from-amber-500/20 via-amber-500/15 to-amber-500/10 ring-1 ring-amber-500/20' :
                      'bg-gradient-to-br from-muted via-muted/80 to-muted/60 ring-1 ring-border/50'
                    }`}>
                      <Icon className={`w-4 h-4 ${
                        item.type === 'revision' ? 'text-primary drop-shadow-sm' :
                        item.type === 'approval' ? 'text-emerald-600 drop-shadow-sm' :
                        item.type === 'deadline' ? 'text-amber-600 drop-shadow-sm' :
                        'text-muted-foreground'
                      }`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <h4 className={`text-sm mb-0 ${item.unread ? 'font-semibold' : ''}`}>
                          {item.title}
                        </h4>
                        <Badge 
                          variant="outline" 
                          className={`text-xs flex-shrink-0 h-5 ${getPriorityColor(item.priority)}`}
                        >
                          {getPriorityLabel(item.priority)}
                        </Badge>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mb-1.5">
                        {item.description}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                        
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2 rounded-lg text-xs"
                        >
                          View
                          <ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <Separator />
        
        <div className="p-3 bg-muted/20">
          <Button 
            variant="outline" 
            className="w-full rounded-xl border-border/50 hover:border-primary/50 h-9 text-sm"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Mark All as Read
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
