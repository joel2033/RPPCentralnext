import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterView } from '@/contexts/MasterViewContext';
import { hasRoutePermission, UserRole } from '@/lib/firebaseAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  route: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, route }) => {
  const { currentUser, userData, loading } = useAuth();
  const { isMaster, isViewingOwnBusiness } = useMasterView();
  const [, setLocation] = useLocation();

  // Compute effective role for route permissions:
  // - If master and viewing own business, treat as 'partner' for navigation
  // - Otherwise, use actual role
  const effectiveRole: UserRole | null = userData
    ? (isMaster && isViewingOwnBusiness ? 'partner' : userData.role)
    : null;

  useEffect(() => {
    if (!loading) {
      if (!currentUser) {
        setLocation('/login');
        return;
      }
      
      if (effectiveRole && !hasRoutePermission(route, effectiveRole)) {
        setLocation('/dashboard');
        return;
      }
    }
  }, [loading, currentUser, effectiveRole, route, setLocation]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rpp-grey-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rpp-red-main"></div>
      </div>
    );
  }

  // Don't render anything while redirecting
  if (!currentUser) {
    return null;
  }

  if (effectiveRole && !hasRoutePermission(route, effectiveRole)) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;