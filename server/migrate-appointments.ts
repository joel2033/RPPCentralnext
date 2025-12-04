/**
 * Migration script to migrate existing job.appointmentDate data to appointments table
 * 
 * This script:
 * 1. Finds all jobs with appointmentDate set
 * 2. Creates appointments for those jobs
 * 3. Extracts products from activity metadata if available
 * 4. Skips jobs that already have appointments
 */

import { adminDb } from "./firebase-admin";
import { nanoid } from "nanoid";
import { Timestamp } from "firebase-admin/firestore";

async function migrateAppointments() {
  console.log('Starting appointment migration...');
  
  try {
    // Get all jobs with appointmentDate
    const jobsSnapshot = await adminDb.collection('jobs')
      .where('appointmentDate', '!=', null)
      .get();
    
    console.log(`Found ${jobsSnapshot.size} jobs with appointmentDate`);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const jobDoc of jobsSnapshot.docs) {
      try {
        const job = jobDoc.data();
        const jobId = jobDoc.id; // Internal UUID
        
        if (!job.appointmentDate) {
          console.log(`Job ${job.jobId} has null appointmentDate, skipping...`);
          skipped++;
          continue;
        }
        
        // Check if appointments already exist for this job
        const existingAppointments = await adminDb.collection('appointments')
          .where('jobId', '==', jobId)
          .get();
        
        if (!existingAppointments.empty) {
          console.log(`Job ${job.jobId} already has ${existingAppointments.size} appointment(s), skipping...`);
          skipped++;
          continue;
        }
        
        // Get products from activity metadata
        let products: any[] = [];
        try {
          const activitiesSnapshot = await adminDb.collection('activities')
            .where('jobId', '==', job.jobId) // Use NanoID for jobId in activities
            .where('action', '==', 'creation')
            .where('category', '==', 'job')
            .limit(1)
            .get();
          
          if (!activitiesSnapshot.empty) {
            const activity = activitiesSnapshot.docs[0].data();
            if (activity.metadata) {
              try {
                const metadata = typeof activity.metadata === 'string' 
                  ? JSON.parse(activity.metadata) 
                  : activity.metadata;
                products = metadata.products || [];
                console.log(`Found ${products.length} products in activity metadata for job ${job.jobId}`);
              } catch (parseError) {
                console.error(`Error parsing metadata for job ${job.jobId}:`, parseError);
              }
            }
          }
        } catch (activityError) {
          console.error(`Error fetching activities for job ${job.jobId}:`, activityError);
          // Continue with migration even if activities fetch fails
        }
        
        // Convert appointmentDate to Date if it's a Firestore Timestamp
        let appointmentDate: Date;
        if (job.appointmentDate?.toDate) {
          appointmentDate = job.appointmentDate.toDate();
        } else if (job.appointmentDate instanceof Date) {
          appointmentDate = job.appointmentDate;
        } else {
          appointmentDate = new Date(job.appointmentDate);
        }
        
        // Create appointment
        const appointmentId = nanoid();
        const appointment = {
          id: nanoid(), // Internal UUID
          appointmentId, // NanoID for external reference
          jobId: jobId, // Reference to job's internal UUID
          partnerId: job.partnerId,
          appointmentDate: Timestamp.fromDate(appointmentDate),
          estimatedDuration: job.estimatedDuration || null,
          assignedTo: job.assignedTo || null,
          status: 'scheduled',
          products: products.length > 0 ? JSON.stringify(products) : null,
          notes: job.notes || null,
          createdAt: job.createdAt?.toDate ? Timestamp.fromDate(job.createdAt.toDate()) : Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        
        await adminDb.collection('appointments').doc(appointment.id).set(appointment);
        migrated++;
        console.log(`✓ Migrated appointment for job ${job.jobId} (${job.address})`);
      } catch (error) {
        errors++;
        console.error(`✗ Error migrating job ${jobDoc.id}:`, error);
      }
    }
    
    console.log('\n=== Migration Summary ===');
    console.log(`Total jobs with appointmentDate: ${jobsSnapshot.size}`);
    console.log(`Appointments migrated: ${migrated}`);
    console.log(`Jobs skipped (already have appointments): ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log('Migration complete!');
    
  } catch (error) {
    console.error('Fatal error during migration:', error);
    process.exit(1);
  }
}

// Run migration
migrateAppointments()
  .then(() => {
    console.log('Migration script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });

