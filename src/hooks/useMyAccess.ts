import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MY_ACCESS_QUERY_KEY, getMyAccess } from "@/lib/api/access";
import type { Permission } from "@/config/permissions";

// The signed-in user's role and permissions in the current organisation.
export function useMyAccess() {
  const { data, isLoading } = useQuery({ queryKey: MY_ACCESS_QUERY_KEY, queryFn: getMyAccess, staleTime: 60_000 });
  const access = data?.data;
  const isTenantAdmin = !!access?.is_tenant_admin;
  const permissions = useMemo(() => access?.permissions ?? [], [access]);
  const granted = useMemo(() => new Set(permissions), [permissions]);

  const can = useCallback(
    (permission: Permission) => isTenantAdmin || granted.has(permission),
    [isTenantAdmin, granted],
  );

  return { isTenantAdmin, role: access?.role ?? null, permissions, can, isLoading };
}
