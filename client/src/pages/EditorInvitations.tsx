import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mail, Check, X, Clock, Users, Building2 } from "lucide-react";
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
  const { data: pendingInvites = [], isLoading } = useQuery<PartnershipInvite[]>({
    queryKey: ['/api/partnerships/pending'],
    retry: false
  });

  // Accept invitation mutation
  const acceptMutation = useMutation({
    mutationFn: async (token: string) => {
      return apiRequest(`/api/partnerships/accept/${token}`, "POST");
    },
    onSuccess: () => {
      toast({
        title: "Partnership Accepted!",
        description: "You can now receive jobs from this partner.",
      });
      
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
      return apiRequest(`/api/partnerships/decline/${token}`, "POST");
    },
    onSuccess: () => {
      toast({
        title: "Partnership Declined",
        description: "The invitation has been declined.",
      });
      
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
      <div className="p-6 bg-rpp-grey-pale min-h-screen">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-rpp-grey-lighter rounded-xl w-1/3"></div>
          <div className="h-48 bg-rpp-grey-lighter rounded-2xl"></div>
          <div className="h-48 bg-rpp-grey-lighter rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-rpp-grey-pale min-h-screen space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-rpp-grey-darkest flex items-center gap-2">
          <Mail className="w-6 h-6 text-rpp-orange" />
          Partnership Invitations
        </h1>
        <p className="text-rpp-grey">Manage partnership requests from photography businesses</p>
      </div>

      {/* Stats Card */}
      <Card className="card-hover border border-rpp-grey-lighter rounded-2xl">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-rpp-grey">Pending Invitations</p>
              <p className="text-3xl font-bold text-rpp-grey-darkest">{pendingInvites.length}</p>
            </div>
            <div className="w-12 h-12 bg-rpp-orange-subtle rounded-full flex items-center justify-center">
              <Mail className="w-6 h-6 text-rpp-orange" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invitations List */}
      <div className="space-y-4">
        {pendingInvites.length === 0 ? (
          <Card className="border border-rpp-grey-lighter rounded-2xl">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 bg-rpp-grey-lightest rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-rpp-grey-light" />
              </div>
              <h3 className="text-lg font-semibold text-rpp-grey-darkest mb-2">No Pending Invitations</h3>
              <p className="text-rpp-grey">
                You don't have any partnership invitations at the moment.
              </p>
            </CardContent>
          </Card>
        ) : (
          pendingInvites.map((invite: PartnershipInvite) => (
            <Card key={invite.inviteToken} className="card-hover border border-rpp-grey-lighter rounded-2xl overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-rpp-orange rounded-xl flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-rpp-grey-darkest text-lg">
                        Partnership Invitation
                      </h3>
                      <p className="text-sm text-rpp-grey">
                        From: {invite.partnerEmail}
                      </p>
                    </div>
                  </div>
                  <Badge className="badge-pill bg-semantic-yellow-light text-semantic-yellow-dark border-none">
                    <Clock className="w-3 h-3 mr-1" />
                    Pending
                  </Badge>
                </div>

                <div className="bg-rpp-grey-lightest rounded-xl p-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-rpp-grey">Partner:</span>
                      <p className="text-rpp-grey-darkest">{invite.partnerEmail}</p>
                    </div>
                    <div>
                      <span className="font-medium text-rpp-grey">Your Studio:</span>
                      <p className="text-rpp-grey-darkest">{invite.editorStudioName || 'Not specified'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-rpp-grey">Received:</span>
                      <p className="text-rpp-grey-darkest">{formatDate(invite.createdAt)}</p>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-rpp-grey mb-6">
                  This partner wants to work with you on photo editing projects. 
                  If you accept, they'll be able to assign jobs to you through their system.
                </p>

                <div className="flex justify-end gap-3 pt-4 border-t border-rpp-grey-lighter">
                  <Button
                    variant="outline"
                    onClick={() => handleDecline(invite.inviteToken)}
                    disabled={declineMutation.isPending}
                    className="rounded-xl border-semantic-red/30 text-semantic-red hover:bg-semantic-red-light"
                    data-testid={`button-decline-${invite.inviteToken}`}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Decline
                  </Button>
                  
                  <Button
                    onClick={() => handleAccept(invite.inviteToken)}
                    disabled={acceptMutation.isPending}
                    className="btn-primary-gradient rounded-xl"
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
