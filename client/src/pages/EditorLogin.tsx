import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { signInUser } from "@/lib/firebaseAuth";
import { Camera, Edit, Eye, EyeOff, Loader2, ArrowRight, Shield, Download, Upload, Briefcase } from "lucide-react";

export default function EditorLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const userData = await signInUser(formData.email, formData.password);

      // Check if user is actually an editor
      if (userData.role !== 'editor') {
        toast({
          title: "Access Denied",
          description: "This login is for editors only. Please use the main login for other accounts.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Check if editor account is approved (temporarily disabled for testing)
      // if (userData.status === 'pending') {
      //   toast({
      //     title: "Account Under Review",
      //     description: "Your editor account is being reviewed. You'll receive an email when approved.",
      //     variant: "destructive",
      //   });
      //   setIsLoading(false);
      //   return;
      // }

      toast({
        title: "Welcome back!",
        description: "Successfully signed in to your editor dashboard.",
      });

      // Redirect to editor dashboard
      setLocation("/editor");
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: error.message || "Please check your credentials and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    toast({
      title: "Password Reset",
      description: "Password reset functionality will be available soon. Please contact support for assistance.",
    });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          {/* Logo & Brand */}
          <div>
            <div className="flex items-center space-x-3 mb-8">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Edit className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">RPP Editor Portal</h1>
                <p className="text-white/80 text-sm">Professional Photo Editing</p>
              </div>
            </div>

            <div className="space-y-6 mt-16">
              <h2 className="text-4xl font-bold leading-tight">
                Transform properties<br />
                with professional editing
              </h2>
              <p className="text-xl text-white/90">
                Access your jobs, deliver stunning results, and grow your editing career
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-6 mt-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold mb-2">Job Management</h3>
              <p className="text-sm text-white/80">Accept, track, and manage all your editing projects</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                <Download className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold mb-2">Quick Downloads</h3>
              <p className="text-sm text-white/80">Access original files instantly and securely</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-4">
              <Edit className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">RPP Editor Portal</h1>
            <p className="text-gray-600">Professional Photo Editing</p>
          </div>

          <Card className="border-0 shadow-2xl">
            <CardHeader className="space-y-2 pb-8">
              <CardTitle className="text-3xl font-bold text-gray-900">
                Editor Sign In
              </CardTitle>
              <p className="text-gray-600 text-base">
                Access your editing dashboard
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-900">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="editor@example.com"
                    required
                    disabled={isLoading}
                    className="h-12 text-base border-gray-300 focus:border-blue-600 focus:ring-blue-600"
                    data-testid="input-email"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium text-gray-900">
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Enter your password"
                      required
                      disabled={isLoading}
                      className="h-12 text-base pr-12 border-gray-300 focus:border-blue-600 focus:ring-blue-600"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      data-testid="button-toggle-password"
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
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                  />
                  <Label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer">
                    Remember me for 30 days
                  </Label>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
                  disabled={isLoading}
                  data-testid="button-sign-in"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In to Dashboard
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>

                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-600">New to RPP?</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/editor-signup")}
                    className="w-full h-12 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 transition-all"
                    data-testid="button-create-account"
                  >
                    Create Editor Account
                  </Button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setLocation("/login")}
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors inline-flex items-center group"
                      data-testid="button-partner-login"
                    >
                      Photographer or Partner? Sign in here
                      <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Features Grid */}
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 text-center">Why Editors Choose RPP</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-2 mx-auto">
                  <Briefcase className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-xs text-gray-600 font-medium">Steady Work</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-2 mx-auto">
                  <Upload className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-xs text-gray-600 font-medium">Easy Upload</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-2 mx-auto">
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-xs text-gray-600 font-medium">Secure Pay</p>
              </div>
            </div>
          </div>

          {/* Security Badge */}
          <div className="mt-8 text-center">
            <div className="inline-flex items-center space-x-2 text-sm text-gray-600">
              <Shield className="w-4 h-4" />
              <span>Secured by industry-standard encryption</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
