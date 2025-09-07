import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChange, getCurrentUserData, type UserData } from '@/lib/firebaseAuth';

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
  children: React.ReactNode;
}

export const EditorAuthProvider: React.FC<EditorAuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
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

  const value = {
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