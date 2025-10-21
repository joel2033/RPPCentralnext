import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

// Layout
import Layout from "@/components/Layout";

// Pages
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import Jobs from "@/pages/Jobs";
import JobCard from "@/pages/JobCard";
import Customers from "@/pages/Customers";
import CustomerProfile from "@/pages/CustomerProfile";
import Products from "@/pages/Products";
import Orders from "@/pages/Orders";
import Calendar from "@/pages/Calendar";
import Upload from "@/pages/Upload";
import InviteEditor from "@/pages/InviteEditor";
import Partnerships from "@/pages/Partnerships";
import TeamMembers from "@/pages/TeamMembers";
import TeamAssignments from "@/pages/TeamAssignments";
import Settings from "@/pages/Settings";
import Messages from "@/pages/Messages";
import NotFound from "@/pages/not-found";

// Public Pages (No Auth Required)
import DeliveryPage from "@/pages/DeliveryPage";

// Editor Components
import EditorLogin from "@/pages/EditorLogin";
import EditorSignup from "@/pages/EditorSignup";
import EditorDashboard from "@/pages/EditorDashboard";
import EditorJobs from "@/pages/EditorJobs";
import EditorDownloads from "@/pages/EditorDownloads";
import EditorUploads from "@/pages/EditorUploads";
import EditorSettings from "@/pages/EditorSettings";
import EditorInvitations from "@/pages/EditorInvitations";
import EditorProtectedRoute from "@/components/EditorProtectedRoute";
import EditorLayout from "@/components/EditorLayout";
import { EditorAuthProvider } from "@/contexts/EditorAuthContext";

function Router() {
  return (
    <Switch>
      {/* Public Routes - No Authentication Required */}
      <Route path="/delivery/:token" component={DeliveryPage} />
      
      {/* Partner Authentication */}
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      
      {/* Editor App - Completely Separate */}
      <Route path="/editor-login" component={EditorLogin} />
      <Route path="/editor-signup" component={EditorSignup} />
      <Route path="/editor">
        <EditorProtectedRoute>
          <EditorLayout>
            <EditorDashboard />
          </EditorLayout>
        </EditorProtectedRoute>
      </Route>
      <Route path="/editor/dashboard">
        <EditorProtectedRoute>
          <EditorLayout>
            <EditorDashboard />
          </EditorLayout>
        </EditorProtectedRoute>
      </Route>
      <Route path="/editor/jobs">
        <EditorProtectedRoute>
          <EditorLayout>
            <EditorJobs />
          </EditorLayout>
        </EditorProtectedRoute>
      </Route>
      <Route path="/editor/jobs/:jobId">
        <EditorProtectedRoute>
          <EditorLayout>
            <JobCard />
          </EditorLayout>
        </EditorProtectedRoute>
      </Route>
      <Route path="/editor/downloads">
        <EditorProtectedRoute>
          <EditorLayout>
            <EditorDownloads />
          </EditorLayout>
        </EditorProtectedRoute>
      </Route>
      <Route path="/editor/uploads">
        <EditorProtectedRoute>
          <EditorLayout>
            <EditorUploads />
          </EditorLayout>
        </EditorProtectedRoute>
      </Route>
      <Route path="/editor/invitations">
        <EditorProtectedRoute>
          <EditorLayout>
            <EditorInvitations />
          </EditorLayout>
        </EditorProtectedRoute>
      </Route>
      <Route path="/editor/settings">
        <EditorProtectedRoute>
          <EditorLayout>
            <EditorSettings />
          </EditorLayout>
        </EditorProtectedRoute>
      </Route>
      <Route path="/editor/messages">
        <EditorProtectedRoute>
          <EditorLayout>
            <Messages />
          </EditorLayout>
        </EditorProtectedRoute>
      </Route>

      <Route path="/">
        <ProtectedRoute route="/dashboard">
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/dashboard">
        <ProtectedRoute route="/dashboard">
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/jobs">
        <ProtectedRoute route="/jobs">
          <Layout>
            <Jobs />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/jobs/:jobId">
        <ProtectedRoute route="/jobs">
          <Layout>
            <JobCard />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/customers">
        <ProtectedRoute route="/customers">
          <Layout>
            <Customers />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/customers/:id">
        <ProtectedRoute route="/customers">
          <Layout>
            <CustomerProfile />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/products">
        <ProtectedRoute route="/products">
          <Layout>
            <Products />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/orders">
        <ProtectedRoute route="/orders">
          <Layout>
            <Orders />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/calendar">
        <ProtectedRoute route="/calendar">
          <Layout>
            <Calendar />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/upload">
        <ProtectedRoute route="/upload">
          <Layout>
            <Upload />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/invite-editor">
        <ProtectedRoute route="/invite-editor">
          <Layout>
            <InviteEditor />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/partnerships">
        <ProtectedRoute route="/partnerships">
          <Layout>
            <Partnerships />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/team">
        <ProtectedRoute route="/settings">
          <Layout>
            <TeamMembers />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      
      <Route path="/settings">
        <ProtectedRoute route="/settings">
          <Layout>
            <Settings />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/messages">
        <ProtectedRoute route="/messages">
          <Layout>
            <Messages />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/production-hub">
        <ProtectedRoute route="/production-hub">
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/reports">
        <ProtectedRoute route="/reports">
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <EditorAuthProvider>
            <Router />
            <Toaster />
          </EditorAuthProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;