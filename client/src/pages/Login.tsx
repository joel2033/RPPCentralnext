import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { signInUser } from '@/lib/firebaseAuth';
import { Eye, EyeOff, Camera, Video, Layout, Home } from 'lucide-react';
import rppLogo from '@assets/RPP Logo_2020_1761124400304.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      // Error will be handled by the form
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* LEFT SECTION: LOGIN FORM */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-left-4 duration-700">
          {/* Logo Section */}
          <div className="flex justify-center lg:justify-start">
            <div className="flex items-center space-x-3">
              <img 
                src={rppLogo} 
                alt="RPP Logo" 
                className="h-20 w-auto"
              />
            </div>
          </div>

          {/* Header Section */}
          <div className="space-y-2">
            <h1 className="text-3xl font-medium text-foreground">Welcome back</h1>
            <p className="text-muted-foreground">
              Sign in to your Real Property Photography dashboard
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-xl bg-input border-border/50 focus:border-primary/50 transition-colors"
                data-testid="input-email"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 rounded-xl bg-input border-border/50 focus:border-primary/50 transition-colors pr-10"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <label
                htmlFor="remember"
                className="text-sm text-muted-foreground cursor-pointer select-none"
              >
                Remember me for 30 days
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 rounded-xl"
              data-testid="button-signin"
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          {/* Footer Section */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <button
                type="button"
                className="text-primary hover:text-primary/80 transition-colors"
              >
                Contact sales
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT SECTION: HERO */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#2F373F] via-[#2F373F] to-[#1a1f24] relative overflow-hidden">
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/10 opacity-50"></div>

        {/* Animated Background Elements */}
        <div className="absolute top-20 right-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div 
          className="absolute bottom-20 left-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" 
          style={{ animationDelay: '1s' }}
        ></div>

        {/* Content Container */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <div className="max-w-lg space-y-8 animate-in fade-in slide-in-from-right-4 duration-700">
            
            {/* Hero Heading */}
            <div className="space-y-4">
              <h2 className="text-4xl font-bold leading-tight">
                Professional Real Estate Media Management
              </h2>
              <p className="text-lg text-white/80">
                Streamline your photography business with powerful tools for project management, client delivery, and media organization.
              </p>
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Photography Card */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10 hover:bg-white/10 transition-all duration-200">
                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center mb-3">
                  <Camera className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Photography</h3>
                <p className="text-sm text-white/70">Professional photo management</p>
              </div>

              {/* Video Card */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10 hover:bg-white/10 transition-all duration-200">
                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center mb-3">
                  <Video className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Video</h3>
                <p className="text-sm text-white/70">Cinematic video solutions</p>
              </div>

              {/* Floor Plans Card */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10 hover:bg-white/10 transition-all duration-200">
                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center mb-3">
                  <Layout className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Floor Plans</h3>
                <p className="text-sm text-white/70">2D & 3D floor plans</p>
              </div>

              {/* Virtual Tours Card */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10 hover:bg-white/10 transition-all duration-200">
                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center mb-3">
                  <Home className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Virtual Tours</h3>
                <p className="text-sm text-white/70">360° virtual experiences</p>
              </div>
            </div>

            {/* Statistics Section */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/10">
              <div className="text-center">
                <div className="text-3xl font-bold mb-1">1,200+</div>
                <div className="text-sm text-white/70">Properties Shot</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold mb-1">150+</div>
                <div className="text-sm text-white/70">Active Clients</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold mb-1">98%</div>
                <div className="text-sm text-white/70">Satisfaction</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
