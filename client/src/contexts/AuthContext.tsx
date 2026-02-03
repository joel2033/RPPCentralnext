import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChange, getCurrentUserData, signOut } from '@/lib/firebaseAuth';
import type { UserData, UserRole } from '@/lib/firebaseAuth';
import { queryClient } from '@/lib/queryClient';

interface AuthContextType {
  currentUser: User | null;
  userData: UserData | null;
  userRole: UserRole | null;
  loading: boolean;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const previousUserIdRef = useRef<string | null>(null);

  const logout = async () => {
    await signOut();
    setCurrentUser(null);
    setUserData(null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      const newUserId = user?.uid || null;
      
      // If the user has changed (login, logout, or account switch), clear the query cache
      if (previousUserIdRef.current !== newUserId) {
        console.log('[AuthContext] User changed from', previousUserIdRef.current, 'to', newUserId, '- clearing query cache');
        queryClient.clear(); // Clear all cached queries
        previousUserIdRef.current = newUserId;
      }
      
      setCurrentUser(user);
      
      if (user) {
        try {
          const data = await getCurrentUserData(user);
          setUserData(data);
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUserData(null);
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser,
    userData,
    userRole: userData?.role || null,
    loading,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};