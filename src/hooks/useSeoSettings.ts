import { useQuery } from "@tanstack/react-query";
import { SEO_SETTINGS_QUERY_KEY, getSeoSettings } from "@/lib/api/seo";

/** Site SEO settings: title template and store URL for previews. */
export function useSeoSettings() {
  const { data, isLoading } = useQuery({ queryKey: SEO_SETTINGS_QUERY_KEY, queryFn: getSeoSettings });
  return { settings: data?.data ?? null, isLoading };
}
