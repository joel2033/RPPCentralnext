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
import Customers from "@/pages/Customers";
import Products from "@/pages/Products";
import Orders from "@/pages/Orders";
import Calendar from "@/pages/Calendar";
import Upload from "@/pages/Upload";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      
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
      
      <Route path="/customers">
        <ProtectedRoute route="/customers">
          <Layout>
            <Customers />
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
      
      <Route path="/editor-dashboard">
        <ProtectedRoute route="/editor-dashboard">
          <Layout>
            <Dashboard />
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
          <Router />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
