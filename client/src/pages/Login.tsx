import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { signInUser } from '@/lib/firebaseAuth';
import { Eye, EyeOff, Camera, Users, TrendingUp, Shield, Loader2, ArrowRight } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
    <div className="min-h-screen flex">
      {/* Left Panel - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#FF6B35] via-[#FF4500] to-[#CC3700] relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-orange-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          {/* Logo & Brand */}
          <div>
            <div className="flex items-center space-x-3 mb-8">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Camera className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">RPP Central</h1>
                <p className="text-white/80 text-sm">Real Property Photography</p>
              </div>
            </div>

            <div className="space-y-6 mt-16">
              <h2 className="text-4xl font-bold leading-tight">
                Welcome back to your<br />
                photography platform
              </h2>
              <p className="text-xl text-white/90">
                Manage your projects, clients, and team all in one place
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-6 mt-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold mb-2">Team Management</h3>
              <p className="text-sm text-white/80">Collaborate with photographers and editors seamlessly</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold mb-2">Analytics</h3>
              <p className="text-sm text-white/80">Track revenue, projects, and performance metrics</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-rpp-grey-bg to-white p-6">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#FF6B35] to-[#FF4500] rounded-xl mb-4">
              <Camera className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-rpp-grey-dark">RPP Central</h1>
            <p className="text-rpp-grey-light">Real Property Photography</p>
          </div>

          <Card className="border-0 shadow-2xl">
            <CardHeader className="space-y-2 pb-8">
              <CardTitle className="text-3xl font-bold text-rpp-grey-dark">
                Partner Login
              </CardTitle>
              <p className="text-rpp-grey-light text-base">
                Sign in to access your dashboard
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-1">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-rpp-grey-dark">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    disabled={loading}
                    className="h-12 text-base border-rpp-grey-light focus:border-rpp-red-main focus:ring-rpp-red-main"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium text-rpp-grey-dark">
                      Password
                    </Label>
                    <button
                      type="button"
                      className="text-sm text-rpp-red-main hover:text-rpp-red-dark transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      disabled={loading}
                      className="h-12 text-base pr-12 border-rpp-grey-light focus:border-rpp-red-main focus:ring-rpp-red-main"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-rpp-grey-light hover:text-rpp-grey-dark transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-rpp-grey-light text-rpp-red-main focus:ring-rpp-red-main"
                  />
                  <Label htmlFor="remember" className="text-sm text-rpp-grey-light cursor-pointer">
                    Remember me for 30 days
                  </Label>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 border-2 border-rpp-red-main text-white hover:brightness-110 text-base font-semibold transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl bg-[#ff6832]"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>

                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-rpp-grey-light"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-rpp-grey-light">New to RPP Central?</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation('/signup')}
                    className="w-full h-12 border-2 border-rpp-red-main text-rpp-red-main hover:bg-rpp-red-pale transition-all"
                  >
                    Create Partner Account
                  </Button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setLocation('/editor-login')}
                      className="text-sm text-rpp-grey-light hover:text-rpp-grey-dark transition-colors inline-flex items-center group"
                    >
                      Editor? Sign in here
                      <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Security Badge */}
          <div className="mt-8 text-center">
            <div className="inline-flex items-center space-x-2 text-sm text-rpp-grey-light">
              <Shield className="w-4 h-4" />
              <span>Secured by industry-standard encryption</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
