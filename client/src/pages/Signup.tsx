import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { signUpUser } from '@/lib/firebaseAuth';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<any>(null);
  const [, setLocation] = useLocation();

  // Check for invite token in URL on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('invite');
    if (token) {
      setInviteToken(token);
      fetchInviteInfo(token);
    }
  }, []);

  const fetchInviteInfo = async (token: string) => {
    try {
      // Fetch invite details to pre-fill email and validate
      const response = await fetch(`/api/team/invite-info/${token}`);
      if (response.ok) {
        const inviteData = await response.json();
        setInviteInfo(inviteData);
        setEmail(inviteData.email); // Pre-fill email field
      } else {
        setError('Invalid or expired invite link');
      }
    } catch (error) {
      console.error('Error fetching invite info:', error);
      setError('Failed to load invite information');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      if (inviteToken) {
        // Team member signup via invite
        // 1. Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Complete invite signup via backend
        const response = await fetch('/api/auth/complete-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: user.uid,
            email: user.email,
            token: inviteToken
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to complete invite signup');
        }

        const result = await response.json();
        setSuccess(`Team member account created with role: ${result.role}! Redirecting to dashboard...`);
      } else {
        // Regular partner signup
        await signUpUser(email, password, '');
        setSuccess('Partner account created successfully! Redirecting to dashboard...');
      }
      
      setTimeout(() => {
        setLocation('/dashboard');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-rpp-grey-bg px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-rpp-grey-dark">
            {inviteToken ? 'Join Team' : 'Sign Up for RPP Platform'}
          </CardTitle>
          <p className="text-rpp-grey-light">
            {inviteToken 
              ? 'You\'ve been invited to join a team! Create your account below.' 
              : 'Create your partner account to get started'
            }
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert className="border-green-200 bg-green-50">
                <AlertDescription className="text-green-800">{success}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={inviteToken ? "Email from invite" : "Enter email address"}
                required
                disabled={loading || (inviteToken && inviteInfo)}
              />
              {inviteToken && inviteInfo && (
                <p className="text-sm text-rpp-grey-light">
                  You're invited as: <span className="font-medium">{inviteInfo.role}</span>
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password (min 6 characters)"
                required
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
                disabled={loading}
              />
            </div>
            
            <div className="flex space-x-3">
              <Button 
                type="button"
                variant="outline" 
                className="flex-1"
                onClick={() => setLocation('/login')}
                disabled={loading}
              >
                Back to Login
              </Button>
              <Button 
                type="submit" 
                className="flex-1 bg-rpp-red-main hover:bg-rpp-red-dark text-white"
                disabled={loading}
              >
                {loading 
                  ? 'Creating...' 
                  : inviteToken 
                    ? 'Join Team' 
                    : 'Create Partner Account'
                }
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}