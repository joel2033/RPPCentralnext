import { useState } from "react";
import { Menu, Bell, Search, ChevronDown, User, LogOut, Building2, Check, Plus, Briefcase, Users, Package, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useMasterView } from "@/contexts/MasterViewContext";
import { useLocation, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useRealtimeNotifications, useRealtimeConversations } from "@/hooks/useFirestoreRealtime";
import SearchResults from "@/components/SearchResults";
import CreateJobModal from "@/components/modals/CreateJobModal";
import CreateCustomerModal from "@/components/modals/CreateCustomerModal";
import CreateProductModal from "@/components/modals/CreateProductModal";

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

interface HeaderProps {
  onMenuClick: () => void;
}

interface SavedSettings {
  businessProfile?: {
    businessName?: string;
  };
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { userData, logout, currentUser, userRole } = useAuth();
  const { 
    viewingPartnerId, 
    viewingPartnerName, 
    partners, 
    partnersLoading, 
    selectPartner,
    isMasterViewActive,
    isSwitchingBusiness,
    isViewingOwnBusiness
  } = useMasterView();
  const [, setLocation] = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showBusinessSelector, setShowBusinessSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showCreateJobModal, setShowCreateJobModal] = useState(false);
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);

  const isMaster = userRole === 'master';

  // Fetch business settings
  const { data: savedSettings } = useQuery<SavedSettings>({
    queryKey: ['/api/settings']
  });

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

  const handleClearAllNotifications = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to clear all notifications? This action cannot be undone.')) {
      await deleteAllNotificationsMutation.mutateAsync();
    }
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
      case 'master': return 'bg-amber-100 text-amber-800';
      case 'partner': return 'bg-rpp-red-lighter text-rpp-red-dark';
      case 'admin': return 'bg-rpp-red-lighter text-rpp-red-dark';
      case 'photographer': return 'bg-rpp-grey-bg text-rpp-grey-dark';
      default: return 'bg-rpp-grey-bg text-rpp-grey-dark';
    }
  };

  const getUserInitials = (email: string) => {
    return email?.split('@')[0]?.slice(0, 2)?.toUpperCase() || 'U';
  };

  return (
    <div className="fixed top-0 left-0 right-0 h-16 bg-white shadow-md z-30 lg:left-64">
      <div className="flex items-center justify-between h-full px-6">
        {/* Left Side - Search Bar */}
        <div className="flex items-center space-x-4 flex-1">
          {/* Mobile Menu Button */}
          <button 
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-rpp-grey-bg"
          >
            <Menu className="w-5 h-5 text-rpp-grey-dark" />
          </button>
          
          {/* Search Bar */}
          <div className="hidden md:block relative flex-1 max-w-xl">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search for jobs, people, orders or projects" 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(e.target.value.trim().length > 0);
                }}
                onFocus={() => {
                  if (searchQuery.trim().length > 0) {
                    setShowSearchResults(true);
                  }
                }}
                className="w-full px-4 py-2 pl-10 bg-transparent rounded-lg focus:outline-none border border-gray-200"
                style={{ borderColor: 'rgba(230, 232, 234, 1)' }}
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-rpp-grey-light" />
            </div>
            {showSearchResults && (
              <SearchResults
                query={searchQuery}
                isOpen={showSearchResults}
                onClose={() => setShowSearchResults(false)}
              />
            )}
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center space-x-4">

          {/* Business Selector - Master Role Only */}
          {isMaster && (
            <DropdownMenu open={showBusinessSelector} onOpenChange={setShowBusinessSelector} modal={false}>
              <DropdownMenuTrigger asChild>
                <button 
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-all duration-200 ${
                    isSwitchingBusiness 
                      ? 'border-amber-400 bg-amber-100 cursor-wait' 
                      : 'border-amber-300 bg-amber-50 hover:bg-amber-100'
                  }`}
                  data-testid="button-business-selector"
                  disabled={isSwitchingBusiness}
                >
                  {isSwitchingBusiness ? (
                    <div className="w-4 h-4 rounded-full border-2 border-amber-300 border-t-amber-600 animate-spin" />
                  ) : (
                    <Building2 className="w-4 h-4 text-amber-600" />
                  )}
                  <span className="text-sm font-medium text-amber-800 max-w-[200px] truncate">
                    {partnersLoading ? 'Loading...' : (viewingPartnerName || 'Select Business')}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-amber-600 transition-transform ${isSwitchingBusiness ? 'opacity-50' : ''}`} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72 max-h-96 overflow-y-auto" align="end" sideOffset={5}>
                <div className="px-3 py-2 border-b bg-amber-50">
                  <h4 className="text-sm font-semibold text-amber-800">
                    Viewing as Master
                  </h4>
                  <p className="text-xs text-amber-600">
                    Select a business to view (read-only)
                  </p>
                </div>
                {partnersLoading ? (
                  <div className="px-3 py-4 text-center text-sm text-gray-500">
                    Loading businesses...
                  </div>
                ) : partners.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-gray-500">
                    No businesses found
                  </div>
                ) : (
                  partners.map((partner) => (
                    <DropdownMenuItem
                      key={partner.partnerId}
                      className={`flex items-center justify-between px-3 py-2.5 cursor-pointer ${
                        viewingPartnerId === partner.partnerId 
                          ? 'bg-amber-100' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        selectPartner(partner.partnerId);
                        setShowBusinessSelector(false);
                        // Invalidate all queries to refetch with new partnerId
                        queryClient.invalidateQueries();
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">
                          {partner.partnerId === userData?.partnerId
                            ? `${partner.businessName} (My Franchise)`
                            : partner.businessName}
                        </span>
                        <span className="text-xs text-gray-500">
                          {partner.email}
                        </span>
                      </div>
                      {viewingPartnerId === partner.partnerId && (
                        <Check className="w-4 h-4 text-amber-600" />
                      )}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Quick Create Button */}
          <DropdownMenu open={showCreateMenu} onOpenChange={setShowCreateMenu} modal={false}>
            <DropdownMenuTrigger asChild>
              <button 
                className="relative p-2 rounded-lg hover:bg-rpp-grey-bg flex-shrink-0"
                data-testid="button-quick-create"
                aria-expanded={showCreateMenu}
              >
                <Plus className="w-5 h-5 text-rpp-grey-dark" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 z-[100]" align="end" sideOffset={5}>
              <div className="px-3 py-2 border-b">
                <h4 className="text-sm font-medium">Quick Create</h4>
              </div>
              <DropdownMenuItem
                className="flex items-center cursor-pointer"
                onClick={() => {
                  setShowCreateJobModal(true);
                  setShowCreateMenu(false);
                }}
              >
                <Briefcase className="mr-2 h-4 w-4" />
                New Job
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center cursor-pointer"
                onClick={() => {
                  setShowCreateCustomerModal(true);
                  setShowCreateMenu(false);
                }}
              >
                <Users className="mr-2 h-4 w-4" />
                New Customer
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center cursor-pointer"
                onClick={() => {
                  setShowCreateProductModal(true);
                  setShowCreateMenu(false);
                }}
              >
                <Package className="mr-2 h-4 w-4" />
                New Product
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications */}
          <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications} modal={false}>
            <DropdownMenuTrigger asChild>
              <button 
                className="relative p-2 rounded-lg hover:bg-rpp-grey-bg flex-shrink-0"
                data-testid="button-notifications"
                aria-expanded={showNotifications}
              >
                <Bell className="w-5 h-5 text-rpp-grey-dark" />
                {unreadCount > 0 && (
                  <Badge 
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs font-bold bg-red-500 text-white border-2 border-white shadow-lg"
                    data-testid="badge-unread-count"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 max-h-[500px] flex flex-col z-[100]" align="end" sideOffset={5}>
              <div className="px-3 py-2 border-b flex items-center justify-between flex-shrink-0">
                <h4 className="text-sm font-medium" data-testid="text-notifications-title">
                  Notifications
                </h4>
                {notifications.length > 0 && (
                  <button
                    onClick={handleClearAllNotifications}
                    className="text-xs text-rpp-grey-light hover:text-rpp-grey-dark flex items-center gap-1 px-2 py-1 rounded hover:bg-rpp-grey-bg"
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
                  <div className="px-3 py-4 text-center text-sm text-rpp-grey-light" data-testid="text-no-notifications">
                    No notifications
                  </div>
                ) : (
                  notifications.map((notification: any) => (
                    <DropdownMenuItem
                      key={notification.id}
                      className="relative flex select-none items-center gap-2 rounded-sm text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 px-3 py-3 cursor-pointer bg-[#f0f1f2]"
                      onClick={() => handleNotificationClick(notification)}
                      data-testid={`notification-item-${notification.id}`}
                    >
                      <div className="w-full">
                        <div className="flex items-center justify-between mb-1">
                          <h5 className="text-sm font-medium text-rpp-grey-dark" data-testid={`text-notification-title-${notification.id}`}>
                            {notification.title}
                          </h5>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-rpp-red-main rounded-full" data-testid={`indicator-unread-${notification.id}`}></div>
                          )}
                        </div>
                        <p className="text-xs text-rpp-grey-medium mb-2" data-testid={`text-notification-body-${notification.id}`}>
                          {notification.body}
                        </p>
                        <p className="text-xs text-rpp-grey-light" data-testid={`text-notification-time-${notification.id}`}>
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
                    className="w-full px-3 py-2 text-sm text-rpp-red-main hover:bg-rpp-grey-bg text-center font-medium"
                    data-testid="button-mark-all-read"
                  >
                    Mark all as read
                  </button>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile Dropdown */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center space-x-3 p-2 rounded-lg hover:bg-rpp-grey-bg">
                <div className="w-8 h-8 bg-rpp-red-main rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {userData ? getUserInitials(userData.email) : 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium text-rpp-grey-dark">
                    {savedSettings?.businessProfile?.businessName || userData?.email || 'User'}
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-rpp-grey-light" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <div className="px-3 py-2 border-b">
                <p className="text-sm font-medium">{userData?.email}</p>
                <p className={`text-xs capitalize ${isMaster ? 'text-amber-600 font-medium' : 'text-rpp-grey-light'}`}>
                  {isMaster ? 'Master (Franchisor)' : `${userData?.role} Account`}
                </p>
              </div>
              <DropdownMenuItem asChild>
                <Link href="/settings#account" className="flex items-center cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Account Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings#company" className="flex items-center cursor-pointer">
                  <Building2 className="mr-2 h-4 w-4" />
                  Business Settings
                </Link>
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

      {/* Modals */}
      {showCreateJobModal && (
        <CreateJobModal onClose={() => setShowCreateJobModal(false)} />
      )}
      {showCreateCustomerModal && (
        <CreateCustomerModal onClose={() => setShowCreateCustomerModal(false)} />
      )}
      {showCreateProductModal && (
        <CreateProductModal onClose={() => setShowCreateProductModal(false)} />
      )}
    </div>
  );
}