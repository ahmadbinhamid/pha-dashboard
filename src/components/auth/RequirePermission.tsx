import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useMyAccess } from "@/hooks/useMyAccess";
import type { Permission } from "@/config/permissions";

interface RequirePermissionProps {
  permission: Permission;
  children: ReactNode;
}

// Page guard; renders nothing until access loads so the page never flashes.
export function RequirePermission({ permission, children }: RequirePermissionProps) {
  const { can, isLoading } = useMyAccess();
  if (isLoading) return null;
  if (!can(permission)) {
    return (
      <EmptyState
        icon={Lock}
        title="You don't have access to this page"
        description="Ask your organisation's Admin to update your role if you need it."
        className="py-24"
      />
    );
  }
  return <>{children}</>;
}
