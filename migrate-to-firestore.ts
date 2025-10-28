import { memStorage, firestoreStorage } from './server/storage';

async function migrateData() {
  console.log('Starting migration from in-memory storage to Firestore...\n');

  try {
    // Get all data from memStorage
    console.log('Fetching data from in-memory storage...');
    const allPartnerIds = new Set<string>();

    // First, get all users to find partner IDs
    const usersSnapshot = await firestoreStorage.getUsers('partner_99ae7n5vymh96fq3f');
    usersSnapshot.forEach(user => allPartnerIds.add(user.partnerId));

    console.log(`Found ${allPartnerIds.size} partner IDs from users`);

    // Migrate customers
    console.log('\n--- Migrating Customers ---');
    const customers = Array.from((memStorage as any).customers.values());
    console.log(`Found ${customers.length} customers in memStorage`);
    
    for (const customer of customers) {
      try {
        const existingCustomer = await firestoreStorage.getCustomer(customer.id);
        if (!existingCustomer) {
          await firestoreStorage.createCustomer({
            id: customer.id,
            partnerId: customer.partnerId,
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            phone: customer.phone,
            company: customer.company,
            category: customer.category,
            profileImage: customer.profileImage,
            notes: customer.notes,
            billingEmail: customer.billingEmail,
            billingAddress: customer.billingAddress,
            city: customer.city,
            state: customer.state,
            postcode: customer.postcode,
            paymentTerms: customer.paymentTerms,
            taxId: customer.taxId,
            teamMembers: customer.teamMembers,
            accountingIntegration: customer.accountingIntegration,
            accountingContactId: customer.accountingContactId,
            totalValue: customer.totalValue,
            averageJobValue: customer.averageJobValue,
            jobsCompleted: customer.jobsCompleted,
          });
          console.log(`  ✓ Migrated customer: ${customer.firstName} ${customer.lastName} (${customer.email})`);
        } else {
          console.log(`  - Skipped (already exists): ${customer.firstName} ${customer.lastName}`);
        }
      } catch (error: any) {
        console.error(`  ✗ Failed to migrate customer ${customer.email}:`, error.message);
      }
    }

    // Migrate products
    console.log('\n--- Migrating Products ---');
    const products = Array.from((memStorage as any).products.values());
    console.log(`Found ${products.length} products in memStorage`);
    
    for (const product of products) {
      try {
        const existingProduct = await firestoreStorage.getProduct(product.id);
        if (!existingProduct) {
          await firestoreStorage.createProduct({
            id: product.id,
            partnerId: product.partnerId,
            title: product.title,
            description: product.description,
            type: product.type,
            category: product.category,
            price: product.price,
            taxRate: product.taxRate,
            hasVariations: product.hasVariations,
            variants: product.variants,
            variations: product.variations,
            noCharge: product.noCharge,
            appointmentDuration: product.appointmentDuration,
          });
          console.log(`  ✓ Migrated product: ${product.title}`);
        } else {
          console.log(`  - Skipped (already exists): ${product.title}`);
        }
      } catch (error: any) {
        console.error(`  ✗ Failed to migrate product ${product.title}:`, error.message);
      }
    }

    // Migrate jobs
    console.log('\n--- Migrating Jobs ---');
    const jobs = Array.from((memStorage as any).jobs.values());
    console.log(`Found ${jobs.length} jobs in memStorage`);
    
    for (const job of jobs) {
      try {
        const existingJob = await firestoreStorage.getJob(job.id);
        if (!existingJob) {
          await firestoreStorage.createJob({
            id: job.id,
            partnerId: job.partnerId,
            customerId: job.customerId,
            jobId: job.jobId,
            address: job.address,
            city: job.city,
            state: job.state,
            postcode: job.postcode,
            appointmentDate: job.appointmentDate,
            appointmentTime: job.appointmentTime,
            appointmentDuration: job.appointmentDuration,
            status: job.status,
            propertyImage: job.propertyImage,
            propertyImageThumbnail: job.propertyImageThumbnail,
            notes: job.notes,
            internalNotes: job.internalNotes,
            photographer: job.photographer,
            shootCompleted: job.shootCompleted,
            proofsSent: job.proofsSent,
            orderCreated: job.orderCreated,
          });
          console.log(`  ✓ Migrated job: ${job.jobId} - ${job.address}`);
        } else {
          console.log(`  - Skipped (already exists): ${job.jobId}`);
        }
      } catch (error: any) {
        console.error(`  ✗ Failed to migrate job ${job.jobId}:`, error.message);
      }
    }

    // Migrate orders
    console.log('\n--- Migrating Orders ---');
    const orders = Array.from((memStorage as any).orders.values());
    console.log(`Found ${orders.length} orders in memStorage`);
    
    for (const order of orders) {
      try {
        const existingOrder = await firestoreStorage.getOrder(order.id);
        if (!existingOrder) {
          await firestoreStorage.createOrder({
            id: order.id,
            partnerId: order.partnerId,
            customerId: order.customerId,
            jobId: order.jobId,
            orderNumber: order.orderNumber,
            orderDate: order.orderDate,
            status: order.status,
            subtotal: order.subtotal,
            tax: order.tax,
            total: order.total,
            notes: order.notes,
            internalNotes: order.internalNotes,
            invoiceSent: order.invoiceSent,
            invoiceUrl: order.invoiceUrl,
            paymentStatus: order.paymentStatus,
            paidAmount: order.paidAmount,
            paidDate: order.paidDate,
          });
          console.log(`  ✓ Migrated order: ${order.orderNumber}`);
        } else {
          console.log(`  - Skipped (already exists): ${order.orderNumber}`);
        }
      } catch (error: any) {
        console.error(`  ✗ Failed to migrate order ${order.orderNumber}:`, error.message);
      }
    }

    // Migrate other data
    console.log('\n--- Migrating Other Data ---');
    
    // Service categories
    const categories = Array.from((memStorage as any).serviceCategories.values());
    console.log(`Found ${categories.length} service categories`);
    for (const cat of categories) {
      try {
        await firestoreStorage.createServiceCategory(cat);
        console.log(`  ✓ Migrated category: ${cat.name}`);
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.error(`  ✗ Failed to migrate category:`, error.message);
        }
      }
    }

    // Editor services
    const services = Array.from((memStorage as any).editorServices.values());
    console.log(`Found ${services.length} editor services`);
    for (const service of services) {
      try {
        await firestoreStorage.createEditorService(service);
        console.log(`  ✓ Migrated service: ${service.title}`);
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.error(`  ✗ Failed to migrate service:`, error.message);
        }
      }
    }

    // Editing options
    const editingOptions = Array.from((memStorage as any).editingOptions.values());
    console.log(`Found ${editingOptions.length} editing options`);
    for (const option of editingOptions) {
      try {
        await firestoreStorage.createEditingOption(option);
        console.log(`  ✓ Migrated editing option: ${option.name}`);
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.error(`  ✗ Failed to migrate editing option:`, error.message);
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateData();
