import { Switch, Route } from "wouter";
import { EditorAuthProvider } from "@/contexts/EditorAuthContext";
import EditorProtectedRoute from "@/components/EditorProtectedRoute";
import EditorLayout from "@/components/EditorLayout";

// Editor Pages
import EditorLogin from "@/pages/EditorLogin";
import EditorSignup from "@/pages/EditorSignup";
import EditorDashboard from "@/pages/EditorDashboard";
import EditorJobs from "@/pages/EditorJobs";
import EditorDownloads from "@/pages/EditorDownloads";
import EditorUploads from "@/pages/EditorUploads";
import EditorSettings from "@/pages/EditorSettings";
import NotFound from "@/pages/not-found";

function EditorRouter() {
  return (
    <Switch>
      {/* Public Editor Routes */}
      <Route path="/editor-login" component={EditorLogin} />
      <Route path="/editor-signup" component={EditorSignup} />
      
      {/* Protected Editor Routes - Using relative paths for nested routing */}
      <Route path="/">
        <EditorProtectedRoute>
          <EditorLayout>
            <EditorDashboard />
          </EditorLayout>
        </EditorProtectedRoute>
      </Route>
      
      <Route path="/dashboard">
        <EditorProtectedRoute>
          <EditorLayout>
            <EditorDashboard />
          </EditorLayout>
        </EditorProtectedRoute>
      </Route>
      
      <Route path="/jobs">
        <EditorProtectedRoute>
          <EditorLayout>
            <EditorJobs />
          </EditorLayout>
        </EditorProtectedRoute>
      </Route>
      
      <Route path="/downloads">
        <EditorProtectedRoute>
          <EditorLayout>
            <EditorDownloads />
          </EditorLayout>
        </EditorProtectedRoute>
      </Route>
      
      <Route path="/uploads">
        <EditorProtectedRoute>
          <EditorLayout>
            <EditorUploads />
          </EditorLayout>
        </EditorProtectedRoute>
      </Route>
      
      <Route path="/settings">
        <EditorProtectedRoute>
          <EditorLayout>
            <EditorSettings />
          </EditorLayout>
        </EditorProtectedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

export default function EditorApp() {
  return (
    <EditorAuthProvider>
      <EditorRouter />
    </EditorAuthProvider>
  );
}