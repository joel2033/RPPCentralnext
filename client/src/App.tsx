import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";

// Layout
import Layout from "@/components/Layout";

// Pages
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Jobs from "@/pages/Jobs";
import Customers from "@/pages/Customers";
import Products from "@/pages/Products";
import Orders from "@/pages/Orders";
import Calendar from "@/pages/Calendar";
import Upload from "@/pages/Upload";
import NotFound from "@/pages/not-found";

function Router() {
  const [user, loading] = useAuthState(auth);

  if (loading) {
    return (
      <div className="min-h-screen bg-rpp-grey-surface flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-rpp-red-main rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-rpp-grey-light">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/jobs" component={Jobs} />
        <Route path="/customers" component={Customers} />
        <Route path="/products" component={Products} />
        <Route path="/orders" component={Orders} />
        <Route path="/calendar" component={Calendar} />
        <Route path="/upload" component={Upload} />
        <Route path="/editor" component={Dashboard} />
        <Route path="/reports/jobs" component={Dashboard} />
        <Route path="/reports/revenue" component={Dashboard} />
        <Route path="/reports/performance" component={Dashboard} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
