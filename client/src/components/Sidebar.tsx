import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useMasterView } from "@/contexts/MasterViewContext";
import { useRealtimeConversations } from "@/hooks/useFirestoreRealtime";
import {
  Home,
  Users,
  Calendar,
  Camera,
  Edit,
  Folder,
  BarChart3,
  Box,
  Upload,
  ClipboardList,
  LogOut,
  ChevronDown,
  Handshake,
  Settings,
  UserPlus,
  MessageSquare
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  title: string;
  icon: React.ComponentType<any>;
  path?: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  { title: "Dashboard", icon: Home, path: "/" },
  { title: "Customers", icon: Users, path: "/customers" },
  { title: "Calendar", icon: Calendar, path: "/calendar" },
  { title: "Jobs", icon: Camera, path: "/jobs" },
  {
    title: "Production Hub",
    icon: Folder,
    children: [
      { title: "Upload to Editor", icon: Upload, path: "/upload" },
      { title: "Order Status", icon: ClipboardList, path: "/orders" },
    ],
  },
  {
    title: "Reports",
    icon: BarChart3,
    children: [
      { title: "Job Reports", icon: BarChart3, path: "/reports/jobs" },
      { title: "Revenue Overview", icon: BarChart3, path: "/reports/revenue" },
      { title: "Performance", icon: BarChart3, path: "/reports/performance" },
    ],
  },
  {
    title: "Products",
    icon: Box,
    children: [
      { title: "Product Management", icon: Box, path: "/products" },
    ],
  },
  { title: "Messages", icon: MessageSquare, path: "/messages" },
  { title: "Settings", icon: Settings, path: "/settings" },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const { logout, currentUser, userData } = useAuth();
  const { isMaster, isViewingOwnBusiness } = useMasterView();

  // Real-time unread message count from conversations
  const { unreadCount, loading: conversationsLoading } = useRealtimeConversations(
    currentUser?.uid || null,
    userData?.partnerId
  );

  // Only show badge when user is authenticated and data is loaded
  const showUnreadBadge = currentUser && !conversationsLoading && unreadCount > 0;

  // Filter menu items based on user role
  // Master users have restricted access - NO Production Hub, Messages, Settings
  const getFilteredMenuItems = () => {
    // When master is viewing their own business, treat them like a normal partner
    if (isMaster && !isViewingOwnBusiness) {
      return menuItems.filter(item => 
        item.title === "Dashboard" ||
        item.title === "Customers" ||
        item.title === "Calendar" ||
        item.title === "Jobs" ||
        item.title === "Reports" ||
        item.title === "Products"
        // Excluded: Production Hub, Messages, Settings
      );
    }
    if (userData?.role === 'photographer') {
      return menuItems.filter(item => 
        item.title === "Dashboard" ||
        item.title === "Customers" ||
        item.title === "Calendar" ||
        item.title === "Jobs" ||
        item.title === "Production Hub" ||
        item.title === "Messages" ||
        item.title === "Settings"
      );
    }
    return menuItems;
  };
  
  const filteredMenuItems = getFilteredMenuItems();

  const toggleMenu = (title: string) => {
    setExpandedMenus(prev => 
      prev.includes(title) 
        ? prev.filter(item => item !== title)
        : [...prev, title]
    );
  };

  const isActive = (path: string) => {
    return location === path;
  };

  const handleSignOut = async () => {
    try {
      await logout();
      setLocation('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const renderMenuItem = (item: MenuItem) => {
    const Icon = item.icon;
    const isExpanded = expandedMenus.includes(item.title);

    if (item.children) {
      return (
        <li key={item.title}>
          <div className="collapsible-menu">
            <button
              onClick={() => toggleMenu(item.title)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-full hover:bg-rpp-grey-bg transition-all duration-200 text-rpp-grey-dark"
            >
              <div className="flex items-center">
                <Icon className="w-5 h-5 mr-3" />
                <span className="font-medium">{item.title}</span>
              </div>
              <ChevronDown 
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              />
            </button>
            <div 
              className={`collapsible-content overflow-hidden transition-all duration-300 ${
                isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <ul className="ml-8 mt-2 space-y-1">
                {item.children.map((child) => (
                  <li key={child.title}>
                    <Link
                      href={child.path!}
                      onClick={onClose}
                      className={`nav-item block px-4 py-3 text-sm rounded-full transition-all duration-200 ${
                        isActive(child.path!) ? 'active' : 'text-rpp-grey-dark hover:bg-rpp-grey-bg'
                      }`}
                    >
                      {child.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </li>
      );
    }

    return (
      <li key={item.title}>
        <Link
          href={item.path!}
          onClick={onClose}
          className={`nav-item flex items-center justify-between px-4 py-3 rounded-full transition-all duration-200 ${
            isActive(item.path!) ? 'active' : 'text-rpp-grey-dark hover:bg-rpp-grey-bg'
          }`}
          data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <div className="flex items-center">
            <Icon className="w-5 h-5 mr-3" />
            <span className="font-medium">{item.title}</span>
          </div>
          {item.title === "Messages" && showUnreadBadge && (
            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-200 text-black text-xs font-bold rounded-full border-2 border-red-600 shadow-sm">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <div className={`fixed left-0 top-0 h-full w-64 bg-white shadow-lg z-50 transform ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    } lg:translate-x-0 sidebar-transition`}>
      <div className="flex flex-col h-full">
        {/* Logo Header */}
        <div className="p-6 border-b border-rpp-grey-border">
          <div className="flex items-center justify-center">
            <img 
              src="/assets/rpp-logo.png" 
              alt="Real Property Photography" 
              className="h-12 w-auto object-contain"
              data-testid="sidebar-logo"
            />
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-3">
            {filteredMenuItems.map(renderMenuItem)}
          </ul>
        </nav>

        {/* Sign Out */}
        <div className="p-4 border-t border-rpp-grey-border">
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center px-3 py-2 text-left rounded-lg hover:bg-rpp-grey-bg transition-colors text-rpp-grey-dark"
          >
            <LogOut className="w-5 h-5 mr-3" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

