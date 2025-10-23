import { Menu, Bell, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEditorAuth } from "@/contexts/EditorAuthContext";
import { useQuery } from "@tanstack/react-query";
import { getAuth } from "firebase/auth";

const auth = getAuth();

interface EditorHeaderProps {
  onMenuClick: () => void;
}

export default function EditorHeader({ onMenuClick }: EditorHeaderProps) {
  const { userData } = useEditorAuth();
  const currentUser = auth.currentUser;

  // Fetch unread message count
  const { data: unreadMessagesData } = useQuery<{ count: number }>({
    queryKey: ['/api/conversations/unread-count'],
    enabled: !!currentUser,
    refetchInterval: 8000 // Poll every 8 seconds for real-time updates
  });

  const unreadCount = unreadMessagesData?.count || 0;

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
          <Button
            variant="ghost"
            size="sm"
            className="relative"
            data-testid="button-notifications"
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