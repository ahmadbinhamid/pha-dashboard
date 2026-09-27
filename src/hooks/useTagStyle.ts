import { useQuery } from "@tanstack/react-query";
import { TAG_QUERY_KEYS, getTagStyle } from "@/lib/api/tags";
import { DEFAULT_TAG_STYLE } from "@/config/productTag";

// Tenant tag style; defaults until loaded so printing never waits on it.
export function useTagStyle() {
  const { data, isLoading } = useQuery({ queryKey: TAG_QUERY_KEYS.style, queryFn: getTagStyle, staleTime: 5 * 60_000 });
  return { style: data?.data ?? DEFAULT_TAG_STYLE, isLoading };
}
