import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
// Removed Firestore imports to avoid permission issues during development
import { auth } from "./firebase";

export type UserRole = "partner" | "admin" | "photographer" | "editor";

export interface UserData {
  uid: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  partnerId: string;
  createdAt: any;
}

// Sign up a new user (public signup always creates partner)
export const signUpUser = async (email: string, password: string, businessName: string): Promise<UserData> => {
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
          businessName
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

// Get current user data - fetch from Firestore via backend API
export const getCurrentUserData = async (user: User): Promise<UserData | null> => {
  if (!user) return null;
  
  try {
    // Try to get user data from Firestore via backend API
    const response = await fetch(`/api/auth/user/${user.uid}`);
    if (response.ok) {
      const firestoreUserData = await response.json();
      console.log('Loaded user data from Firestore:', firestoreUserData);
      return firestoreUserData;
    } else {
      console.warn('Failed to fetch user data from Firestore, using fallback');
    }
  } catch (error) {
    console.warn('Error fetching user data from backend:', error);
  }
  
  // Fallback: create user data based on email domain
  let role: UserRole = 'partner'; // Default role for public signups
  
  if (user.email?.includes('photographer')) {
    role = 'photographer';
  } else if (user.email?.includes('admin')) {
    role = 'admin';
  } else if (user.email?.includes('editor')) {
    role = 'editor';
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
  "/customers": ["partner", "admin", "photographer"],
  "/products": ["partner", "admin"],
  "/orders": ["partner", "admin", "photographer"],
  "/upload": ["partner", "admin", "photographer"],
  "/settings": ["partner", "photographer"], // Partners and photographers can access settings
  "/team/assignments": ["partner", "admin"], // Only partners and admins can assign team orders
  "/messages": ["partner", "admin", "photographer"], // Partners can message with editors
  "/team": ["partner", "admin"], // Team members management
  "/partnerships": ["partner", "admin"], // Partnership management
  "/invite-editor": ["partner", "admin"], // Invite editors
  // Editor-specific routes
  "/editor": ["editor"],
  "/editor/dashboard": ["editor"],
  "/editor/jobs": ["editor"],
  "/editor/downloads": ["editor"],
  "/editor/uploads": ["editor"],
  "/editor/products": ["editor"],
  "/editor/settings": ["editor"],
  "/editor/messages": ["editor"], // Editors can message with partners
  "/editor/invitations": ["editor"] // Editor invitations
};

// Check if user has permission for route
export const hasRoutePermission = (route: string, userRole: UserRole): boolean => {
  const allowedRoles = routePermissions[route];
  return allowedRoles ? allowedRoles.includes(userRole) : false;
};