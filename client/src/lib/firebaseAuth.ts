import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection
} from "firebase/firestore";
import { auth, db } from "./firebase";

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

    // Create user document in Firestore
    const userData: UserData = {
      uid: user.uid,
      email: user.email!,
      role,
      createdAt: new Date()
    };

    try {
      await setDoc(doc(db, "users", user.uid), userData);
    } catch (e) {
      console.warn("Could not save user to Firestore, but account created");
    }
    
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

    // Get user data from Firestore
    const userDoc = await getDoc(doc(db, "users", user.uid));
    
    if (!userDoc.exists()) {
      throw new Error("User data not found");
    }

    return userDoc.data() as UserData;
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

// Get current user data
export const getCurrentUserData = async (user: User): Promise<UserData | null> => {
  try {
    if (!user) return null;
    
    const userDoc = await getDoc(doc(db, "users", user.uid));
    
    if (!userDoc.exists()) {
      // Create a default user data if none exists (for demo purposes)
      const defaultUserData: UserData = {
        uid: user.uid,
        email: user.email!,
        role: 'admin', // Default to admin for demo
        createdAt: new Date()
      };
      
      // Optionally save to Firestore if permissions allow
      try {
        await setDoc(doc(db, "users", user.uid), defaultUserData);
      } catch (e) {
        console.warn("Could not save user to Firestore, using local data");
      }
      
      return defaultUserData;
    }

    return userDoc.data() as UserData;
  } catch (error) {
    console.error("Error getting user data:", error);
    
    // Return default user data if Firestore fails
    return {
      uid: user.uid,
      email: user.email!,
      role: 'admin',
      createdAt: new Date()
    };
  }
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