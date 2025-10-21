import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { signInUser } from '@/lib/firebaseAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await signInUser(email, password);
      
      // Get user data to determine role and redirect accordingly
      const response = await fetch(`/api/auth/user/${user.uid}`);
      if (response.ok) {
        const userData = await response.json();
        if (userData.role === 'editor') {
          setLocation('/editor/dashboard');
        } else {
          setLocation('/dashboard');
        }
      } else {
        // Fallback to partner dashboard if role check fails
        setLocation('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-rpp-red-palest/30 px-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-rpp-red-pale/40 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-blue-100/40 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial opacity-20 blur-3xl -z-10" />

      <Card className="w-full max-w-md glass-strong shadow-modern-xl animate-scale-in relative z-10 border-white/50">
        <CardHeader className="text-center pb-6 relative">
          {/* Decorative element */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-rpp-red-palest/60 to-transparent rounded-full blur-2xl -z-10" />

          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-rpp-red-main to-rpp-red-dark rounded-2xl flex items-center justify-center shadow-colored">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>

          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-rpp-grey-darkest to-rpp-red-dark bg-clip-text text-transparent">
            Welcome Back
          </CardTitle>
          <p className="text-rpp-grey font-medium mt-2">Sign in to your RPP account</p>
        </CardHeader>
        <CardContent className="pb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2 animate-slide-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
              <Label htmlFor="email" className="text-rpp-grey-dark font-semibold">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={loading}
                className="h-11 rounded-xl border-gray-200 focus:border-rpp-red-main focus:ring-rpp-red-main/20"
              />
            </div>

            <div className="space-y-2 animate-slide-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
              <Label htmlFor="password" className="text-rpp-grey-dark font-semibold">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={loading}
                className="h-11 rounded-xl border-gray-200 focus:border-rpp-red-main focus:ring-rpp-red-main/20"
              />
            </div>

            <div className="animate-slide-up" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-rpp-red-main to-rpp-red-dark hover:from-rpp-red-dark hover:to-rpp-red-main text-white font-semibold rounded-xl shadow-colored hover:shadow-glow transition-smooth"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </Button>
            </div>
            
            <div className="text-center mt-4 space-y-2">
              <Button 
                type="button"
                variant="link" 
                onClick={() => setLocation('/signup')}
                className="text-rpp-red-main block w-full"
              >
                Need to create an account? Sign up here
              </Button>
              
              <Button 
                type="button"
                variant="link" 
                onClick={() => setLocation('/editor')}
                className="text-blue-600 hover:text-blue-800 block w-full"
                data-testid="link-editor-dashboard"
              >
                Go to Editor Dashboard →
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}