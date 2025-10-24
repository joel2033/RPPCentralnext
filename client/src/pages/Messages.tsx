import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, MessageSquare, Loader2, Plus, Info } from "lucide-react";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUser = auth.currentUser;
  const { userData: partnerData } = useAuth();
  const { userData: editorData } = useEditorAuth();

  // Determine current user's email and ID based on role
  const currentUserEmail = currentUser?.email || editorData?.email || partnerData?.email;
  const currentUserId = currentUser?.uid || editorData?.uid;
  const currentUserPartnerId = partnerData?.partnerId;

  // Real-time conversations with Firestore
  const { conversations = [], loading: conversationsLoading } = useRealtimeConversations(
    currentUserId || null,
    currentUserPartnerId
  );

  // Real-time messages with Firestore
  const { messages = [], loading: messagesLoading } = useRealtimeMessages(selectedConversationId);

  // Get the selected conversation from the conversations array
  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  // Determine if current user is an editor or partner
  const isEditor = editorData?.role === "editor";
  const isPartner = partnerData?.role === "partner";

  // Fetch partnerships for editors
  const { data: editorPartnerships = [] } = useQuery<Partnership[]>({
    queryKey: ["/api/editor/partnerships"],
    enabled: isEditor,
  });

  // Fetch partnerships for partners
  const { data: partnerPartnerships = [] } = useQuery<Partnership[]>({
    queryKey: ["/api/partnerships"],
    enabled: isPartner,
  });

  // Fetch orders (for partners only)
  const { data: partnerOrders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: isPartner,
  });

  // Fetch orders for editors
  const { data: editorOrders = [] } = useQuery<Order[]>({
    queryKey: ["/api/editor/orders"],
    enabled: isEditor,
  });

  // Use appropriate orders list based on role
  const orders = isEditor ? editorOrders : partnerOrders;

  // Fetch team members (for partners only)
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: [`/api/team/invites/${partnerData?.partnerId}`],
    enabled: isPartner && !!partnerData?.partnerId,
  });

  // Use the appropriate partnerships list based on user role
  const partnerships = isEditor ? editorPartnerships : partnerPartnerships;

  // Combine editors and team members into contacts list (for partners)
  // For editors, combine partners into contacts list
  const contacts: Contact[] = isEditor
    ? editorPartnerships.filter(p => p.isActive).map(p => ({
        id: p.partnerId,
        name: p.partnerName,
        email: p.partnerEmail,
        type: "editor" as const, // Use "editor" type for consistency, even though these are partners
      }))
    : [
        ...partnerPartnerships.filter(p => p.isActive).map(p => ({
          id: p.editorId,
          name: p.editorStudioName,
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

  // Mark conversation as read when selected
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
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/conversations"] });

      // Snapshot the previous value
      const previousConversations = queryClient.getQueryData<Conversation[]>(["/api/conversations"]);

      // Optimistically update the conversation's unread count to 0
      queryClient.setQueryData<Conversation[]>(["/api/conversations"], (old) => {
        if (!old) return old;
        return old.map((conv) => {
          if (conv.id === conversationId) {
            // Check if current user is the editor in this conversation
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

      // Return context with previous data for rollback on error
      return { previousConversations };
    },
    onError: (err, conversationId, context) => {
      // Rollback to previous data on error
      if (context?.previousConversations) {
        queryClient.setQueryData(["/api/conversations"], context.previousConversations);
      }
    },
    onSettled: async () => {
      // Always refetch after mutation to ensure we have server state
      await queryClient.refetchQueries({ queryKey: ["/api/conversations"], exact: true });
    },
  });

  // Send message mutation
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
    onSuccess: async (data, variables) => {
      setMessageInput("");
      // Force immediate refetch with the exact query key
      await queryClient.refetchQueries({ 
        queryKey: [`/api/conversations/${variables.conversationId}`],
        exact: true 
      });
      await queryClient.refetchQueries({ 
        queryKey: ["/api/conversations"],
        exact: true 
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async ({ contactId, orderId }: { contactId: string; orderId?: string }) => {
      const token = await auth.currentUser?.getIdToken();

      // Find the contact (editor/partner or team member)
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
                // Editor creating conversation with partner
                partnerId: contact.id,
                partnerEmail: contact.email,
                partnerName: contact.name,
                orderId: orderId || undefined,
              }
            : {
                // Partner creating conversation with editor
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

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages && messages.length > 0) {
      // Small delay to ensure DOM has updated
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [messages, messages.length]);

  // Mark conversation as read when opened
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

    // Backend will handle duplicate conversation checking
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
    // Check if current user is the editor in this conversation
    const isEditor = conversation.editorId === currentUserId;
    const isPartner = !isEditor;
    return {
      name: isPartner ? conversation.editorName : conversation.partnerName,
      email: isPartner ? conversation.editorEmail : conversation.partnerEmail,
      unreadCount: isPartner ? (conversation.partnerUnreadCount || 0) : (conversation.editorUnreadCount || 0),
    };
  };

  if (conversationsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4 px-6 pt-6">
      {/* Conversations List */}
      <Card className="w-96 flex flex-col overflow-hidden shadow-lg">
        <div className="p-4 border-b flex items-center justify-between bg-background/50 backdrop-blur-sm">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-rpp-red-main" />
            Messages
          </h2>
          {(isPartner || isEditor) && partnerships.length > 0 && (
            <Dialog open={newConversationDialogOpen} onOpenChange={setNewConversationDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="sm" 
                  className="!bg-[#f2572c] hover:!bg-rpp-red-dark text-white"
                  data-testid="button-new-conversation"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-rpp-red-main" />
                    Start New Conversation
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  {isEditor 
                    ? "Select an order and partner to begin messaging"
                    : "Select an order and editor to begin messaging"}
                </p>

                <div className="space-y-4 py-4">
                  {/* Order Selection */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="order-select">Select Order</Label>
                      <span className="text-red-500 text-sm">*</span>
                    </div>
                    <Select 
                      value={selectedOrderId} 
                      onValueChange={setSelectedOrderId}
                      disabled={isGeneralConversation}
                    >
                      <SelectTrigger 
                        id="order-select"
                        data-testid="select-order"
                        className={isGeneralConversation ? "opacity-50" : ""}
                      >
                        <SelectValue placeholder="Choose an order..." />
                      </SelectTrigger>
                      <SelectContent>
                        {orders.map((order) => (
                          <SelectItem key={order.id} value={order.id}>
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
                        data-testid="checkbox-general-conversation"
                      />
                      <label
                        htmlFor="general-conversation"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        General conversation
                      </label>
                    </div>
                  </div>

                  {/* Contact Selection */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="contact-select">
                        {isEditor ? "Select Partner" : "Select Contact"}
                      </Label>
                      <span className="text-red-500 text-sm">*</span>
                    </div>
                    <Select 
                      value={selectedContactId} 
                      onValueChange={setSelectedContactId}
                    >
                      <SelectTrigger 
                        id="contact-select"
                        data-testid="select-contact"
                      >
                        <SelectValue placeholder={isEditor ? "Choose a partner..." : "Choose a contact..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {isEditor ? (
                          // For editors, show partners
                          contacts.map((contact) => (
                            <SelectItem key={contact.id} value={contact.id}>
                              {contact.name}
                            </SelectItem>
                          ))
                        ) : (
                          // For partners, show editors and team members grouped
                          <>
                            {contacts.filter(c => c.type === "editor").length > 0 && (
                              <SelectGroup>
                                <SelectLabel>Editors</SelectLabel>
                                {contacts.filter(c => c.type === "editor").map((contact) => (
                                  <SelectItem key={contact.id} value={contact.id}>
                                    {contact.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}
                            {contacts.filter(c => c.type === "team").length > 0 && (
                              <SelectGroup>
                                <SelectLabel>Team Members</SelectLabel>
                                {contacts.filter(c => c.type === "team").map((contact) => (
                                  <SelectItem key={contact.id} value={contact.id}>
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
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex gap-2">
                        <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-sm font-medium text-blue-900 mb-1">Order Assignment</h4>
                          <p className="text-xs text-blue-800">
                            This conversation will be linked to the selected order. You can discuss editing requirements, share feedback, and track progress.
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
                    data-testid="button-cancel-conversation"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleStartConversation}
                    disabled={createConversationMutation.isPending || !selectedContactId || (!isGeneralConversation && !selectedOrderId)}
                    className="hover:bg-rpp-red-dark text-white bg-[#f47b5c]"
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
        <ScrollArea className="flex-1">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageSquare className="h-16 w-16 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start a new conversation to begin messaging</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {conversations.map((conversation) => {
                const participant = getOtherParticipant(conversation);
                const isSelected = selectedConversationId === conversation.id;
                return (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedConversationId(conversation.id)}
                    className={cn(
                      "w-full p-3 rounded-lg text-left transition-all duration-200",
                      "hover:shadow-md hover:scale-[1.01] active:scale-[0.99]",
                      "border",
                      isSelected 
                        ? "bg-rpp-red-main/10 border-rpp-red-main shadow-md" 
                        : participant.unreadCount > 0
                          ? "bg-rpp-red-lighter/90 border-rpp-red-main shadow-lg ring-2 ring-rpp-red-main/50"
                          : "border-transparent hover:bg-accent hover:border-muted-foreground/20"
                    )}
                    data-testid={`conversation-card-${conversation.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <Avatar className={cn(
                          "ring-2 transition-all duration-200",
                          isSelected ? "ring-rpp-red-main" : "ring-transparent"
                        )}>
                          <AvatarFallback className={cn(
                            "font-semibold",
                            isSelected && "bg-rpp-red-main/20 text-rpp-red-main"
                          )}>
                            {getInitials(participant.name)}
                          </AvatarFallback>
                        </Avatar>
                        {participant.unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                            {participant.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className={cn(
                            "font-medium truncate transition-colors",
                            isSelected && "text-rpp-red-main"
                          )}>
                            {participant.name}
                          </p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatTime(conversation.lastMessageAt)}
                          </span>
                        </div>
                        <p className={cn(
                          "text-sm truncate transition-colors",
                          participant.unreadCount > 0 
                            ? "text-foreground font-medium" 
                            : "text-muted-foreground"
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
      <Card className="flex-1 flex flex-col overflow-hidden shadow-lg">
        {selectedConversationId ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b bg-muted/30">
              {selectedConversation && (
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 ring-2 ring-rpp-red-main/20">
                    <AvatarFallback className="bg-rpp-red-main/10 text-rpp-red-main font-semibold text-base">
                      {getInitials(getOtherParticipant(selectedConversation).name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-base">
                      {getOtherParticipant(selectedConversation).name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {getOtherParticipant(selectedConversation).email}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 max-h-[calc(100vh-20rem)]">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3 pb-4">
                  {messages.map((message, index) => {
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
                            "max-w-[70%] rounded-2xl px-4 py-3 shadow-sm transition-all hover:shadow-md",
                            isCurrentUser 
                              ? "bg-rpp-red-main/10 rounded-br-sm" 
                              : "bg-gray-200 dark:bg-gray-700 rounded-bl-sm"
                          )}
                        >
                          <p className={cn(
                            "whitespace-pre-wrap break-words text-[18px]",
                            isCurrentUser 
                              ? "text-gray-900 dark:text-gray-100" 
                              : "text-gray-900 dark:text-gray-100"
                          )}>
                            {message.content}
                          </p>
                          <p
                            className={cn(
                              "text-xs mt-1.5 flex items-center gap-1",
                              isCurrentUser ? "justify-end text-gray-600 dark:text-gray-400" : "justify-start text-gray-600 dark:text-gray-400"
                            )}
                          >
                            {formatTime(message.createdAt)}
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
            <div className="p-4 border-t bg-muted/20">
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
                  disabled={sendMessageMutation.isPending}
                  className="focus-visible:ring-rpp-red-main"
                  data-testid="input-message"
                />
                <Button
                  type="submit"
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  size="icon"
                  className="bg-rpp-red-main hover:bg-rpp-red-dark transition-all hover:scale-105"
                  data-testid="button-send-message"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center p-8">
              <div className="inline-block p-6 rounded-full bg-muted/30 mb-4">
                <MessageSquare className="h-16 w-16 opacity-40" />
              </div>
              <p className="text-lg font-medium mb-2">No conversation selected</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Choose a conversation from the list or start a new one to begin messaging
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}