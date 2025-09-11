import { useState } from "react";
import { Menu, Bell, Search, ChevronDown, User, LogOut } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";

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
  createdAt: string;
  readAt?: string | null;
}

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { userData, logout, currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);

  // Fetch notifications
  const { data: notifications = [], isLoading, error } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    enabled: !!currentUser,
    refetchInterval: 8000 // Poll every 8 seconds for near real-time updates
  });

  // Calculate unread count
  const unreadCount = notifications.filter((notification) => !notification.read).length;

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

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.read) {
      await markAsReadMutation.mutateAsync(notification.id);
    }

    // Navigate based on notification type and context
    if (notification.orderId) {
      setLocation(`/jobs/${notification.jobId || notification.orderId}`);
    } else if (notification.jobId) {
      setLocation(`/jobs/${notification.jobId}`);
    }

    setShowNotifications(false);
  };

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await markAllAsReadMutation.mutateAsync();
  };

  const handleLogout = async () => {
    try {
      await logout();
      setLocation('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'partner': return 'bg-purple-100 text-purple-800';
      case 'admin': return 'bg-red-100 text-red-800';
      case 'photographer': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUserInitials = (email: string) => {
    return email?.split('@')[0]?.slice(0, 2)?.toUpperCase() || 'U';
  };

  return (
    <div className="fixed top-0 left-0 right-0 h-16 bg-white shadow-md z-30 lg:left-64">
      <div className="flex items-center justify-between h-full px-6">
        {/* Left Side */}
        <div className="flex items-center space-x-4">
          {/* Mobile Menu Button */}
          <button 
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            <Menu className="w-5 h-5 text-rpp-grey-dark" />
          </button>
          {/* Page Title */}
          <h1 className="text-xl font-semibold text-rpp-grey-dark">Dashboard</h1>
        </div>

        {/* Right Side */}
        <div className="flex items-center space-x-4">
          {/* Search Bar */}
          <div className="hidden md:block relative">
            <input 
              type="text" 
              placeholder="Search for jobs, people, orders or projects" 
              className="w-80 px-4 py-2 border border-rpp-grey-border rounded-lg focus:outline-none focus:ring-2 focus:ring-rpp-red-main"
            />
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-rpp-grey-light" />
          </div>

          {/* Notifications */}
          <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications}>
            <DropdownMenuTrigger asChild>
              <button 
                className="relative p-2 rounded-lg hover:bg-gray-100"
                data-testid="button-notifications"
                aria-expanded={showNotifications}
              >
                <Bell className="w-5 h-5 text-rpp-grey-dark" />
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                    data-testid="badge-unread-count"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 max-h-96 overflow-y-auto" align="end">
              <div className="px-3 py-2 border-b">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium" data-testid="text-notifications-title">
                    Notifications
                  </h4>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-xs text-rpp-red-main hover:text-rpp-red-dark"
                      data-testid="button-mark-all-read"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
              </div>
              {notifications.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-gray-500" data-testid="text-no-notifications">
                  No notifications yet
                </div>
              ) : (
                notifications.slice(0, 10).map((notification: any) => (
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
                          <div className="w-2 h-2 bg-blue-500 rounded-full" data-testid={`indicator-unread-${notification.id}`}></div>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mb-2" data-testid={`text-notification-body-${notification.id}`}>
                        {notification.body}
                      </p>
                      <p className="text-xs text-gray-400" data-testid={`text-notification-time-${notification.id}`}>
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
              {notifications.length > 10 && (
                <DropdownMenuItem 
                  className="px-3 py-2 text-center text-sm text-rpp-red-main cursor-pointer"
                  onClick={() => {
                    setLocation('/notifications');
                    setShowNotifications(false);
                  }}
                  data-testid="link-view-all-notifications"
                >
                  View all notifications
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100">
                <div className="w-8 h-8 bg-rpp-red-main rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {userData ? getUserInitials(userData.email) : 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium text-rpp-grey-dark">
                    {userData?.email || 'User'}
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={`text-xs mt-1 ${userData ? getRoleColor(userData.role) : 'bg-gray-100 text-gray-800'}`}
                  >
                    {userData?.role || 'Unknown'}
                  </Badge>
                </div>
                <ChevronDown className="w-4 h-4 text-rpp-grey-light" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <div className="px-3 py-2 border-b">
                <p className="text-sm font-medium">{userData?.email}</p>
                <p className="text-xs text-rpp-grey-light capitalize">{userData?.role} Account</p>
              </div>
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Account Settings
              </DropdownMenuItem>
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Business Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}