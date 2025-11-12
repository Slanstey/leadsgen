import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth();

  // Show loading while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If no user or no profile, redirect to login
  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  // Check if user is admin
  if (!(profile as any).is_admin) {
    return <Navigate to="/" replace />;
  }

  // User is authenticated and is admin, show the protected content
  return <>{children}</>;
}

