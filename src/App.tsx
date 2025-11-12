import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index";
import CompanyDetail from "./pages/CompanyDetail";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";
import AdminTenantDetail from "./pages/AdminTenantDetail";
import { AdminRoute } from "./components/AdminRoute";

const queryClient = new QueryClient();

// Component to handle routing based on auth state
const AppRoutes = () => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // Show loading screen while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If user is authenticated and on login page, redirect to home
  if (user && profile && location.pathname === "/login") {
    return <Navigate to="/" replace />;
  }

  // If user is not authenticated, only allow login page
  if (!user || !profile) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // User is authenticated - show protected routes
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/company/:companyName" element={<CompanyDetail />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/tenants/:tenantId" element={<AdminRoute><AdminTenantDetail /></AdminRoute>} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <Analytics />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
