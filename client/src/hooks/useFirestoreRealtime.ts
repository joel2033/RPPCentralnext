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
export function useRealtimeConversations(userId: string | null, partnerId?: string) {
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
    
    // Listen to conversations where user is either partner or editor
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
  }, [userId, partnerId]);

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
    
    // Build query with filters
    const constraints: QueryConstraint[] = [
      where('partnerId', '==', partnerId),
      orderBy('createdAt', 'desc')
    ];
    
    if (filters?.status) {
      constraints.splice(1, 0, where('status', '==', filters.status));
    }
    
    if (filters?.customerId) {
      constraints.splice(1, 0, where('customerId', '==', filters.customerId));
    }
    
    if (filters?.assignedTo) {
      constraints.splice(1, 0, where('assignedTo', '==', filters.assignedTo));
    }

    const q = query(collection(db, 'jobs'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const jobList = snapshot.docs.map(doc => convertTimestamps(doc) as Job);
        setJobs(jobList);
        setLoading(false);
        setError(null);
      },
      (err) => {
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
    const constraints: QueryConstraint[] = [
      orderBy('createdAt', 'desc')
    ];
    
    // Either partner or editor filter (but not both in same query)
    if (editorId) {
      constraints.unshift(where('assignedTo', '==', editorId));
    } else if (partnerId) {
      constraints.unshift(where('partnerId', '==', partnerId));
    }
    
    if (filters?.status) {
      constraints.splice(1, 0, where('status', '==', filters.status));
    }
    
    if (filters?.jobId) {
      constraints.splice(1, 0, where('jobId', '==', filters.jobId));
    }

    const q = query(collection(db, 'orders'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const orderList = snapshot.docs.map(doc => convertTimestamps(doc) as Order);
        setOrders(orderList);
        setLoading(false);
        setError(null);
      },
      (err) => {
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
      const jobMap = new Map(jobs.map(job => [job.id, job]));

      // 1. Add completed orders (ready for delivery)
      completedOrders.forEach(order => {
        const job = order.jobId ? jobMap.get(order.jobId) : null;
        items.push({
          id: order.id,
          type: 'order_completed',
          title: 'Order Ready for Delivery',
          description: job?.address || 'Order completed and ready',
          time: order.dateAccepted || order.createdAt,
          priority: 'high',
          projectName: job?.address || '',
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
