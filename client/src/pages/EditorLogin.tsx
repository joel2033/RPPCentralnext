import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { signInUser } from "@/lib/firebaseAuth";
import { Camera, Edit, Eye, EyeOff } from "lucide-react";

export default function EditorLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

      // Check if editor account is approved
      if (userData.status === 'pending') {
        toast({
          title: "Account Under Review",
          description: "Your editor account is being reviewed. You'll receive an email when approved.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Editor Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-4">
            <Edit className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">RPP Editor Portal</h1>
          <p className="text-gray-600">Professional Photo Editing Services</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-semibold text-center text-gray-900">
              Editor Sign In
            </CardTitle>
            <p className="text-center text-gray-600">
              Access your editing dashboard and manage your projects
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="editor@example.com"
                  required
                  disabled={isLoading}
                  className="h-11"
                  data-testid="input-email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
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
                    className="h-11 pr-10"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                disabled={isLoading}
                data-testid="button-sign-in"
              >
                {isLoading ? "Signing in..." : "Sign In to Editor Dashboard"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-blue-600 hover:text-blue-700 underline"
                data-testid="button-forgot-password"
              >
                Forgot your password?
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="text-center text-sm text-gray-600">
                <p>Need an editor account?</p>
                <button
                  type="button"
                  onClick={() => setLocation("/editor-signup")}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                  data-testid="button-create-account"
                >
                  Create Editor Account
                </button>
              </div>
            </div>

            {/* Partner Login Link */}
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                Looking for the photographer dashboard?{" "}
                <button
                  type="button"
                  onClick={() => setLocation("/login")}
                  className="text-blue-600 hover:text-blue-700 underline"
                  data-testid="button-partner-login"
                >
                  Partner Login
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="mt-8 text-center">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Editor Features</h3>
          <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                <Camera className="w-4 h-4 text-blue-600" />
              </div>
              <span>Job Management</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                <Edit className="w-4 h-4 text-blue-600" />
              </div>
              <span>File Processing</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                <Camera className="w-4 h-4 text-blue-600" />
              </div>
              <span>Delivery System</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}