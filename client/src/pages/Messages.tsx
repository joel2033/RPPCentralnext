import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, MessageSquare, Loader2, Plus, Info } from "lucide-react";
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
  lastMessageAt: string;
  lastMessageText: string | null;
  partnerUnreadCount: number;
  editorUnreadCount: number;
  createdAt: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  senderRole: "partner" | "editor";
  content: string;
  readAt: string | null;
  createdAt: string;
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

  // Fetch all conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    refetchInterval: 3000, // Sync with message polling
    refetchIntervalInBackground: true,
  });

  // Fetch selected conversation with messages
  const { data: conversationData, isLoading: messagesLoading } = useQuery<ConversationWithMessages>({
    queryKey: [`/api/conversations/${selectedConversationId}`],
    enabled: !!selectedConversationId,
    refetchInterval: 2000, // Poll every 2 seconds for faster updates
    refetchIntervalInBackground: true, // Continue polling even when tab is inactive
  });

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
  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: isPartner,
  });

  // Fetch team members (for partners only)
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: [`/api/team/invites/${partnerData?.partnerId}`],
    enabled: isPartner && !!partnerData?.partnerId,
  });

  // Use the appropriate partnerships list based on user role
  const partnerships = isEditor ? editorPartnerships : partnerPartnerships;

  // Combine editors and team members into contacts list
  const contacts: Contact[] = [
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/unread-count"] });
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
      
      // Find the contact (editor or team member)
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) throw new Error("Contact not found");

      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          editorId: contact.id,
          editorEmail: contact.email,
          editorName: contact.name,
          orderId: orderId || undefined,
        }),
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
    if (conversationData?.messages && conversationData.messages.length > 0) {
      // Small delay to ensure DOM has updated
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [conversationData?.messages, conversationData?.messages?.length]);

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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
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
    const isPartner = conversation.partnerEmail === currentUser?.email;
    return {
      name: isPartner ? conversation.editorName : conversation.partnerName,
      email: isPartner ? conversation.editorEmail : conversation.partnerEmail,
      unreadCount: isPartner ? conversation.partnerUnreadCount : conversation.editorUnreadCount,
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
          {isPartner && (
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
                  Select an order and editor to begin messaging
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
                      <Label htmlFor="contact-select">Select Contact</Label>
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
                        <SelectValue placeholder="Choose a contact..." />
                      </SelectTrigger>
                      <SelectContent>
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
                      "border border-transparent",
                      isSelected 
                        ? "bg-rpp-red-main/10 border-rpp-red-main shadow-md" 
                        : "hover:bg-accent hover:border-muted-foreground/20"
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
                          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold animate-pulse">
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
              {conversationData && (
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 ring-2 ring-rpp-red-main/20">
                    <AvatarFallback className="bg-rpp-red-main/10 text-rpp-red-main font-semibold text-base">
                      {getInitials(getOtherParticipant(conversationData.conversation).name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-base">
                      {getOtherParticipant(conversationData.conversation).name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {getOtherParticipant(conversationData.conversation).email}
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
                  {conversationData?.messages.map((message, index) => {
                    const isCurrentUser = message.senderEmail === currentUser?.email;
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
                            "max-w-[70%] rounded-2xl px-4 py-3 shadow-sm transition-all hover:shadow-md rounded-br-sm",
                            isCurrentUser 
                              ? "bg-[#fcdcd4] text-[#a3a4a5]" 
                              : "bg-gray-200 dark:bg-gray-700"
                          )}
                        >
                          <p className={cn(
                            "whitespace-pre-wrap break-words text-[18px]",
                            isCurrentUser 
                              ? "text-[#313941]" 
                              : "text-gray-900 dark:text-gray-100"
                          )}>
                            {message.content}
                          </p>
                          <p
                            className="text-xs mt-1.5 flex items-center gap-1 justify-end text-[#090a0b]"
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
