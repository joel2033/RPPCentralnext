import { adminDb } from './server/firebase-admin.js';
import { Timestamp } from 'firebase-admin/firestore';

async function fixHarveyUser() {
  const harveyUid = 'CyT9VEyw1DT8vN3ts56XZpGF2VI3';
  const harveyEmail = 'harvey@rpp.com';
  const partnerId = 'partner_99ae7n5vymh96fq3f';
  
  console.log('Checking Harvey user document...');
  
  const userRef = adminDb.collection('users').doc(harveyUid);
  const userDoc = await userRef.get();
  
  if (userDoc.exists) {
    console.log('Harvey user document exists:', userDoc.data());
  } else {
    console.log('Harvey user document does NOT exist. Creating...');
    
    await userRef.set({
      uid: harveyUid,
      email: harveyEmail,
      role: 'partner',
      partnerId: partnerId,
      createdAt: Timestamp.now()
    });
    
    console.log('Harvey user document created successfully!');
  }
  
  // Verify
  const verifyDoc = await userRef.get();
  console.log('Final Harvey document:', verifyDoc.data());
  
  process.exit(0);
}

fixHarveyUser().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
