import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChange, getCurrentUserData, type UserData } from '@/lib/firebaseAuth';
import { queryClient } from '@/lib/queryClient';

interface EditorAuthContextType {
  currentUser: User | null;
  userData: UserData | null;
  loading: boolean;
  isEditor: boolean;
}

const EditorAuthContext = createContext<EditorAuthContextType | undefined>(undefined);

export const useEditorAuth = () => {
  const context = useContext(EditorAuthContext);
  if (context === undefined) {
    throw new Error('useEditorAuth must be used within an EditorAuthProvider');
  }
  return context;
};

interface EditorAuthProviderProps {
  children: ReactNode;
}

export const EditorAuthProvider: React.FC<EditorAuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      const newUserId = user?.uid || null;
      
      // If the user has changed (login, logout, or account switch), clear the query cache
      if (previousUserIdRef.current !== newUserId) {
        console.log('[EditorAuthContext] User changed from', previousUserIdRef.current, 'to', newUserId, '- clearing query cache');
        queryClient.clear(); // Clear all cached queries
        previousUserIdRef.current = newUserId;
      }
      
      setCurrentUser(user);
      setLoading(true);

      if (user) {
        try {
          const data = await getCurrentUserData(user);
          // Only set user data if they are an editor
          if (data && data.role === 'editor') {
            setUserData(data);
          } else {
            // If user is not an editor, clear the auth state
            setUserData(null);
            setCurrentUser(null);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUserData(null);
        }
      } else {
        setUserData(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const isEditor = userData?.role === 'editor';

  const value: EditorAuthContextType = {
    currentUser,
    userData,
    loading,
    isEditor
  };

  return (
    <EditorAuthContext.Provider value={value}>
      {children}
    </EditorAuthContext.Provider>
  );
};