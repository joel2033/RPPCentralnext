import { useState } from "react";
import { Menu, Bell, Search, ChevronDown } from "lucide-react";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

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
          <div className="relative">
            <button 
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100"
            >
              <div className="w-8 h-8 bg-rpp-red-main rounded-full flex items-center justify-center text-white text-sm font-medium">
                JA
              </div>
              <span className="hidden md:block text-sm font-medium text-rpp-grey-dark">Joel Adamson</span>
              <ChevronDown className="w-4 h-4 text-rpp-grey-light" />
            </button>
            
            {/* Dropdown Menu */}
            {profileDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-rpp-grey-border">
                <div className="py-2">
                  <a href="#" className="block px-4 py-2 text-sm text-rpp-grey-dark hover:bg-gray-50">Profile</a>
                  <a href="#" className="block px-4 py-2 text-sm text-rpp-grey-dark hover:bg-gray-50">Account Settings</a>
                  <a href="#" className="block px-4 py-2 text-sm text-rpp-grey-dark hover:bg-gray-50">Business Settings</a>
                  <a href="#" className="block px-4 py-2 text-sm text-rpp-grey-dark hover:bg-gray-50">Billing (Pay Editors)</a>
                  <hr className="my-2" />
                  <a href="#" className="block px-4 py-2 text-sm text-red-600 hover:bg-gray-50">Sign Out</a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
