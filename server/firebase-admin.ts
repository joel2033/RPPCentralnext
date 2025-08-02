import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
const initializeFirebaseAdmin = () => {
  // Check if Firebase Admin is already initialized
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // Create service account object from environment variables
  const serviceAccount = {
    type: "service_account",
    project_id: process.env.VITE_FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
  };

  // Initialize Firebase Admin with service account
  return initializeApp({
    credential: cert(serviceAccount as any),
    projectId: process.env.VITE_FIREBASE_PROJECT_ID
  });
};

// Initialize the app
const app = initializeFirebaseAdmin();

// Export Firestore instance
export const adminDb = getFirestore(app);

// User role type
export type UserRole = "client" | "photographer" | "editor" | "admin" | "licensee" | "master";

// User data interface
export interface UserData {
  uid: string;
  email: string;
  role: UserRole;
  createdAt: any;
}

// Create user document in Firestore
export const createUserDocument = async (uid: string, email: string, role: UserRole): Promise<string> => {
  try {
    const userData: UserData = {
      uid,
      email,
      role,
      createdAt: new Date()
    };

    // Add document to users collection
    const userRef = adminDb.collection('users').doc(uid);
    await userRef.set(userData);
    
    console.log(`User document created for ${email} with role ${role}`);
    return uid;
  } catch (error) {
    console.error('Error creating user document:', error);
    throw error;
  }
};

// Get user document from Firestore
export const getUserDocument = async (uid: string): Promise<UserData | null> => {
  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return null;
    }
    
    return userDoc.data() as UserData;
  } catch (error) {
    console.error('Error getting user document:', error);
    throw error;
  }
};