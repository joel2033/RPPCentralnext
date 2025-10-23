import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

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

// Export Firestore and Auth instances
export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);

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

// Partnership invite interface (for partner-editor relationships)
export interface PartnershipInvite {
  editorEmail: string;
  editorStudioName: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  status: "pending" | "accepted" | "declined" | "expired";
  createdAt: any;
  inviteToken: string;
}

// Active partnership interface
export interface Partnership {
  editorId: string;
  editorEmail: string;
  editorStudioName: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  acceptedAt: any;
  isActive: boolean;
}

// Generate unique partner ID
export const generatePartnerId = (): string => {
  return 'partner_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

// Generate unique invite token
export const generateInviteToken = (): string => {
  return 'inv_' + Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
};

// Generate unique partnership invite token
export const generatePartnershipToken = (): string => {
  return 'part_' + Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
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

// Get user document by partnerId
export const getUserByPartnerId = async (partnerId: string): Promise<UserData | null> => {
  try {
    const usersSnapshot = await adminDb.collection('users')
      .where('partnerId', '==', partnerId)
      .limit(1)
      .get();
    
    if (usersSnapshot.empty) {
      return null;
    }
    
    return usersSnapshot.docs[0].data() as UserData;
  } catch (error) {
    console.error('Error getting user by partnerId:', error);
    throw error;
  }
};

// Update user document with partnerId (for editors who get assigned to partners)
export const updateUserPartnerId = async (uid: string, partnerId: string): Promise<void> => {
  try {
    const userRef = adminDb.collection('users').doc(uid);
    await userRef.update({ partnerId });
    console.log(`Updated user ${uid} with partnerId ${partnerId}`);
  } catch (error) {
    console.error('Error updating user partnerId:', error);
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

// Create partnership invite
export const createPartnershipInvite = async (
  editorEmail: string, 
  editorStudioName: string,
  partnerId: string,
  partnerName: string,
  partnerEmail: string
): Promise<string> => {
  try {
    const inviteToken = generatePartnershipToken();
    
    const inviteData: PartnershipInvite = {
      editorEmail,
      editorStudioName,
      partnerId,
      partnerName,
      partnerEmail,
      status: "pending",
      createdAt: new Date(),
      inviteToken
    };

    // Add document to partnershipInvites collection
    const inviteRef = adminDb.collection('partnershipInvites').doc();
    await inviteRef.set(inviteData);
    
    console.log(`Partnership invite created for ${editorEmail} by partner ${partnerEmail}`);
    return inviteToken;
  } catch (error) {
    console.error('Error creating partnership invite:', error);
    throw error;
  }
};

// Get partnership invite by token
export const getPartnershipInvite = async (token: string): Promise<PartnershipInvite | null> => {
  try {
    const invitesSnapshot = await adminDb.collection('partnershipInvites')
      .where('inviteToken', '==', token)
      .where('status', '==', 'pending')
      .get();
    
    if (invitesSnapshot.empty) {
      return null;
    }
    
    return invitesSnapshot.docs[0].data() as PartnershipInvite;
  } catch (error) {
    console.error('Error getting partnership invite:', error);
    throw error;
  }
};

// Update partnership invite status
export const updatePartnershipInviteStatus = async (token: string, status: string): Promise<void> => {
  try {
    const invitesSnapshot = await adminDb.collection('partnershipInvites')
      .where('inviteToken', '==', token)
      .get();
    
    if (!invitesSnapshot.empty) {
      const inviteDoc = invitesSnapshot.docs[0];
      await inviteDoc.ref.update({ status });
      console.log(`Partnership invite status updated to ${status} for token ${token}`);
    }
  } catch (error) {
    console.error('Error updating partnership invite status:', error);
    throw error;
  }
};

// Create active partnership
export const createPartnership = async (
  editorId: string,
  editorEmail: string,
  editorStudioName: string,
  partnerId: string,
  partnerName: string,
  partnerEmail: string
): Promise<string> => {
  try {
    const partnershipData: Partnership = {
      editorId,
      editorEmail,
      editorStudioName,
      partnerId,
      partnerName,
      partnerEmail,
      acceptedAt: new Date(),
      isActive: true
    };

    // Add document to partnerships collection
    const partnershipRef = adminDb.collection('partnerships').doc();
    await partnershipRef.set(partnershipData);
    
    console.log(`Partnership created between ${editorEmail} and ${partnerEmail}`);
    return partnershipRef.id;
  } catch (error) {
    console.error('Error creating partnership:', error);
    throw error;
  }
};

// Get partnerships for a partner
export const getPartnerPartnerships = async (partnerId: string): Promise<Partnership[]> => {
  try {
    const partnershipsSnapshot = await adminDb.collection('partnerships')
      .where('partnerId', '==', partnerId)
      .where('isActive', '==', true)
      .get();
    
    return partnershipsSnapshot.docs.map(doc => doc.data() as Partnership);
  } catch (error) {
    console.error('Error getting partner partnerships:', error);
    throw error;
  }
};

// Get partnerships for an editor
export const getEditorPartnerships = async (editorId: string): Promise<Partnership[]> => {
  try {
    const partnershipsSnapshot = await adminDb.collection('partnerships')
      .where('editorId', '==', editorId)
      .where('isActive', '==', true)
      .get();
    
    return partnershipsSnapshot.docs.map(doc => doc.data() as Partnership);
  } catch (error) {
    console.error('Error getting editor partnerships:', error);
    throw error;
  }
};

// Get pending partnership invites for an editor
export const getEditorPendingInvites = async (editorEmail: string): Promise<PartnershipInvite[]> => {
  try {
    // Get all pending invites and filter case-insensitively
    const invitesSnapshot = await adminDb.collection('partnershipInvites')
      .where('status', '==', 'pending')
      .get();
    
    const invites = invitesSnapshot.docs
      .map(doc => doc.data() as PartnershipInvite)
      .filter(invite => invite.editorEmail.toLowerCase() === editorEmail.toLowerCase());
    
    return invites;
  } catch (error) {
    console.error('Error getting editor pending invites:', error);
    throw error;
  }
};