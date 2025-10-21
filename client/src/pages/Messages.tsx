import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, MessageSquare, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

export default function Messages() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [newConversationDialogOpen, setNewConversationDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUser = auth.currentUser;
  const { userData: partnerData } = useAuth();
  const { userData: editorData } = useEditorAuth();

  // Fetch all conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    refetchInterval: 5000, // Poll every 5 seconds for new messages
  });

  // Fetch selected conversation with messages
  const { data: conversationData, isLoading: messagesLoading } = useQuery<ConversationWithMessages>({
    queryKey: [`/api/conversations/${selectedConversationId}`],
    enabled: !!selectedConversationId,
    refetchInterval: 3000, // Poll every 3 seconds for new messages in active conversation
  });

  // Determine if current user is an editor or partner
  const isEditor = editorData?.role === "editor";
  const isPartner = partnerData?.role === "partner";

  // Fetch partnerships for editors (so they can start conversations with partners)
  const { data: editorPartnerships = [] } = useQuery<Partnership[]>({
    queryKey: ["/api/editor/partnerships"],
    enabled: isEditor,
  });

  // Fetch partnerships for partners (so they can start conversations with editors)
  const { data: partnerPartnerships = [] } = useQuery<Partnership[]>({
    queryKey: ["/api/partnerships"],
    enabled: isPartner,
  });

  // Use the appropriate partnerships list based on user role
  const partnerships = isEditor ? editorPartnerships : partnerPartnerships;

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
    onSuccess: () => {
      setMessageInput("");
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${selectedConversationId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
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
    mutationFn: async (partnership: Partnership) => {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          editorId: partnership.editorId,
          editorEmail: partnership.editorEmail,
          editorName: partnership.editorStudioName,
        }),
      });
      if (!response.ok) throw new Error("Failed to create conversation");
      return response.json();
    },
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setNewConversationDialogOpen(false);
      setSelectedConversationId(conversation.id);
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationData?.messages]);

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
    // Determine if current user is partner or editor in this conversation
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
    <div className="flex h-[calc(100vh-12rem)] rounded-lg overflow-hidden shadow-lg bg-background">
      {/* Conversations List */}
      <div className="w-80 border-r flex flex-col bg-gradient-to-b from-background to-muted/20">
        <div className="p-4 border-b flex items-center justify-between bg-background/50 backdrop-blur-sm">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-rpp-red-main" />
            Messages
          </h2>
          {(isEditor || isPartner) && partnerships.some(p => p.isActive) && (
            <Dialog open={newConversationDialogOpen} onOpenChange={setNewConversationDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" data-testid="button-new-conversation">
                  <Plus className="h-4 w-4 mr-1" />
                  New
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Start New Conversation</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {isEditor ? "Select a partner to start messaging:" : "Select an editor to start messaging:"}
                  </p>
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {partnerships.filter(p => p.isActive).map((partnership) => {
                        // Check if conversation already exists
                        const existingConversation = conversations.find(
                          c => c.partnerId === partnership.partnerId && c.editorId === partnership.editorId
                        );
                        
                        // Show editor info for partners, partner info for editors
                        const displayName = isEditor ? partnership.partnerName : partnership.editorStudioName;
                        const displayEmail = isEditor ? partnership.partnerEmail : partnership.editorEmail;
                        const testId = isEditor ? partnership.partnerId : partnership.editorId;
                        
                        return (
                          <button
                            key={partnership.id}
                            onClick={() => {
                              if (existingConversation) {
                                setSelectedConversationId(existingConversation.id);
                                setNewConversationDialogOpen(false);
                              } else {
                                createConversationMutation.mutate(partnership);
                              }
                            }}
                            disabled={createConversationMutation.isPending}
                            className="w-full p-3 text-left rounded-lg border hover:bg-accent transition-colors disabled:opacity-50"
                            data-testid={`button-start-conversation-${testId}`}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{displayName}</p>
                                <p className="text-sm text-muted-foreground">{displayEmail}</p>
                                {existingConversation && (
                                  <p className="text-xs text-primary mt-1">Already chatting</p>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  {partnerships.filter(p => p.isActive).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {isEditor 
                        ? "No active partnerships. Accept partnership invites to start messaging."
                        : "No active partnerships. Invite editors to start messaging."}
                    </p>
                  )}
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
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversationId ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b bg-gradient-to-r from-background to-muted/10 shadow-sm">
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
            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3">
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
                            "max-w-[70%] rounded-2xl px-4 py-3 shadow-sm transition-all hover:shadow-md",
                            isCurrentUser
                              ? "bg-rpp-red-main text-white rounded-br-sm"
                              : "bg-muted rounded-bl-sm"
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                            {message.content}
                          </p>
                          <p
                            className={cn(
                              "text-xs mt-1.5 flex items-center gap-1",
                              isCurrentUser ? "text-white/70 justify-end" : "text-muted-foreground"
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
            <div className="p-4 border-t bg-gradient-to-r from-background to-muted/5">
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
          <div className="flex-1 flex items-center justify-center text-muted-foreground bg-gradient-to-br from-background to-muted/10">
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
      </div>
    </div>
  );
}
