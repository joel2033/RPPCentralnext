import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  Timestamp,
  QueryConstraint 
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import type { 
  Message, 
  Conversation, 
  Notification, 
  Job, 
  Order, 
  EditorUpload 
} from '@shared/schema';

// Helper to convert Firestore timestamps to Date objects
const convertTimestamps = (doc: any): any => {
  const data = doc.data();
  const result: any = { ...data, id: doc.id };
  
  Object.keys(result).forEach(key => {
    if (result[key] instanceof Timestamp) {
      result[key] = result[key].toDate();
    }
  });
  
  return result;
};

// Real-time messages for a conversation
export function useRealtimeMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs.map(doc => convertTimestamps(doc) as Message);
        setMessages(msgs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error listening to messages:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [conversationId]);

  return { messages, loading, error };
}

// Real-time conversations for a user
export function useRealtimeConversations(userId: string | null, partnerId?: string, userRole?: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setConversations([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // For photographers, filter by participantId to only show their own conversations
    if (userRole === 'photographer' && partnerId) {
      const q1 = query(
        collection(db, 'conversations'),
        where('partnerId', '==', partnerId),
        where('participantId', '==', userId)
      );

      const unsubscribe = onSnapshot(
        q1,
        (snapshot) => {
          const conversations = snapshot.docs.map(doc => convertTimestamps(doc) as Conversation);
          
          const sorted = conversations.sort((a, b) => {
            const aTime = a.lastMessageAt?.getTime() || 0;
            const bTime = b.lastMessageAt?.getTime() || 0;
            return bTime - aTime;
          });
          
          // Calculate total unread message count
          const totalUnread = sorted.reduce((count, conv) => {
            return count + (conv.partnerUnreadCount || 0);
          }, 0);
          
          setConversations(sorted);
          setUnreadCount(totalUnread);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error('Error listening to photographer conversations:', err);
          setError(err as Error);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    }
    
    // For partners/admins/editors, use existing logic
    const q1 = query(
      collection(db, 'conversations'),
      where('partnerId', '==', partnerId || userId)
    );
    
    const q2 = query(
      collection(db, 'conversations'),
      where('editorId', '==', userId)
    );

    // Track conversations from both queries
    let partnerConvs = new Map<string, Conversation>();
    let editorConvs = new Map<string, Conversation>();
    let receivedSnapshots = 0;
    
    const mergeAndUpdateConversations = () => {
      // Rebuild the conversation map from scratch on each update
      const convMap = new Map<string, Conversation>();
      
      // Add conversations from both queries, using Map to deduplicate
      partnerConvs.forEach((conv, id) => convMap.set(id, conv));
      editorConvs.forEach((conv, id) => convMap.set(id, conv));
      
      const sorted = Array.from(convMap.values()).sort((a, b) => {
        const aTime = a.lastMessageAt?.getTime() || 0;
        const bTime = b.lastMessageAt?.getTime() || 0;
        return bTime - aTime;
      });
      
      // Calculate total unread message count for this user
      const totalUnread = sorted.reduce((count, conv) => {
        // Check if current user is the editor in this conversation
        const isEditor = conv.editorId === userId;
        // Add the appropriate unread count based on user role
        const unread = isEditor ? (conv.editorUnreadCount || 0) : (conv.partnerUnreadCount || 0);
        return count + unread;
      }, 0);
      
      setConversations(sorted);
      setUnreadCount(totalUnread);
      setLoading(false);
      setError(null);
    };

    const unsubscribe1 = onSnapshot(
      q1,
      (snapshot) => {
        // Rebuild partner conversations map from current snapshot
        partnerConvs = new Map<string, Conversation>();
        snapshot.docs.forEach(doc => {
          partnerConvs.set(doc.id, convertTimestamps(doc) as Conversation);
        });
        receivedSnapshots++;
        // Only update after receiving at least one snapshot from each query
        if (receivedSnapshots >= 2) {
          mergeAndUpdateConversations();
        }
      },
      (err) => {
        console.error('Error listening to partner conversations:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    const unsubscribe2 = onSnapshot(
      q2,
      (snapshot) => {
        // Rebuild editor conversations map from current snapshot
        editorConvs = new Map<string, Conversation>();
        snapshot.docs.forEach(doc => {
          editorConvs.set(doc.id, convertTimestamps(doc) as Conversation);
        });
        receivedSnapshots++;
        // Only update after receiving at least one snapshot from each query
        if (receivedSnapshots >= 2) {
          mergeAndUpdateConversations();
        }
      },
      (err) => {
        console.error('Error listening to editor conversations:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [userId, partnerId, userRole]);

  return { conversations, loading, error, unreadCount };
}

// Real-time notifications for a user
export function useRealtimeNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifs = snapshot.docs.map(doc => convertTimestamps(doc) as Notification);
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.read).length);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error listening to notifications:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { notifications, loading, error, unreadCount };
}

// Real-time jobs for a partner
export function useRealtimeJobs(partnerId: string | null, filters?: {
  status?: string;
  customerId?: string;
  assignedTo?: string;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!partnerId) {
      setJobs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Always sort client-side to avoid Firestore index requirements
    // Firestore requires composite indexes for where + orderBy even with single where clause
    const constraints: QueryConstraint[] = [
      where('partnerId', '==', partnerId)
    ];
    
    if (filters?.status) {
      constraints.push(where('status', '==', filters.status));
    }
    
    if (filters?.customerId) {
      constraints.push(where('customerId', '==', filters.customerId));
    }
    
    if (filters?.assignedTo) {
      constraints.push(where('assignedTo', '==', filters.assignedTo));
    }

    // Don't use orderBy - sort client-side instead to avoid index requirement
    const q = query(collection(db, 'jobs'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const jobList = snapshot.docs.map(doc => convertTimestamps(doc) as Job);
        // Always sort client-side (newest first)
        jobList.sort((a, b) => {
          const aDate = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
          const bDate = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
          return bDate.getTime() - aDate.getTime();
        });
        setJobs(jobList);
        setLoading(false);
        setError(null);
      },
      (err: any) => {
        // Handle missing index error gracefully
        if (err.code === 'failed-precondition' && err.message?.includes('index')) {
          console.warn('Firestore index missing for jobs query. Falling back to client-side sorting.');
          // Try query without any orderBy
          const simpleQ = query(collection(db, 'jobs'), where('partnerId', '==', partnerId));
          const fallbackUnsubscribe = onSnapshot(
            simpleQ,
            (snapshot) => {
              const jobList = snapshot.docs.map(doc => convertTimestamps(doc) as Job);
              jobList.sort((a, b) => {
                const aDate = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
                const bDate = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
                return bDate.getTime() - aDate.getTime();
              });
              setJobs(jobList);
              setLoading(false);
              setError(null);
            },
            (fallbackErr) => {
              console.error('Error listening to jobs (fallback):', fallbackErr);
              setError(fallbackErr as Error);
              setLoading(false);
            }
          );
          return () => fallbackUnsubscribe();
        }
        console.error('Error listening to jobs:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [partnerId, filters?.status, filters?.customerId, filters?.assignedTo]);

  return { jobs, loading, error };
}

// Real-time orders for a partner or editor
export function useRealtimeOrders(partnerId: string | null, editorId?: string, filters?: {
  status?: string;
  jobId?: string;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!partnerId && !editorId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Build query with filters
    // If filters are applied, use simpler query without orderBy to avoid index requirements
    // We'll sort client-side instead
    const hasFilters = filters && (filters.status || filters.jobId);
    
    const constraints: QueryConstraint[] = [];
    
    // Either partner or editor filter (but not both in same query)
    if (editorId) {
      constraints.push(where('assignedTo', '==', editorId));
    } else if (partnerId) {
      constraints.push(where('partnerId', '==', partnerId));
    }
    
    if (filters?.status) {
      constraints.push(where('status', '==', filters.status));
    }
    
    if (filters?.jobId) {
      constraints.push(where('jobId', '==', filters.jobId));
    }

    // Only add orderBy if no filters (to avoid index requirement)
    if (!hasFilters) {
      constraints.push(orderBy('createdAt', 'desc'));
    }

    const q = query(collection(db, 'orders'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const orderList = snapshot.docs.map(doc => convertTimestamps(doc) as Order);
        // Sort client-side if we didn't use orderBy
        if (hasFilters) {
          orderList.sort((a, b) => {
            const aDate = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
            const bDate = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
            return bDate.getTime() - aDate.getTime();
          });
        }
        setOrders(orderList);
        setLoading(false);
        setError(null);
      },
      (err: any) => {
        // Handle missing index error gracefully
        if (err.code === 'failed-precondition' && err.message?.includes('index')) {
          console.warn('Firestore index missing for orders query. Please create the required index or the query will work without sorting.');
        }
        console.error('Error listening to orders:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [partnerId, editorId, filters?.status, filters?.jobId]);

  return { orders, loading, error };
}

// Real-time editor uploads for a job (delivery page)
export function useRealtimeEditorUploads(jobId: string | null) {
  const [uploads, setUploads] = useState<EditorUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!jobId) {
      setUploads([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'editorUploads'),
      where('jobId', '==', jobId),
      orderBy('uploadedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const uploadList = snapshot.docs.map(doc => convertTimestamps(doc) as EditorUpload);
        setUploads(uploadList);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error listening to editor uploads:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [jobId]);

  return { uploads, loading, error };
}

export function useRealtimeFolders(jobId: string | null) {
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!jobId) {
      setFolders([]);
      setLoading(false);
      return;
    }

    // Only use Firestore real-time queries if user is authenticated
    // Public delivery pages should rely on REST API data only
    if (!currentUser) {
      setFolders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'folders'),
      where('jobId', '==', jobId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const folderList = snapshot.docs.map(doc => {
          const data = convertTimestamps(doc);
          // Use uniqueKey from Firestore if available (set when visibility is updated)
          // Otherwise, build it using the same logic as the backend
          const jobKey = data.jobId || jobId || 'job';
          const uniqueKey =
            data.uniqueKey ||
            (data.instanceId && data.folderPath
              ? `${jobKey}::instance::${data.instanceId}::${data.folderPath}`
              : data.folderToken
                ? `${jobKey}::token::${data.folderToken}`
                : data.orderId && data.folderPath
                  ? `${jobKey}::order::${data.orderId}::${data.folderPath}`
                  : data.folderPath
                    ? `${jobKey}::path::${data.folderPath}`
                    : `${jobKey}::legacy::${doc.id}`);
          return {
            ...data,
            uniqueKey,
          };
        });
        setFolders(folderList);
        setLoading(false);
        setError(null);
      },
      (err) => {
        // Only log error if it's not a permissions error (which is expected for unauthenticated users)
        if (err.code !== 'permission-denied') {
          console.error('Error listening to folders:', err);
        }
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [jobId, currentUser]);

  return { folders, loading, error };
}

// Real-time unread message count
export function useRealtimeUnreadCount(userId: string | null, partnerId?: string) {
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setTotalUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Listen to conversations where user is either partner or editor
    const q1 = query(
      collection(db, 'conversations'),
      where('partnerId', '==', partnerId || userId)
    );
    
    const q2 = query(
      collection(db, 'conversations'),
      where('editorId', '==', userId)
    );

    let convMap = new Map<string, Conversation>();
    let unsubscribeCount = 0;
    
    const updateUnreadCount = () => {
      const conversations = Array.from(convMap.values());
      let total = 0;
      
      conversations.forEach(conv => {
        // Determine if user is partner or editor
        if (conv.partnerId === (partnerId || userId)) {
          total += conv.partnerUnreadCount || 0;
        } else if (conv.editorId === userId) {
          total += conv.editorUnreadCount || 0;
        }
      });
      
      setTotalUnreadCount(total);
      setLoading(false);
    };

    const unsubscribe1 = onSnapshot(q1, (snapshot) => {
      snapshot.docs.forEach(doc => {
        convMap.set(doc.id, convertTimestamps(doc) as Conversation);
      });
      unsubscribeCount++;
      if (unsubscribeCount >= 2) updateUnreadCount();
    });

    const unsubscribe2 = onSnapshot(q2, (snapshot) => {
      snapshot.docs.forEach(doc => {
        convMap.set(doc.id, convertTimestamps(doc) as Conversation);
      });
      unsubscribeCount++;
      if (unsubscribeCount >= 2) updateUnreadCount();
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [userId, partnerId]);

  return { totalUnreadCount, loading };
}

// Real-time attention items (completed orders + unread messages)
export function useRealtimeAttentionItems(userId: string | null, partnerId: string | null) {
  const [attentionItems, setAttentionItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Get real-time conversations with unread messages
  const { conversations, loading: conversationsLoading } = useRealtimeConversations(userId, partnerId || undefined);

  // Get real-time completed orders
  const { orders: completedOrders, loading: ordersLoading } = useRealtimeOrders(
    partnerId,
    undefined,
    { status: 'completed' }
  );

  // Get all jobs to map job details to orders
  const { jobs, loading: jobsLoading } = useRealtimeJobs(partnerId);

  useEffect(() => {
    // Wait for all data to load
    if (conversationsLoading || ordersLoading || jobsLoading) {
      setLoading(true);
      return;
    }

    try {
      const items: any[] = [];
      // Create a map that indexes by both job.id (UUID) and job.jobId (NanoID) to handle both cases
      const jobMapById = new Map(jobs.map(job => [job.id, job]));
      const jobMapByJobId = new Map(jobs.map(job => [job.jobId, job]));

      // 1. Add completed orders (ready for delivery)
      completedOrders.forEach(order => {
        // Try to find job by UUID first, then by NanoID
        const job = order.jobId 
          ? (jobMapById.get(order.jobId) || jobMapByJobId.get(order.jobId))
          : null;
        
        if (!job && order.jobId) {
          console.warn('[NeedsAttention] Job not found for order:', {
            orderId: order.id,
            orderJobId: order.jobId,
            availableJobIds: jobs.map(j => ({ id: j.id, jobId: j.jobId }))
          });
        }
        
        const address = job?.address || undefined;
        if (address) {
          console.log('[NeedsAttention] Adding address to attention item:', {
            orderId: order.id,
            address,
            jobId: job?.id,
            jobJobId: job?.jobId
          });
        }
        
        items.push({
          id: order.id,
          type: 'order_completed',
          title: 'Order Ready for Delivery',
          description: job?.address || 'Order completed and ready',
          time: order.dateAccepted || order.createdAt,
          priority: 'high',
          projectName: job?.address || '',
          address: address,
          orderId: order.id,
          jobId: order.jobId,
          orderNumber: order.orderNumber,
          unread: true,
        });
      });

      // 2. Add unread messages
      conversations.forEach(conversation => {
        // Check if current user is partner or editor
        const isPartner = conversation.partnerId === partnerId;
        const unreadCount = isPartner
          ? (conversation.partnerUnreadCount || 0)
          : (conversation.editorUnreadCount || 0);

        if (unreadCount > 0) {
          items.push({
            id: conversation.id,
            type: 'message',
            title: `${unreadCount} New Message${unreadCount > 1 ? 's' : ''}`,
            description: isPartner
              ? `From ${conversation.editorName}`
              : `From ${conversation.partnerName}`,
            time: conversation.lastMessageAt,
            priority: 'medium',
            projectName: conversation.orderId ? '' : 'General',
            conversationId: conversation.id,
            unreadCount,
            unread: true,
          });
        }
      });

      // Sort by time (most recent first)
      items.sort((a, b) => {
        const timeA = a.time ? new Date(a.time).getTime() : 0;
        const timeB = b.time ? new Date(b.time).getTime() : 0;
        return timeB - timeA;
      });

      setAttentionItems(items);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error processing attention items:', err);
      setError(err as Error);
      setLoading(false);
    }
  }, [conversations, completedOrders, jobs, conversationsLoading, ordersLoading, jobsLoading, userId, partnerId]);

  return { attentionItems, loading, error };
}
