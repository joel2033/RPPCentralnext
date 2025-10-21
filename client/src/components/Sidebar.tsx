import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
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
  { title: "Team Members", icon: Users, path: "/team" },
  { title: "Messages", icon: MessageSquare, path: "/messages" },
  { title: "Settings", icon: Settings, path: "/settings" },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const { logout } = useAuth();

  // Fetch unread message count
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/conversations/unread-count"],
    refetchInterval: 5000, // Poll every 5 seconds for updates
  });

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
              className="group/btn w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-gradient-to-r hover:from-rpp-red-palest hover:to-transparent transition-smooth text-rpp-grey-dark hover:text-rpp-red-dark"
            >
              <div className="flex items-center">
                <Icon className="w-5 h-5 mr-3 group-hover/btn:scale-110 transition-smooth" />
                <span className="font-semibold">{item.title}</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-smooth ${isExpanded ? 'rotate-180' : ''}`}
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
                      className={`nav-item group/link block px-4 py-3 text-sm rounded-2xl transition-smooth relative overflow-hidden ${
                        isActive(child.path!) ? 'active' : 'text-rpp-grey-dark hover:bg-gradient-to-r hover:from-rpp-red-palest/60 hover:to-transparent hover:text-rpp-red-dark'
                      }`}
                    >
                      <span className="relative z-10 font-medium">{child.title}</span>
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
          className={`nav-item group/link flex items-center justify-between px-4 py-3 rounded-2xl transition-smooth relative overflow-hidden ${
            isActive(item.path!) ? 'active' : 'text-rpp-grey-dark hover:bg-gradient-to-r hover:from-rpp-red-palest hover:to-transparent hover:text-rpp-red-dark'
          }`}
          data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <div className="flex items-center relative z-10">
            <Icon className="w-5 h-5 mr-3 group-hover/link:scale-110 transition-smooth" />
            <span className="font-semibold">{item.title}</span>
          </div>
          {item.title === "Messages" && unreadData && unreadData.count > 0 && (
            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-gradient-to-br from-rpp-red-main to-rpp-red-dark text-white text-xs font-bold rounded-full shadow-colored animate-pulse relative z-10">
              {unreadData.count > 99 ? '99+' : unreadData.count}
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <div className={`fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-white via-gray-50/30 to-white shadow-modern-xl z-50 transform ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    } lg:translate-x-0 sidebar-transition overflow-hidden`}>
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-radial opacity-30 -z-10" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-rpp-red-palest/40 to-transparent opacity-40 -z-10" />

      <div className="flex flex-col h-full relative z-10">
        {/* Logo Header */}
        <div className="p-6 border-b border-rpp-grey-lightest/60">
          <div className="flex items-center space-x-3 group cursor-pointer">
            <div className="w-10 h-10 bg-gradient-to-br from-rpp-red-main to-rpp-red-dark rounded-xl flex items-center justify-center shadow-colored group-hover:scale-110 transition-smooth">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-rpp-grey-darkest to-rpp-red-dark bg-clip-text text-transparent">RPP</h1>
              <p className="text-xs text-rpp-grey font-medium">Photography</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-3">
            {menuItems.map(renderMenuItem)}
          </ul>
        </nav>

        {/* Sign Out */}
        <div className="p-4 border-t border-rpp-grey-lightest/60 bg-gradient-to-t from-gray-50/50 to-transparent">
          <button
            onClick={handleSignOut}
            className="group/signout w-full flex items-center px-4 py-3 text-left rounded-2xl hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100/50 transition-smooth text-rpp-grey-dark hover:text-red-600 shadow-sm hover:shadow-md"
          >
            <LogOut className="w-5 h-5 mr-3 group-hover/signout:scale-110 transition-smooth" />
            <span className="font-semibold">Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

