import React from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { hasRoutePermission } from '@/lib/firebaseAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  route: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, route }) => {
  const { currentUser, userData, loading } = useAuth();
  const [, setLocation] = useLocation();

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rpp-grey-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rpp-red-main"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!currentUser || !userData) {
    setLocation('/login');
    return null;
  }

  // Check route permissions
  if (!hasRoutePermission(route, userData.role)) {
    setLocation('/dashboard');
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;