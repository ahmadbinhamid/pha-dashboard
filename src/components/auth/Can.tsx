import type { ReactNode } from "react";
import { useMyAccess } from "@/hooks/useMyAccess";
import type { Permission } from "@/config/permissions";

interface CanProps {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}

// Renders children only when the user holds `permission`; the server enforces.
export function Can({ permission, children, fallback = null }: CanProps) {
  const { can } = useMyAccess();
  return <>{can(permission) ? children : fallback}</>;
}
