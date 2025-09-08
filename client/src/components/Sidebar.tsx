import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
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
  Settings
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
      { title: "Invite Editor", icon: Users, path: "/invite-editor" },
      { title: "Partnerships", icon: Handshake, path: "/partnerships" },
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
  { title: "Settings", icon: Settings, path: "/settings" },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const { logout } = useAuth();

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
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-rpp-grey-medium transition-colors text-white"
            >
              <div className="flex items-center">
                <Icon className="w-5 h-5 mr-3" />
                <span>{item.title}</span>
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
                      className={`nav-item block px-3 py-2 text-sm rounded hover:bg-rpp-grey-medium transition-colors ${
                        isActive(child.path!) ? 'active' : 'text-white'
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
          className={`nav-item flex items-center px-3 py-2 rounded-lg hover:bg-rpp-grey-medium transition-colors ${
            isActive(item.path!) ? 'active' : 'text-white'
          }`}
        >
          <Icon className="w-5 h-5 mr-3" />
          <span>{item.title}</span>
        </Link>
      </li>
    );
  };

  return (
    <div className={`fixed left-0 top-0 h-full w-64 bg-rpp-grey-dark text-white z-50 transform ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    } lg:translate-x-0 sidebar-transition`}>
      <div className="flex flex-col h-full">
        {/* Logo Header */}
        <div className="p-6 border-b border-rpp-grey-medium">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-rpp-red-main rounded flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">RPP</h1>
              <p className="text-xs text-rpp-grey-lighter">Photography</p>
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
        <div className="p-4 border-t border-rpp-grey-medium">
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center px-3 py-2 text-left rounded-lg hover:bg-rpp-grey-medium transition-colors text-white"
          >
            <LogOut className="w-5 h-5 mr-3" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
