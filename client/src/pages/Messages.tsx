import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Search, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEditorAuth } from "@/contexts/EditorAuthContext";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Conversation, Message } from "@shared/schema";

export default function Messages() {
  // Try to get auth from both contexts
  const partnerAuth = useAuth();
  const editorAuth = useEditorAuth();

  // Use whichever context has data
  const userData = partnerAuth?.userData || editorAuth?.userData;
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch conversations
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  // Fetch messages for selected conversation
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: [`/api/conversations/${selectedConversation}/messages`],
    enabled: !!selectedConversation,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedConversation) throw new Error("No conversation selected");
      const res = await apiRequest(
        `/api/conversations/${selectedConversation}/messages`,
        "POST",
        { content }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${selectedConversation}/messages`] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setNewMessage("");
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage);
  };

  // Filter conversations based on search
  const filteredConversations = conversations.filter((conv) => {
    const otherParticipant = conv.participant1Id === userData?.uid
      ? conv.participant2Name
      : conv.participant1Name;
    return otherParticipant.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Get the other participant in a conversation
  const getOtherParticipant = (conv: Conversation) => {
    if (conv.participant1Id === userData?.uid) {
      return {
        name: conv.participant2Name,
        role: conv.participant2Role,
        id: conv.participant2Id,
      };
    }
    return {
      name: conv.participant1Name,
      role: conv.participant1Role,
      id: conv.participant1Id,
    };
  };

  // Get selected conversation details
  const selectedConv = conversations.find((c) => c.id === selectedConversation);
  const otherParticipant = selectedConv ? getOtherParticipant(selectedConv) : null;

  // Format time for messages
  const formatTime = (date: Date | null) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Format date for conversation list
  const formatDate = (date: Date | null) => {
    if (!date) return "";
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return formatTime(date);
    } else if (d.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl text-rpp-grey-dark tracking-tight font-medium">Messages</h1>
          <p className="text-rpp-grey-medium font-medium text-[18px]">
            Communicate with your team members and editors
          </p>
        </div>

        <Card className="bg-white border-0 rounded-3xl shadow-rpp-card overflow-hidden">
          <div className="flex h-[calc(100vh-250px)]">
            {/* Conversations List */}
            <div className="w-80 border-r border-gray-200 flex flex-col">
              {/* Search */}
              <div className="p-4 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Conversations */}
              <ScrollArea className="flex-1">
                {filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6">
                    <MessageSquare className="h-12 w-12 text-gray-300 mb-3" />
                    <p className="text-sm text-gray-500">No conversations yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Start a conversation from your team page
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredConversations.map((conv) => {
                      const participant = getOtherParticipant(conv);
                      const isSelected = selectedConversation === conv.id;
                      return (
                        <button
                          key={conv.id}
                          onClick={() => setSelectedConversation(conv.id)}
                          className={cn(
                            "w-full p-4 text-left hover:bg-gray-50 transition-colors",
                            isSelected && "bg-blue-50 hover:bg-blue-50 border-l-4 border-blue-500"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rpp-red-lighter to-rpp-red-light flex items-center justify-center flex-shrink-0">
                              <User className="h-5 w-5 text-rpp-red-main" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="font-semibold text-sm text-rpp-grey-dark truncate">
                                  {participant.name}
                                </h3>
                                <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                                  {formatDate(conv.lastMessageAt)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 capitalize mb-1">
                                {participant.role}
                              </p>
                              {conv.lastMessageContent && (
                                <p className="text-sm text-gray-600 truncate">
                                  {conv.lastMessageContent}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Messages View */}
            <div className="flex-1 flex flex-col">
              {!selectedConversation ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="h-16 w-16 text-gray-300 mb-4 mx-auto" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      Select a conversation
                    </h3>
                    <p className="text-sm text-gray-500">
                      Choose a conversation from the list to view messages
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Conversation Header */}
                  {otherParticipant && (
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rpp-red-lighter to-rpp-red-light flex items-center justify-center">
                          <User className="h-5 w-5 text-rpp-red-main" />
                        </div>
                        <div>
                          <h2 className="font-semibold text-rpp-grey-dark">
                            {otherParticipant.name}
                          </h2>
                          <p className="text-sm text-gray-500 capitalize">
                            {otherParticipant.role}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Messages */}
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages.length === 0 ? (
                        <div className="text-center text-gray-500 text-sm py-8">
                          No messages yet. Start the conversation!
                        </div>
                      ) : (
                        messages.map((msg) => {
                          const isOwnMessage = msg.senderId === userData?.uid;
                          return (
                            <div
                              key={msg.id}
                              className={cn(
                                "flex",
                                isOwnMessage ? "justify-end" : "justify-start"
                              )}
                            >
                              <div
                                className={cn(
                                  "max-w-[70%] rounded-2xl px-4 py-2",
                                  isOwnMessage
                                    ? "bg-rpp-red-main text-white"
                                    : "bg-gray-100 text-rpp-grey-dark"
                                )}
                              >
                                {!isOwnMessage && (
                                  <p className="text-xs font-semibold mb-1 opacity-75">
                                    {msg.senderName}
                                  </p>
                                )}
                                <p className="text-sm whitespace-pre-wrap break-words">
                                  {msg.content}
                                </p>
                                <p
                                  className={cn(
                                    "text-xs mt-1",
                                    isOwnMessage ? "text-white/70" : "text-gray-500"
                                  )}
                                >
                                  {formatTime(msg.createdAt)}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>

                  {/* Message Input */}
                  <div className="p-4 border-t border-gray-200">
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <Input
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="submit"
                        disabled={!newMessage.trim() || sendMessageMutation.isPending}
                        className="bg-rpp-red-main hover:bg-rpp-red-dark"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
