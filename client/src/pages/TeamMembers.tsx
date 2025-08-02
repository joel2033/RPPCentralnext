import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Mail, User, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';

interface TeamMember {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted';
  invitedBy: string;
  createdAt: string;
  inviteToken?: string;
}

export default function TeamMembers() {
  const { userData } = useAuth();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'photographer'>('photographer');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userData?.uid}`
        },
        body: JSON.stringify({ name, email, role })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send invite');
      }

      const result = await response.json();
      setSuccess(`Invite sent to ${email}! They can sign up using this link: ${result.inviteLink}`);
      
      // Reset form
      setName('');
      setEmail('');
      setRole('photographer');
      setInviteDialogOpen(false);
      
      // Refresh team members list
      loadTeamMembers();
    } catch (err: any) {
      setError(err.message || 'Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    if (!userData?.partnerId) return;
    
    try {
      const response = await fetch(`/api/team/invites/${userData.partnerId}`);
      if (response.ok) {
        const invites = await response.json();
        setTeamMembers(invites);
      }
    } catch (error) {
      console.error('Failed to load team members:', error);
    }
  };

  React.useEffect(() => {
    loadTeamMembers();
  }, [userData?.partnerId]);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'photographer': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-rpp-grey-dark">Team Members</h1>
          <p className="text-rpp-grey-light mt-2">Invite and manage your team members</p>
        </div>
        
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-rpp-red-main hover:bg-rpp-red-dark text-white">
              <Plus className="h-4 w-4 mr-2" />
              Invite Team Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter team member's name"
                  required
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  required
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={(value: 'admin' | 'photographer') => setRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="photographer">Photographer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex space-x-3">
                <Button 
                  type="button"
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setInviteDialogOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-rpp-red-main hover:bg-rpp-red-dark text-white"
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send Invite'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        {/* Current User Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Your Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{userData?.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={getRoleColor(userData?.role || '')}>
                    {userData?.role}
                  </Badge>
                  <Badge className="bg-blue-100 text-blue-800">Owner</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Team Members List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members ({teamMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teamMembers.length === 0 ? (
              <div className="text-center py-8 text-rpp-grey-light">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No team members invited yet</p>
                <p className="text-sm">Click "Invite Team Member" to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <Mail className="h-5 w-5 text-gray-500" />
                      </div>
                      <div>
                        <p className="font-medium">{member.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={getRoleColor(member.role)}>
                            {member.role}
                          </Badge>
                          <Badge className={getStatusColor(member.status)}>
                            {member.status}
                          </Badge>
                          {member.status === 'pending' && (
                            <div className="flex items-center text-sm text-gray-500">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {member.status === 'pending' && member.inviteToken && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const inviteLink = `${window.location.origin}/signup?invite=${member.inviteToken}`;
                          navigator.clipboard.writeText(inviteLink);
                          setSuccess('Invite link copied to clipboard!');
                        }}
                      >
                        Copy Link
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}