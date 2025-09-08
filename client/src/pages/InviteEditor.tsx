import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, UserPlus, Send } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function InviteEditor() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    editorEmail: "",
    editorStudioName: ""
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: { editorEmail: string; editorStudioName: string }) => {
      return apiRequest("/api/partnerships/invite", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({
        title: "Invitation Sent!",
        description: "The editor will receive an invitation to partner with you.",
      });
      
      // Clear form
      setFormData({
        editorEmail: "",
        editorStudioName: ""
      });
      
      // Invalidate partnerships cache
      queryClient.invalidateQueries({ queryKey: ['/api/partnerships/suppliers'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Invitation",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.editorEmail.trim() || !formData.editorStudioName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in both email and studio name.",
        variant: "destructive",
      });
      return;
    }

    inviteMutation.mutate(formData);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/dashboard")}
            className="text-rpp-grey-dark hover:text-rpp-grey-darker"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-rpp-grey-dark">Invite Editor</h1>
            <p className="text-rpp-grey-light">Partner with professional photo editors</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center text-rpp-grey-dark">
              <UserPlus className="w-5 h-5 mr-2" />
              Editor Partnership Invitation
            </CardTitle>
            <p className="text-sm text-rpp-grey-light">
              Invite professional photo editors to partner with your business. Once they accept, 
              you can assign them jobs through the "Upload to Editor" process.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="editorEmail">Editor Email Address</Label>
                  <Input
                    id="editorEmail"
                    name="editorEmail"
                    type="email"
                    value={formData.editorEmail}
                    onChange={handleInputChange}
                    placeholder="editor@example.com"
                    required
                    disabled={inviteMutation.isPending}
                    className="mt-2"
                    data-testid="input-editor-email"
                  />
                  <p className="text-xs text-rpp-grey-light mt-1">
                    The editor must already have an account in our system
                  </p>
                </div>

                <div>
                  <Label htmlFor="editorStudioName">Studio/Business Name</Label>
                  <Input
                    id="editorStudioName"
                    name="editorStudioName"
                    value={formData.editorStudioName}
                    onChange={handleInputChange}
                    placeholder="Professional Photo Editing Studio"
                    required
                    disabled={inviteMutation.isPending}
                    className="mt-2"
                    data-testid="input-studio-name"
                  />
                  <p className="text-xs text-rpp-grey-light mt-1">
                    This will be displayed when selecting suppliers for jobs
                  </p>
                </div>
              </div>

              <div className="border-t pt-6">
                <div className="flex justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/dashboard")}
                    disabled={inviteMutation.isPending}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  
                  <Button
                    type="submit"
                    className="bg-rpp-red-main hover:bg-rpp-red-dark text-white"
                    disabled={inviteMutation.isPending}
                    data-testid="button-send-invitation"
                  >
                    {inviteMutation.isPending ? (
                      "Sending..."
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Invitation
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <h3 className="font-medium text-blue-900 mb-2">How Editor Partnerships Work</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Editors receive invitation notifications and can accept or decline</li>
              <li>• Once accepted, they appear in your "Upload to Editor" suppliers list</li>
              <li>• You can assign specific jobs to partnered editors</li>
              <li>• Editors can work with multiple partners simultaneously</li>
              <li>• All partnerships remain separate from your team member management</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}