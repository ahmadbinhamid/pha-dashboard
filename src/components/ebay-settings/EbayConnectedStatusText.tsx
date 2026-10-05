import { useQuery } from "@tanstack/react-query";
import { SkeletonText } from "@/components/ui/Skeleton";
import { getEbayStatus } from "@/lib/api/ebay";

// Connected eBay status, confirmed by a live token refresh.
export function EbayConnectedStatusText() {
  const { data, isLoading } = useQuery({ queryKey: ["ebay-status"], queryFn: getEbayStatus });
  if (isLoading) return <SkeletonText lines={1} />;
  return (
    <p className="text-sm text-fg/65">
      {data?.data.connected
        ? "This store is connected to eBay and syncing listings."
        : "Connected, but the last token refresh failed — check back shortly or reconnect below."}
    </p>
  );
}
