import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/auth";

export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/products" replace />;
  }

  return <>{children}</>;
}
