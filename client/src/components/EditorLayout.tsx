import { useState } from "react";
import EditorSidebar from "./EditorSidebar";
import EditorHeader from "./EditorHeader";

interface EditorLayoutProps {
  children: React.ReactNode;
}

export default function EditorLayout({ children }: EditorLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Mobile Menu Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <EditorSidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      
      <div className="lg:ml-64 pt-16">
        <EditorHeader onMenuClick={toggleSidebar} />
        <main>{children}</main>
      </div>
    </div>
  );
}