import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useEditorAuth } from '@/contexts/EditorAuthContext';

interface EditorProtectedRouteProps {
  children: React.ReactNode;
}

const EditorProtectedRoute: React.FC<EditorProtectedRouteProps> = ({ children }) => {
  const { currentUser, userData, loading, isEditor } = useEditorAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading) {
      if (!currentUser || !isEditor) {
        setLocation('/editor-login');
        return;
      }
    }
  }, [loading, currentUser, isEditor, setLocation]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading editor dashboard...</p>
        </div>
      </div>
    );
  }

  // Don't render anything while redirecting
  if (!currentUser || !isEditor) {
    return null;
  }

  return <>{children}</>;
};

export default EditorProtectedRoute;