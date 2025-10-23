import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Home,
  Download,
  Upload,
  FileImage,
  Package,
  Settings,
  LogOut,
  Camera,
  Users,
  Mail,
  UserPlus,
  MessageSquare
} from "lucide-react";
import { useEditorAuth } from "@/contexts/EditorAuthContext";
import { signOut } from "@/lib/firebaseAuth";
import { useQuery } from "@tanstack/react-query";

interface EditorSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  title: string;
  icon: React.ComponentType<any>;
  path: string;
}

const menuItems: MenuItem[] = [
  { title: "Dashboard", icon: Home, path: "/editor" },
  { title: "Invitations", icon: Mail, path: "/editor/invitations" },
  { title: "Job Queue", icon: FileImage, path: "/editor/jobs" },
  { title: "Downloads", icon: Download, path: "/editor/downloads" },
  { title: "Upload Completed", icon: Upload, path: "/editor/uploads" },
  { title: "My Products", icon: Package, path: "/editor/products" },
  { title: "Messages", icon: MessageSquare, path: "/editor/messages" },
  { title: "Settings", icon: Settings, path: "/editor/settings" },
];

export default function EditorSidebar({ isOpen, onClose }: EditorSidebarProps) {
  const [location] = useLocation();
  const { userData } = useEditorAuth();

  // Fetch unread message count
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/conversations/unread-count"],
    refetchInterval: 5000, // Poll every 5 seconds for updates
  });

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const isActive = (path: string) => {
    return location === path;
  };

  return (
    <div className={`fixed left-0 top-0 h-full w-64 bg-gray-900 text-white z-50 transform ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    } lg:translate-x-0 sidebar-transition`}>
      <div className="flex flex-col h-full">
        {/* Logo Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">RPP Editor</h1>
              <p className="text-xs text-gray-400">Dashboard</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium">{userData?.email}</p>
              <p className="text-xs text-gray-400 capitalize">Editor Account</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-3">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title}>
                  <Link
                    href={item.path}
                    onClick={onClose}
                    className={`nav-item flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors ${
                      isActive(item.path) ? 'bg-blue-600 text-white' : 'text-gray-300'
                    }`}
                    data-testid={`nav-${item.title.toLowerCase().replace(' ', '-')}`}
                  >
                    <div className="flex items-center">
                      <Icon className="w-5 h-5 mr-3" />
                      <span>{item.title}</span>
                    </div>
                    {item.title === "Messages" && unreadData && unreadData.count > 0 && (
                      <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-rpp-red-main text-white text-xs font-bold rounded-full">
                        {unreadData.count > 99 ? '99+' : unreadData.count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sign Out */}
        <div className="p-4 border-t border-gray-700">
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center px-3 py-2 text-left rounded-lg hover:bg-gray-700 transition-colors text-gray-300"
            data-testid="button-sign-out"
          >
            <LogOut className="w-5 h-5 mr-3" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}