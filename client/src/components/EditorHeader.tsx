import { useState } from "react";
import { Menu, Bell, Search, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useEditorAuth } from "@/contexts/EditorAuthContext";
import { useMutation } from "@tanstack/react-query";
import { getAuth } from "firebase/auth";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useRealtimeNotifications, useRealtimeConversations } from "@/hooks/useFirestoreRealtime";

const auth = getAuth();

interface Notification {
  id: string;
  partnerId: string;
  recipientId: string;
  type: string;
  title: string;
  body: string;
  orderId?: string;
  jobId?: string;
  read: boolean;
  createdAt: Date | null;
  readAt?: Date | null;
}

interface EditorHeaderProps {
  onMenuClick: () => void;
}

export default function EditorHeader({ onMenuClick }: EditorHeaderProps) {
  const { userData } = useEditorAuth();
  const currentUser = auth.currentUser;
  const [, setLocation] = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);

  // Real-time notifications from Firestore
  const { notifications = [], unreadCount: unreadNotificationsCount } = useRealtimeNotifications(
    currentUser?.uid || null
  );

  // Real-time unread message count from conversations
  const { unreadCount: unreadMessagesCount } = useRealtimeConversations(
    currentUser?.uid || null,
    userData?.partnerId
  );

  // Calculate total unread count (notifications + messages)
  const unreadCount = unreadNotificationsCount + unreadMessagesCount;

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest(`/api/notifications/${notificationId}/read`, 'PATCH', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  // Mark all notifications as read mutation  
  const markAllAsReadMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/notifications/mark-all-read', 'POST', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  // Delete all notifications mutation
  const deleteAllNotificationsMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/notifications/delete-all', 'DELETE', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.read) {
      await markAsReadMutation.mutateAsync(notification.id);
    }

    // Navigate based on notification type and context
    if (notification.orderId) {
      setLocation(`/editor/jobs/${notification.jobId || notification.orderId}`);
    } else if (notification.jobId) {
      setLocation(`/editor/jobs/${notification.jobId}`);
    }

    setShowNotifications(false);
  };

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await markAllAsReadMutation.mutateAsync();
  };

  const handleClearAllNotifications = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to clear all notifications? This action cannot be undone.')) {
      await deleteAllNotificationsMutation.mutateAsync();
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-30 lg:left-64">
      <div className="flex items-center justify-between h-full px-6">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          onClick={onMenuClick}
          data-testid="button-mobile-menu"
        >
          <Menu className="w-5 h-5" />
        </Button>

        {/* Search Bar */}
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search jobs, customers, or files..."
              className="pl-10 bg-gray-50 border-gray-300"
              data-testid="input-search"
            />
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="relative flex-shrink-0"
                data-testid="button-notifications"
                aria-expanded={showNotifications}
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                  <Badge 
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-red-500 text-white"
                    data-testid="badge-unread-count"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 max-h-[500px] flex flex-col" align="end" sideOffset={5}>
              <div className="px-3 py-2 border-b flex items-center justify-between flex-shrink-0">
                <h4 className="text-sm font-medium" data-testid="text-notifications-title">
                  Notifications
                </h4>
                {notifications.length > 0 && (
                  <button
                    onClick={handleClearAllNotifications}
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100"
                    data-testid="button-clear-all-notifications"
                    title="Clear all notifications"
                  >
                    <X className="w-3 h-3" />
                    Clear all
                  </button>
                )}
              </div>
              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-gray-500" data-testid="text-no-notifications">
                    No notifications
                  </div>
                ) : (
                  notifications.map((notification: any) => (
                    <DropdownMenuItem
                      key={notification.id}
                      className={`px-3 py-3 cursor-pointer ${!notification.read ? 'bg-blue-50' : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                      data-testid={`notification-item-${notification.id}`}
                    >
                      <div className="w-full">
                        <div className="flex items-center justify-between mb-1">
                          <h5 className="text-sm font-medium text-gray-900" data-testid={`text-notification-title-${notification.id}`}>
                            {notification.title}
                          </h5>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-red-500 rounded-full" data-testid={`indicator-unread-${notification.id}`}></div>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mb-2" data-testid={`text-notification-body-${notification.id}`}>
                          {notification.body}
                        </p>
                        <p className="text-xs text-gray-400" data-testid={`text-notification-time-${notification.id}`}>
                          {notification.createdAt ? notification.createdAt.toLocaleString() : ''}
                        </p>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
              {unreadCount > 0 && (
                <div className="border-t flex-shrink-0">
                  <button
                    onClick={handleMarkAllAsRead}
                    className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-gray-50 text-center font-medium"
                    data-testid="button-mark-all-read"
                  >
                    Mark all as read
                  </button>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div className="hidden md:block text-sm">
              <p className="font-medium text-gray-900">{userData?.email}</p>
              <p className="text-gray-500">Editor</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}