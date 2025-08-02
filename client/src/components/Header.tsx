import { useState } from "react";
import { Menu, Bell, Search, ChevronDown, User, LogOut } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { userData, logout } = useAuth();
  const [, setLocation] = useLocation();

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
      case 'master': return 'bg-purple-100 text-purple-800';
      case 'licensee': return 'bg-blue-100 text-blue-800';
      case 'admin': return 'bg-red-100 text-red-800';
      case 'editor': return 'bg-green-100 text-green-800';
      case 'photographer': return 'bg-yellow-100 text-yellow-800';
      case 'client': return 'bg-gray-100 text-gray-800';
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
          <button className="relative p-2 rounded-lg hover:bg-gray-100">
            <Bell className="w-5 h-5 text-rpp-grey-dark" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-rpp-red-main rounded-full"></span>
          </button>

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