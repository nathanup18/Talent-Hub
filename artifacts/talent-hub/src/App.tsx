import { useAuth } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/hooks/use-auth";
import { Shell } from "@/components/layout/Shell";
import { Link } from "wouter";

// Public Auth Pages
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import VerifyEmail from "@/pages/verify-email";

// Founder Pages
import Profile from "@/pages/profile";
import Dashboard from "@/pages/dashboard";
import CandidateProfile from "@/pages/candidate-profile";
import MyRequests from "@/pages/my-requests";
import Prospective from "@/pages/prospective";

// Admin Pages
import AdminDashboard from "@/pages/admin/dashboard";
import AdminIntroRequests from "@/pages/admin/intro-requests";
import AdminCandidates from "@/pages/admin/candidates";
import AdminDomains from "@/pages/admin/domains";

import NotFound from "@/pages/not-found";
import { Route, Switch, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Never retry 401s — the user is not authenticated; retrying just spams the server
      retry: (failureCount, error: unknown) => {
        const status = (error as any)?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Shell>
      <Switch>
        {/* Public / Auth */}
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/verify-email" component={VerifyEmail} />

        {/* Founder Routes */}
        <Route path="/">
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard">
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        </Route>
        <Route path="/candidates/:id">
          <ProtectedRoute>
            <CandidateProfile />
          </ProtectedRoute>
        </Route>
        <Route path="/my-requests">
          <ProtectedRoute>
            <MyRequests />
          </ProtectedRoute>
        </Route>
        <Route path="/profile">
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        </Route>
        <Route path="/prospective">
          <ProtectedRoute>
            <Prospective />
          </ProtectedRoute>
        </Route>

        {/* Admin Routes */}
        <Route path="/admin">
          <ProtectedRoute adminOnly>
            <AdminDashboard />
          </ProtectedRoute>
        </Route>
        <Route path="/admin/intro-requests">
          <ProtectedRoute adminOnly>
            <AdminIntroRequests />
          </ProtectedRoute>
        </Route>
        <Route path="/admin/candidates">
          <ProtectedRoute adminOnly>
            <AdminCandidates />
          </ProtectedRoute>
        </Route>
        <Route path="/admin/domains">
          <ProtectedRoute adminOnly>
            <AdminDomains />
          </ProtectedRoute>
        </Route>

        {/* 404 */}
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
