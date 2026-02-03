import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Upload,
  FolderOpen,
  Settings,
  LogOut,
  Mail,
  MessageSquare,
  RefreshCw,
  Home
} from "lucide-react";
import { useEditorAuth } from "@/contexts/EditorAuthContext";
import { signOut } from "@/lib/firebaseAuth";
import { getAuth } from "firebase/auth";
import { useRealtimeConversations } from "@/hooks/useFirestoreRealtime";

interface EditorSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  title: string;
  icon: React.ComponentType<any>;
  path: string;
  badge?: number;
}

const menuItems: MenuItem[] = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/editor" },
  { title: "Invitations", icon: Mail, path: "/editor/invitations" },
  { title: "My Orders", icon: FolderOpen, path: "/editor/jobs" },
  { title: "Uploads", icon: Upload, path: "/editor/uploads" },
  { title: "Messages", icon: MessageSquare, path: "/editor/messages" },
  { title: "Revisions", icon: RefreshCw, path: "/editor/revisions" },
  { title: "Settings", icon: Settings, path: "/editor/settings" },
];

export default function EditorSidebar({ isOpen, onClose }: EditorSidebarProps) {
  const [location] = useLocation();
  const { userData } = useEditorAuth();
  const auth = getAuth();
  const currentUser = auth.currentUser;

  // Real-time unread message count from conversations
  const { unreadCount, loading: conversationsLoading } = useRealtimeConversations(
    currentUser?.uid || null,
    userData?.partnerId
  );

  // Only show badge when user is authenticated and data is loaded
  const showUnreadBadge = currentUser && !conversationsLoading && unreadCount > 0;

  // Mock revision count - this would come from an API in production
  const revisionCount = 3;

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

  // Get user initials for avatar
  const getUserInitials = () => {
    if (userData?.displayName) {
      const names = userData.displayName.split(' ');
      return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (userData?.email) {
      return userData.email[0].toUpperCase();
    }
    return 'ED';
  };

  return (
    <div className={`fixed left-0 top-0 h-full w-64 bg-rpp-sidebar text-white z-50 transform ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    } lg:translate-x-0 sidebar-transition`}>
      <div className="flex flex-col h-full">
        {/* Logo Header */}
        <div className="p-6 border-b border-rpp-sidebar-dark">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-rpp-orange rounded-lg flex items-center justify-center">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-white/60 font-medium">Editor Portal - Editor</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 py-6 overflow-y-auto">
          <ul className="space-y-1 px-3">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              const showMessageBadge = item.title === "Messages" && showUnreadBadge;
              const showRevisionBadge = item.title === "Revisions" && revisionCount > 0;
              
              return (
                <li key={item.title}>
                  <Link
                    href={item.path}
                    onClick={onClose}
                    className={`nav-item flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-200 ${
                      active 
                        ? 'active' 
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                    data-testid={`nav-${item.title.toLowerCase().replace(' ', '-')}`}
                  >
                    <div className="flex items-center">
                      <Icon className={`w-5 h-5 mr-3 ${active ? 'text-white' : 'text-white/70'}`} />
                      <span className="font-medium">{item.title}</span>
                    </div>
                    {showMessageBadge && (
                      <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 bg-rpp-orange text-white text-xs font-bold rounded-full">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                    {showRevisionBadge && (
                      <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 bg-rpp-orange text-white text-xs font-bold rounded-full">
                        {revisionCount}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Info & Sign Out */}
        <div className="p-4 border-t border-rpp-sidebar-dark">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-rpp-orange rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {getUserInitials()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {userData?.displayName || userData?.email?.split('@')[0] || 'Editor'}
                </p>
                <p className="text-xs text-white/50">Editor</p>
              </div>
            </div>
            <Link
              href="/editor/settings"
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4 text-white/60" />
            </Link>
          </div>
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/70 hover:text-white"
            data-testid="button-sign-out"
          >
            <LogOut className="w-4 h-4 mr-2" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
