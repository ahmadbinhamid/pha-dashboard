import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/auth";
import { useMyAccess } from "@/hooks/useMyAccess";
import { NoOrganisationState } from "@/components/auth/NoOrganisationState";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { isLoading: accessLoading, hasOrganisation } = useMyAccess({ enabled: isAuthenticated });
  const location = useLocation();

  // Waits for permissions too, so the nav and page guards render once, complete.
  if (isLoading || (isAuthenticated && accessLoading)) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasOrganisation) return <NoOrganisationState />;

  return <>{children}</>;
}
