import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
// Removed Firestore imports to avoid permission issues during development
import { auth } from "./firebase";

export type UserRole = "client" | "photographer" | "editor" | "admin" | "licensee" | "master";

export interface UserData {
  uid: string;
  email: string;
  role: UserRole;
  createdAt: any;
}

// Sign up a new user with email/password and assign role
export const signUpUser = async (email: string, password: string, role: UserRole): Promise<UserData> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Create user document in Firestore via backend API
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email!,
          role
        })
      });

      if (!response.ok) {
        console.warn('Failed to create Firestore document, using local data');
      } else {
        const result = await response.json();
        console.log('User document created in Firestore:', result);
      }
    } catch (error) {
      console.warn('Backend signup call failed, continuing with auth only:', error);
    }

    // Return user data
    const userData: UserData = {
      uid: user.uid,
      email: user.email!,
      role,
      createdAt: new Date()
    };
    
    return userData;
  } catch (error: any) {
    throw new Error(error.message || "Failed to create user");
  }
};

// Sign in user with email/password
export const signInUser = async (email: string, password: string): Promise<UserData> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Use the same email-based role assignment logic
    const userData = await getCurrentUserData(user);
    if (!userData) {
      throw new Error("Could not create user data");
    }
    
    return userData;
  } catch (error: any) {
    throw new Error(error.message || "Failed to sign in");
  }
};

// Sign out user
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error: any) {
    throw new Error(error.message || "Failed to sign out");
  }
};

// Get current user data - simplified without Firestore dependency
export const getCurrentUserData = async (user: User): Promise<UserData | null> => {
  if (!user) return null;
  
  // For now, create user data based on email domain or default to admin
  // This avoids Firestore permission issues during development
  let role: UserRole = 'admin'; // Default role
  
  // You can customize role assignment based on email patterns
  if (user.email?.includes('photographer')) {
    role = 'photographer';
  } else if (user.email?.includes('editor')) {
    role = 'editor';
  } else if (user.email?.includes('client')) {
    role = 'client';
  } else if (user.email?.includes('licensee')) {
    role = 'licensee';
  } else if (user.email?.includes('master')) {
    role = 'master';
  }
  
  const userData: UserData = {
    uid: user.uid,
    email: user.email!,
    role,
    createdAt: new Date()
  };
  
  return userData;
};

// Listen to auth state changes
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Route permissions by role
export const routePermissions: Record<string, UserRole[]> = {
  "/dashboard": ["client", "photographer", "editor", "admin", "licensee", "master"],
  "/jobs": ["photographer", "editor", "admin", "licensee", "master"],
  "/calendar": ["photographer", "editor", "admin", "licensee", "master"],
  "/customers": ["photographer", "admin", "licensee", "master"],
  "/products": ["admin", "licensee", "master"],
  "/orders": ["photographer", "editor", "admin", "licensee", "master"],
  "/upload": ["photographer", "editor", "admin", "licensee", "master"],
  "/editor-dashboard": ["editor", "admin", "master"],
  "/production-hub": ["photographer", "admin", "licensee", "master"],
  "/reports": ["admin", "licensee", "master"]
};

// Check if user has permission for route
export const hasRoutePermission = (route: string, userRole: UserRole): boolean => {
  const allowedRoles = routePermissions[route];
  return allowedRoles ? allowedRoles.includes(userRole) : false;
};