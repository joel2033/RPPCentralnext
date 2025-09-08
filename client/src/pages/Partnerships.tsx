import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Users, UserPlus, Mail, Calendar } from "lucide-react";

interface Partnership {
  editorId: string;
  editorEmail: string;
  editorStudioName: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  acceptedAt: any;
  isActive: boolean;
}

export default function Partnerships() {
  const [, setLocation] = useLocation();

  // Fetch active partnerships
  const { data: partnerships = [], isLoading } = useQuery<Partnership[]>({
    queryKey: ['/api/partnerships/suppliers'],
    retry: false
  });

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-rpp-grey-dark flex items-center">
            <Users className="w-6 h-6 mr-2" />
            Editor Partnerships
          </h1>
          <p className="text-rpp-grey-light">Manage your partnerships with photo editors</p>
        </div>
        <Button
          onClick={() => setLocation("/invite-editor")}
          className="bg-rpp-red-main hover:bg-rpp-red-dark text-white"
          data-testid="button-invite-editor"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Invite Editor
        </Button>
      </div>

      {/* Partnerships List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {partnerships.length === 0 ? (
          <div className="col-span-full">
            <Card className="text-center py-12">
              <CardContent>
                <Users className="w-16 h-16 text-rpp-grey-light mx-auto mb-4" />
                <h3 className="text-xl font-medium text-rpp-grey-dark mb-2">No Active Partnerships</h3>
                <p className="text-rpp-grey-light mb-6">
                  Start building your network of professional photo editors by sending partnership invitations.
                </p>
                <Button
                  onClick={() => setLocation("/invite-editor")}
                  className="bg-rpp-red-main hover:bg-rpp-red-dark text-white"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite Your First Editor
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          partnerships.map((partnership) => (
            <Card key={partnership.editorId} className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium text-sm">
                        {partnership.editorStudioName?.charAt(0)?.toUpperCase() || "E"}
                      </span>
                    </div>
                    <div>
                      <CardTitle className="text-lg text-rpp-grey-dark">
                        {partnership.editorStudioName}
                      </CardTitle>
                      <p className="text-sm text-rpp-grey-light flex items-center">
                        <Mail className="w-3 h-3 mr-1" />
                        {partnership.editorEmail}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-rpp-grey-light">
                    <Calendar className="w-4 h-4 mr-2" />
                    Partnership since {formatDate(partnership.acceptedAt)}
                  </div>
                  
                  <div className="pt-3 border-t">
                    <p className="text-xs text-rpp-grey-light mb-2">
                      This editor appears in your suppliers list and can receive job assignments.
                    </p>
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setLocation("/upload")}
                        className="flex-1 text-xs"
                      >
                        Assign Job
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Info Card */}
      {partnerships.length > 0 && (
        <Card className="mt-8 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <h3 className="font-medium text-blue-900 mb-2">Partnership Benefits</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Partnered editors appear automatically in your Upload to Editor supplier list</li>
              <li>• Assign specific jobs and projects directly to trusted editors</li>
              <li>• Streamlined workflow for regular editing collaborations</li>
              <li>• Maintain separate partnerships with multiple editing studios</li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}