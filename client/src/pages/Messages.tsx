import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, MessageSquare, Loader2, Plus, Info, Check, CheckCheck } from "lucide-react";
import { useRealtimeConversations, useRealtimeMessages } from "@/hooks/useFirestoreRealtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getAuth } from "firebase/auth";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useEditorAuth } from "@/contexts/EditorAuthContext";

const auth = getAuth();

interface Conversation {
  id: string;
  partnerId: string;
  editorId: string;
  partnerName: string;
  editorName: string;
  partnerEmail: string;
  editorEmail: string;
  lastMessageAt: Date | null;
  lastMessageText: string | null;
  partnerUnreadCount: number | null;
  editorUnreadCount: number | null;
  createdAt: Date | null;
  orderId: string | null;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  senderRole: "partner" | "editor";
  content: string;
  readAt: Date | null;
  createdAt: Date | null;
}

interface ConversationWithMessages {
  conversation: Conversation;
  messages: Message[];
}

interface Partnership {
  id: string;
  editorId: string;
  editorStudioName: string;
  editorEmail: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  isActive: boolean;
  createdAt: string;
}

interface Order {
  id: string;
  orderNumber: string;
  jobId: string;
  jobAddress: string;
  status: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  type: "editor" | "team";
}

export default function Messages() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [newConversationDialogOpen, setNewConversationDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [isGeneralConversation, setIsGeneralConversation] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<Map<string, Message>>(new Map());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUser = auth.currentUser;
  const { userData: partnerData } = useAuth();
  const { userData: editorData } = useEditorAuth();

  const currentUserEmail = currentUser?.email || editorData?.email || partnerData?.email;
  const currentUserId = currentUser?.uid || editorData?.uid;
  const currentUserPartnerId = partnerData?.partnerId;

  const { conversations = [], loading: conversationsLoading } = useRealtimeConversations(
    currentUserId || null,
    currentUserPartnerId,
    partnerData?.role
  );

  const { messages = [], loading: messagesLoading } = useRealtimeMessages(selectedConversationId);

  const displayMessages = selectedConversationId
    ? (() => {
        const optimisticMsgs = Array.from(optimisticMessages.values()).filter(
          msg => msg.conversationId === selectedConversationId
        );
        
        const filteredOptimistic = optimisticMsgs.filter(optMsg => {
          const optContent = optMsg.content.trim();
          const optTime = optMsg.createdAt instanceof Date ? optMsg.createdAt : new Date(optMsg.createdAt);
          const hasMatchingRealMessage = messages.some(realMsg => {
            const realContent = realMsg.content.trim();
            const realTime = realMsg.createdAt instanceof Date ? realMsg.createdAt : new Date(realMsg.createdAt);
            const timeDiff = Math.abs(realTime.getTime() - optTime.getTime());
            return realContent === optContent && timeDiff < 5000;
          });
          return !hasMatchingRealMessage;
        });
        
        return [
          ...messages,
          ...filteredOptimistic,
        ].sort((a, b) => {
          const aDate = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
          const bDate = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
          return aDate.getTime() - bDate.getTime();
        });
      })()
    : messages;

  const isEditor = editorData?.role === "editor";
  const isPartner = partnerData?.role === "partner";
  const isPhotographer = partnerData?.role === "photographer";

  const filteredConversations = isPhotographer
    ? conversations.filter(conv => {
        return (conv as any).participantId === currentUserId || conv.partnerId === currentUserPartnerId;
      })
    : conversations;
  
  const selectedConversation = filteredConversations.find(c => c.id === selectedConversationId);

  const { data: editorPartnerships = [] } = useQuery<Partnership[]>({
    queryKey: ["/api/editor/partnerships"],
    enabled: isEditor,
  });

  const { data: partnerPartnerships = [] } = useQuery<Partnership[]>({
    queryKey: ["/api/partnerships"],
    enabled: isPartner || isPhotographer,
  });

  const { data: partnerOrders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: isPartner || isPhotographer,
  });

  const { data: editorOrders = [] } = useQuery<Order[]>({
    queryKey: ["/api/editor/orders"],
    enabled: isEditor,
  });

  const orders = isEditor ? editorOrders : partnerOrders;
  const orderMap = new Map(orders.map(order => [order.id, order]));

  useEffect(() => {
    if (newConversationDialogOpen) {
      if (isEditor) {
        queryClient.invalidateQueries({ queryKey: ["/api/editor/orders"] });
        queryClient.refetchQueries({ queryKey: ["/api/editor/orders"], exact: true });
      } else if (isPartner || isPhotographer) {
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
        queryClient.refetchQueries({ queryKey: ["/api/orders"], exact: true });
      }
    }
  }, [newConversationDialogOpen, isEditor, isPartner]);

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: [`/api/team/invites/${partnerData?.partnerId}`],
    enabled: (isPartner || isPhotographer) && !!partnerData?.partnerId,
  });

  const partnerships = isEditor ? editorPartnerships : partnerPartnerships;

  const { data: settings } = useQuery<{ editorDisplayNames?: Record<string, string> }>({
    queryKey: ['/api/settings'],
    enabled: isPhotographer || isPartner,
  });

  const getEditorDisplayName = (editorId: string, defaultName: string): string => {
    if (isPhotographer && settings?.editorDisplayNames?.[editorId]) {
      return settings.editorDisplayNames[editorId];
    }
    return defaultName;
  };

  const contacts: Contact[] = isEditor
    ? editorPartnerships.filter(p => p.isActive).map(p => ({
        id: p.partnerId,
        name: p.partnerName,
        email: p.partnerEmail,
        type: "editor" as const,
      }))
    : [
        ...partnerPartnerships.filter(p => p.isActive).map(p => ({
          id: p.editorId,
          name: getEditorDisplayName(p.editorId, p.editorStudioName),
          email: p.editorEmail,
          type: "editor" as const,
        })),
        ...teamMembers.filter(tm => tm.status === 'active').map(tm => ({
          id: tm.email,
          name: tm.name,
          email: tm.email,
          type: "team" as const,
        })),
      ];

  const markAsReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/conversations/${conversationId}/read`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to mark as read");
      return response.json();
    },
    onMutate: async (conversationId) => {
      await queryClient.cancelQueries({ queryKey: ["/api/conversations"] });
      const previousConversations = queryClient.getQueryData<Conversation[]>(["/api/conversations"]);
      queryClient.setQueryData<Conversation[]>(["/api/conversations"], (old) => {
        if (!old) return old;
        return old.map((conv) => {
          if (conv.id === conversationId) {
            const isEditor = conv.editorId === currentUserId;
            return {
              ...conv,
              partnerUnreadCount: isEditor ? conv.partnerUnreadCount : 0,
              editorUnreadCount: isEditor ? 0 : conv.editorUnreadCount,
            };
          }
          return conv;
        });
      });
      return { previousConversations };
    },
    onError: (err, conversationId, context) => {
      if (context?.previousConversations) {
        queryClient.setQueryData(["/api/conversations"], context.previousConversations);
      }
    },
    onSettled: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/conversations"], exact: true });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error("Failed to send message");
      return response.json();
    },
    onMutate: async ({ conversationId, content }) => {
      await queryClient.cancelQueries({ queryKey: [`/api/conversations/${conversationId}`] });
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}-${Math.random()}`,
        conversationId,
        senderId: currentUserId || '',
        senderEmail: currentUserEmail || '',
        senderName: isEditor ? editorData?.studioName || editorData?.email || 'You' : partnerData?.email || 'You',
        senderRole: isEditor ? 'editor' : 'partner',
        content: content.trim(),
        readAt: null,
        createdAt: new Date(),
      };
      setOptimisticMessages(prev => {
        const newMap = new Map(prev);
        newMap.set(optimisticMessage.id, optimisticMessage);
        return newMap;
      });
      setMessageInput("");
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      });
      return { optimisticMessage };
    },
    onSuccess: (data, variables, context) => {
      setTimeout(() => {
        if (context?.optimisticMessage) {
          setOptimisticMessages(prev => {
            const newMap = new Map(prev);
            newMap.delete(context.optimisticMessage.id);
            return newMap;
          });
        }
      }, 100);
    },
    onError: (error, variables, context) => {
      if (context?.optimisticMessage) {
        setOptimisticMessages(prev => {
          const newMap = new Map(prev);
          newMap.delete(context.optimisticMessage.id);
          return newMap;
        });
      }
      setMessageInput(variables.content);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createConversationMutation = useMutation({
    mutationFn: async ({ contactId, orderId }: { contactId: string; orderId?: string }) => {
      const token = await auth.currentUser?.getIdToken();
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) throw new Error("Contact not found");

      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          isEditor
            ? {
                partnerId: contact.id,
                partnerEmail: contact.email,
                partnerName: contact.name,
                orderId: orderId || undefined,
              }
            : {
                editorId: contact.id,
                editorEmail: contact.email,
                editorName: contact.name,
                orderId: orderId || undefined,
              }
        ),
      });
      if (!response.ok) throw new Error("Failed to create conversation");
      return response.json();
    },
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setNewConversationDialogOpen(false);
      setSelectedConversationId(conversation.id);
      setSelectedOrderId("");
      setSelectedContactId("");
      setIsGeneralConversation(false);
      toast({
        title: "Success",
        description: "Conversation started!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start conversation. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (messages.length > 0 && optimisticMessages.size > 0) {
      const optimisticMsgs = Array.from(optimisticMessages.values());
      const toRemove: string[] = [];
      
      optimisticMsgs.forEach(optMsg => {
        const optContent = optMsg.content.trim();
        const optTime = optMsg.createdAt instanceof Date ? optMsg.createdAt : new Date(optMsg.createdAt);
        
        const hasMatchingRealMessage = messages.some(realMsg => {
          const realContent = realMsg.content.trim();
          const realTime = realMsg.createdAt instanceof Date ? realMsg.createdAt : new Date(realMsg.createdAt);
          const timeDiff = Math.abs(realTime.getTime() - optTime.getTime());
          const sameSender = realMsg.senderId === optMsg.senderId || realMsg.senderEmail === optMsg.senderEmail;
          return realContent === optContent && sameSender && timeDiff < 10000;
        });
        
        if (hasMatchingRealMessage) {
          toRemove.push(optMsg.id);
        }
      });
      
      if (toRemove.length > 0) {
        setOptimisticMessages(prev => {
          const newMap = new Map(prev);
          toRemove.forEach(id => newMap.delete(id));
          return newMap;
        });
      }
    }
  }, [messages, optimisticMessages]);

  useEffect(() => {
    if (displayMessages && displayMessages.length > 0) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      });
    }
  }, [displayMessages.length]);

  useEffect(() => {
    if (selectedConversationId) {
      markAsReadMutation.mutate(selectedConversationId);
    }
  }, [selectedConversationId]);

  const handleSendMessage = () => {
    if (!selectedConversationId || !messageInput.trim()) return;
    sendMessageMutation.mutate({
      conversationId: selectedConversationId,
      content: messageInput.trim(),
    });
  };

  const handleStartConversation = () => {
    if (!selectedContactId) {
      toast({
        title: "Missing Information",
        description: "Please select a contact to start messaging.",
        variant: "destructive",
      });
      return;
    }

    if (!isGeneralConversation && !selectedOrderId) {
      toast({
        title: "Missing Information",
        description: "Please select an order or check 'General conversation'.",
        variant: "destructive",
      });
      return;
    }

    createConversationMutation.mutate({
      contactId: selectedContactId,
      orderId: isGeneralConversation ? undefined : selectedOrderId,
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (dateInput: string | Date | null) => {
    if (!dateInput) return '';
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    } else if (diffInHours < 48) {
      return "Yesterday";
    } else if (diffInHours < 168) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  };

  const getOtherParticipant = (conversation: Conversation) => {
    const isEditor = conversation.editorId === currentUserId;
    const isPartner = !isEditor;
    
    let editorName = conversation.editorName;
    if (isPhotographer && isPartner && settings?.editorDisplayNames?.[conversation.editorId]) {
      editorName = settings.editorDisplayNames[conversation.editorId];
    }
    
    return {
      name: isPartner ? editorName : conversation.partnerName,
      email: isPartner ? conversation.editorEmail : conversation.partnerEmail,
      unreadCount: isPartner ? (conversation.partnerUnreadCount || 0) : (conversation.editorUnreadCount || 0),
    };
  };

  const getOrderDetails = (orderId: string | null) => {
    if (!orderId) return null;
    return orderMap.get(orderId);
  };

  if (conversationsLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-rpp-grey-pale">
        <Loader2 className="h-8 w-8 animate-spin text-rpp-orange" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4 p-6 bg-rpp-grey-pale">
      {/* Conversations List */}
      <Card className="w-96 flex flex-col overflow-hidden rounded-2xl border border-rpp-grey-lighter bg-white shadow-sm" style={{ overflowX: 'hidden' }}>
        <div className="p-4 border-b border-rpp-grey-lighter flex items-center justify-between">
          <h2 className="text-lg font-semibold text-rpp-grey-darkest flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-rpp-orange" />
            Messages
          </h2>
          {((isPartner || isPhotographer || isEditor) && (contacts.length > 0 || (isPhotographer && orders.length > 0))) && (
            <Dialog open={newConversationDialogOpen} onOpenChange={setNewConversationDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="sm" 
                  className="btn-primary-gradient rounded-xl"
                  data-testid="button-new-conversation"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-rpp-grey-darkest">
                    <MessageSquare className="h-5 w-5 text-rpp-orange" />
                    Start New Conversation
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-rpp-grey">
                  {isEditor 
                    ? "Select an order and partner to begin messaging"
                    : "Select an order and editor to begin messaging"}
                </p>

                <div className="space-y-4 py-4">
                  {/* Order Selection */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="order-select" className="text-rpp-grey-darkest">Select Order</Label>
                      <span className="text-semantic-red text-sm">*</span>
                    </div>
                    <Select 
                      value={selectedOrderId} 
                      onValueChange={setSelectedOrderId}
                      disabled={isGeneralConversation}
                    >
                      <SelectTrigger 
                        id="order-select"
                        data-testid="select-order"
                        className={cn(
                          "rounded-xl border-rpp-grey-lighter focus:border-rpp-orange",
                          isGeneralConversation && "opacity-50"
                        )}
                      >
                        <SelectValue placeholder="Choose an order..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {orders.map((order) => (
                          <SelectItem key={order.id} value={order.id} className="rounded-lg">
                            {order.orderNumber} • {order.jobAddress}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* General Conversation Checkbox */}
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox 
                        id="general-conversation"
                        checked={isGeneralConversation}
                        onCheckedChange={(checked) => {
                          setIsGeneralConversation(checked as boolean);
                          if (checked) {
                            setSelectedOrderId("");
                          }
                        }}
                        className="border-rpp-grey-lighter data-[state=checked]:bg-rpp-orange data-[state=checked]:border-rpp-orange"
                        data-testid="checkbox-general-conversation"
                      />
                      <label
                        htmlFor="general-conversation"
                        className="text-sm font-medium text-rpp-grey-darkest cursor-pointer"
                      >
                        General conversation
                      </label>
                    </div>
                  </div>

                  {/* Contact Selection */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="contact-select" className="text-rpp-grey-darkest">
                        {isEditor ? "Select Partner" : "Select Contact"}
                      </Label>
                      <span className="text-semantic-red text-sm">*</span>
                    </div>
                    <Select 
                      value={selectedContactId} 
                      onValueChange={setSelectedContactId}
                    >
                      <SelectTrigger 
                        id="contact-select"
                        data-testid="select-contact"
                        className="rounded-xl border-rpp-grey-lighter focus:border-rpp-orange"
                      >
                        <SelectValue placeholder={isEditor ? "Choose a partner..." : "Choose a contact..."} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {isEditor ? (
                          contacts.map((contact) => (
                            <SelectItem key={contact.id} value={contact.id} className="rounded-lg">
                              {contact.name}
                            </SelectItem>
                          ))
                        ) : (
                          <>
                            {contacts.filter(c => c.type === "editor").length > 0 && (
                              <SelectGroup>
                                <SelectLabel>Editors</SelectLabel>
                                {contacts.filter(c => c.type === "editor").map((contact) => (
                                  <SelectItem key={contact.id} value={contact.id} className="rounded-lg">
                                    {contact.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}
                            {contacts.filter(c => c.type === "team").length > 0 && (
                              <SelectGroup>
                                <SelectLabel>Team Members</SelectLabel>
                                {contacts.filter(c => c.type === "team").map((contact) => (
                                  <SelectItem key={contact.id} value={contact.id} className="rounded-lg">
                                    {contact.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Order Assignment Info */}
                  {!isGeneralConversation && selectedOrderId && (
                    <div className="bg-semantic-blue-light border border-semantic-blue/30 rounded-xl p-3">
                      <div className="flex gap-2">
                        <Info className="h-4 w-4 text-semantic-blue mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-sm font-medium text-semantic-blue-dark mb-1">Order Assignment</h4>
                          <p className="text-xs text-semantic-blue">
                            This conversation will be linked to the selected order.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNewConversationDialogOpen(false);
                      setSelectedOrderId("");
                      setSelectedContactId("");
                      setIsGeneralConversation(false);
                    }}
                    className="rounded-xl border-rpp-grey-lighter"
                    data-testid="button-cancel-conversation"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleStartConversation}
                    disabled={createConversationMutation.isPending || !selectedContactId || (!isGeneralConversation && !selectedOrderId)}
                    className="btn-primary-gradient rounded-xl"
                    data-testid="button-start-conversation"
                  >
                    {createConversationMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Start Conversation
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <ScrollArea className="flex-1 overflow-x-hidden">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-rpp-grey-lightest rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-8 w-8 text-rpp-grey-light" />
              </div>
              <p className="text-sm font-medium text-rpp-grey-darkest mb-1">No conversations yet</p>
              <p className="text-xs text-rpp-grey">Start a new conversation to begin messaging</p>
            </div>
          ) : (
            <div className="p-2 space-y-2 max-w-full overflow-x-hidden">
              {filteredConversations.map((conversation) => {
                const participant = getOtherParticipant(conversation);
                const isSelected = selectedConversationId === conversation.id;
                const orderDetails = getOrderDetails(conversation.orderId);
                return (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedConversationId(conversation.id)}
                    className={cn(
                      "w-full max-w-full p-3 rounded-xl text-left transition-all duration-200",
                      "hover:shadow-md active:scale-[0.99]",
                      "border overflow-hidden card-hover",
                      isSelected
                        ? "bg-rpp-orange-subtle border-rpp-orange shadow-sm"
                        : participant.unreadCount > 0
                          ? "bg-rpp-orange-subtle/50 border-rpp-orange/50"
                          : "border-rpp-grey-lighter hover:border-rpp-orange/30"
                    )}
                    data-testid={`conversation-card-${conversation.id}`}
                  >
                    <div className="flex items-start gap-3 min-w-0 max-w-full">
                      <div className="relative flex-shrink-0">
                        <Avatar className={cn(
                          "ring-2 transition-all duration-200",
                          isSelected ? "ring-rpp-orange" : "ring-transparent"
                        )}>
                          <AvatarFallback className={cn(
                            "font-semibold bg-rpp-orange text-white",
                            isSelected && "bg-rpp-orange"
                          )}>
                            {getInitials(participant.name)}
                          </AvatarFallback>
                        </Avatar>
                        {participant.unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-semantic-red text-white text-xs font-bold">
                            {participant.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden" style={{ width: 0 }}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className={cn(
                            "font-medium truncate transition-colors min-w-0 flex-1 text-rpp-grey-darkest",
                            isSelected && "text-rpp-orange"
                          )} style={{ minWidth: 0 }}>
                            {participant.name}
                          </p>
                          <span className="text-xs text-rpp-grey whitespace-nowrap flex-shrink-0 ml-2">
                            {formatTime(conversation.lastMessageAt)}
                          </span>
                        </div>
                        {orderDetails && (
                          <div className="mb-1 overflow-hidden" style={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
                            <p 
                              className="text-xs text-semantic-blue font-medium block truncate"
                            >
                              {orderDetails.orderNumber} • {orderDetails.jobAddress}
                            </p>
                          </div>
                        )}
                        <p className={cn(
                          "text-sm truncate transition-colors min-w-0 max-w-full block",
                          participant.unreadCount > 0
                            ? "text-rpp-grey-darkest font-medium"
                            : "text-rpp-grey"
                        )}>
                          {conversation.lastMessageText || "No messages yet"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Messages Area */}
      <Card className="flex-1 flex flex-col overflow-hidden rounded-2xl border border-rpp-grey-lighter bg-white shadow-sm">
        {selectedConversationId ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b border-rpp-grey-lighter bg-rpp-grey-lightest/50">
              {selectedConversation && (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-12 w-12 ring-2 ring-rpp-orange/20">
                      <AvatarFallback className="bg-rpp-orange text-white font-semibold text-base">
                        {getInitials(getOtherParticipant(selectedConversation).name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-base text-rpp-grey-darkest">
                        {getOtherParticipant(selectedConversation).name}
                      </p>
                      <p className="text-sm text-rpp-grey">
                        {getOtherParticipant(selectedConversation).email}
                      </p>
                    </div>
                  </div>
                  {selectedConversation.orderId && getOrderDetails(selectedConversation.orderId) && (
                    <div className="bg-semantic-blue-light border border-semantic-blue/20 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 flex-1">
                          <span className="text-xs font-medium text-semantic-blue-dark">Order:</span>
                          <span className="text-sm font-semibold text-semantic-blue">
                            {getOrderDetails(selectedConversation.orderId)?.orderNumber}
                          </span>
                          <span className="text-xs text-semantic-blue">•</span>
                          <span className="text-xs text-semantic-blue truncate">
                            {getOrderDetails(selectedConversation.orderId)?.jobAddress}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 max-h-[calc(100vh-20rem)]">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-rpp-orange" />
                </div>
              ) : (
                <div className="space-y-3 pb-4">
                  {displayMessages.map((message, index) => {
                    const isCurrentUser = message.senderEmail?.toLowerCase() === currentUserEmail?.toLowerCase();
                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex animate-in fade-in slide-in-from-bottom-2 duration-300",
                          isCurrentUser ? "justify-end" : "justify-start"
                        )}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-2xl px-4 py-3 shadow-sm transition-all",
                            isCurrentUser 
                              ? "bg-rpp-orange text-white rounded-br-md" 
                              : "bg-rpp-grey-lightest text-rpp-grey-darkest rounded-bl-md"
                          )}
                        >
                          <p className={cn(
                              "whitespace-pre-wrap break-words text-[15px]",
                              isCurrentUser && "text-white"
                            )}>
                            {message.content}
                          </p>
                          <p
                            className={cn(
                              "text-xs mt-1.5 flex items-center gap-1",
                              isCurrentUser ? "justify-end text-white/70" : "justify-start text-rpp-grey"
                            )}
                          >
                            {formatTime(message.createdAt)}
                            {isCurrentUser && (
                              <CheckCheck className="w-3.5 h-3.5 ml-1" />
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-rpp-grey-lighter bg-rpp-grey-lightest/30">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex gap-2"
              >
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
                  className="rounded-xl border-rpp-grey-lighter focus:border-rpp-orange"
                  data-testid="input-message"
                  autoFocus
                />
                <Button
                  type="submit"
                  disabled={!messageInput.trim()}
                  size="icon"
                  className={cn(
                    "rounded-xl transition-all",
                    messageInput.trim() 
                      ? "btn-primary-gradient" 
                      : "bg-rpp-grey-lighter text-rpp-grey"
                  )}
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-8">
              <div className="w-20 h-20 bg-rpp-grey-lightest rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-10 w-10 text-rpp-grey-light" />
              </div>
              <p className="text-lg font-semibold text-rpp-grey-darkest mb-2">No conversation selected</p>
              <p className="text-sm text-rpp-grey max-w-sm mx-auto">
                Choose a conversation from the list or start a new one to begin messaging
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
