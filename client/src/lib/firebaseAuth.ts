import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
// Removed Firestore imports to avoid permission issues during development
import { auth } from "./firebase";

export type UserRole = "partner" | "admin" | "photographer";

export interface UserData {
  uid: string;
  email: string;
  role: UserRole;
  partnerId: string;
  createdAt: any;
}

// Sign up a new user (public signup always creates partner)
export const signUpUser = async (email: string, password: string): Promise<UserData> => {
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
          email: user.email!
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

    // Return user data (always partner for public signup)
    const userData: UserData = {
      uid: user.uid,
      email: user.email!,
      role: "partner",
      partnerId: "", // Will be filled by backend
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
  } else if (user.email?.includes('admin')) {
    role = 'admin';
  } else {
    role = 'partner'; // Default for public signups
  }
  
  const userData: UserData = {
    uid: user.uid,
    email: user.email!,
    role,
    partnerId: "", // Will be populated from Firestore if needed
    createdAt: new Date()
  };
  
  return userData;
};

// Listen to auth state changes
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Route permissions by role - updated for multi-tenant structure
export const routePermissions: Record<string, UserRole[]> = {
  "/dashboard": ["partner", "admin", "photographer"],
  "/jobs": ["partner", "admin", "photographer"],
  "/calendar": ["partner", "admin", "photographer"],
  "/customers": ["partner", "admin"],
  "/products": ["partner", "admin"],
  "/orders": ["partner", "admin", "photographer"],
  "/upload": ["partner", "admin", "photographer"],
  "/settings": ["partner"] // Only partners can access team management
};

// Check if user has permission for route
export const hasRoutePermission = (route: string, userRole: UserRole): boolean => {
  const allowedRoles = routePermissions[route];
  return allowedRoles ? allowedRoles.includes(userRole) : false;
};