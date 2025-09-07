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

// User role type - updated for multi-tenant structure + editor
export type UserRole = "partner" | "admin" | "photographer" | "editor";

// User data interface with partnerId for multi-tenancy (editors don't need partnerId)
export interface UserData {
  uid: string;
  email: string;
  role: UserRole;
  partnerId?: string; // Optional for editors
  createdAt: any;
  status?: "pending" | "approved" | "rejected"; // For editor approval workflow
}

// Pending invite interface
export interface PendingInvite {
  email: string;
  role: UserRole;
  partnerId: string;
  invitedBy: string;
  status: "pending" | "accepted" | "expired";
  createdAt: any;
  inviteToken: string;
}

// Generate unique partner ID
export const generatePartnerId = (): string => {
  return 'partner_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

// Generate unique invite token
export const generateInviteToken = (): string => {
  return 'inv_' + Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
};

// Create user document in Firestore with partnerId
export const createUserDocument = async (uid: string, email: string, role: UserRole, partnerId?: string): Promise<string> => {
  try {
    // Generate partnerId for new partners, use provided one for team members, none for editors
    const userPartnerId = partnerId || (role === 'partner' ? generatePartnerId() : undefined);
    
    const userData: UserData = {
      uid,
      email,
      role,
      createdAt: new Date()
    };

    // Add partnerId only if it exists (not for editors)
    if (userPartnerId) {
      userData.partnerId = userPartnerId;
    }

    // Add pending status for editors
    if (role === 'editor') {
      userData.status = 'pending';
    }

    // Add document to users collection
    const userRef = adminDb.collection('users').doc(uid);
    await userRef.set(userData);
    
    console.log(`User document created for ${email} with role ${role} and partnerId ${userPartnerId}`);
    return uid;
  } catch (error) {
    console.error('Error creating user document:', error);
    throw error;
  }
};

// Create pending invite in Firestore
export const createPendingInvite = async (email: string, role: UserRole, partnerId: string, invitedBy: string): Promise<string> => {
  try {
    const inviteToken = generateInviteToken();
    
    const inviteData: PendingInvite = {
      email,
      role,
      partnerId,
      invitedBy,
      status: "pending",
      createdAt: new Date(),
      inviteToken
    };

    // Add document to pendingInvites collection
    const inviteRef = adminDb.collection('pendingInvites').doc();
    await inviteRef.set(inviteData);
    
    console.log(`Pending invite created for ${email} with role ${role} by ${invitedBy}`);
    return inviteToken;
  } catch (error) {
    console.error('Error creating pending invite:', error);
    throw error;
  }
};

// Get user document by uid
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

// Get pending invite by token
export const getPendingInvite = async (token: string): Promise<PendingInvite | null> => {
  try {
    const invitesSnapshot = await adminDb.collection('pendingInvites')
      .where('inviteToken', '==', token)
      .where('status', '==', 'pending')
      .get();
    
    if (invitesSnapshot.empty) {
      return null;
    }
    
    return invitesSnapshot.docs[0].data() as PendingInvite;
  } catch (error) {
    console.error('Error getting pending invite:', error);
    throw error;
  }
};

// Update invite status
export const updateInviteStatus = async (token: string, status: string): Promise<void> => {
  try {
    const invitesSnapshot = await adminDb.collection('pendingInvites')
      .where('inviteToken', '==', token)
      .get();
    
    if (!invitesSnapshot.empty) {
      const inviteDoc = invitesSnapshot.docs[0];
      await inviteDoc.ref.update({ status });
      console.log(`Invite status updated to ${status} for token ${token}`);
    }
  } catch (error) {
    console.error('Error updating invite status:', error);
    throw error;
  }
};