import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mail, Check, X, Clock, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface PartnershipInvite {
  editorEmail: string;
  editorStudioName: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  status: "pending" | "accepted" | "declined" | "expired";
  createdAt: any;
  inviteToken: string;
}

export default function EditorInvitations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch pending invitations
  const { data: pendingInvites = [], isLoading } = useQuery({
    queryKey: ['/api/partnerships/pending'],
    retry: false
  });

  // Accept invitation mutation
  const acceptMutation = useMutation({
    mutationFn: async (token: string) => {
      return apiRequest(`/api/partnerships/accept/${token}`, {
        method: "POST"
      });
    },
    onSuccess: () => {
      toast({
        title: "Partnership Accepted!",
        description: "You can now receive jobs from this partner.",
      });
      
      // Refresh the invitations list
      queryClient.invalidateQueries({ queryKey: ['/api/partnerships/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/partnerships/editor'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Accept Partnership",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    }
  });

  // Decline invitation mutation  
  const declineMutation = useMutation({
    mutationFn: async (token: string) => {
      return apiRequest(`/api/partnerships/decline/${token}`, {
        method: "POST"
      });
    },
    onSuccess: () => {
      toast({
        title: "Partnership Declined",
        description: "The invitation has been declined.",
      });
      
      // Refresh the invitations list
      queryClient.invalidateQueries({ queryKey: ['/api/partnerships/pending'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Decline Partnership",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    }
  });

  const handleAccept = (token: string) => {
    acceptMutation.mutate(token);
  };

  const handleDecline = (token: string) => {
    declineMutation.mutate(token);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Unknown";
    const date = timestamp._seconds ? new Date(timestamp._seconds * 1000) : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-rpp-grey-dark flex items-center">
          <Mail className="w-6 h-6 mr-2" />
          Partnership Invitations
        </h1>
        <p className="text-rpp-grey-light">Manage partnership requests from photography businesses</p>
      </div>

      {/* Invitations List */}
      <div className="space-y-4">
        {pendingInvites.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Users className="w-12 h-12 text-rpp-grey-light mx-auto mb-4" />
              <h3 className="text-lg font-medium text-rpp-grey-dark mb-2">No Pending Invitations</h3>
              <p className="text-rpp-grey-light">
                You don't have any partnership invitations at the moment.
              </p>
            </CardContent>
          </Card>
        ) : (
          pendingInvites.map((invite: PartnershipInvite) => (
            <Card key={invite.inviteToken} className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-rpp-red-main rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          {invite.partnerName?.charAt(0)?.toUpperCase() || invite.partnerEmail?.charAt(0)?.toUpperCase() || "P"}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-rpp-grey-dark">
                          Partnership Invitation
                        </h3>
                        <p className="text-sm text-rpp-grey-light">
                          From: {invite.partnerEmail}
                        </p>
                      </div>
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </Badge>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-rpp-grey-dark">Partner:</span>
                          <p className="text-rpp-grey-light">{invite.partnerEmail}</p>
                        </div>
                        <div>
                          <span className="font-medium text-rpp-grey-dark">Your Studio:</span>
                          <p className="text-rpp-grey-light">{invite.editorStudioName}</p>
                        </div>
                        <div>
                          <span className="font-medium text-rpp-grey-dark">Received:</span>
                          <p className="text-rpp-grey-light">{formatDate(invite.createdAt)}</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-rpp-grey-light mb-4">
                      This partner wants to work with you on photo editing projects. 
                      If you accept, they'll be able to assign jobs to you through their system.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => handleDecline(invite.inviteToken)}
                    disabled={declineMutation.isPending}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    data-testid={`button-decline-${invite.inviteToken}`}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Decline
                  </Button>
                  
                  <Button
                    onClick={() => handleAccept(invite.inviteToken)}
                    disabled={acceptMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    data-testid={`button-accept-${invite.inviteToken}`}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Accept Partnership
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}