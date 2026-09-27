import { useQuery } from "@tanstack/react-query";
import { MY_ACCESS_QUERY_KEY, getMyAccess } from "@/lib/api/access";

// Whether the signed-in user is the current organisation's Admin.
export function useMyAccess() {
  const { data, isLoading } = useQuery({ queryKey: MY_ACCESS_QUERY_KEY, queryFn: getMyAccess, staleTime: 60_000 });
  return { isTenantAdmin: !!data?.data?.is_tenant_admin, role: data?.data?.role ?? null, isLoading };
}
