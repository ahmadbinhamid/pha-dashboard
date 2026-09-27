import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChannelSyncTable } from "@/components/listings/ChannelSyncTable";
import { NoChannelsConnectedCard } from "@/components/channels/NoChannelsConnectedCard";
import { getChannels } from "@/lib/api/channels";

// Channel sync health; listings are created/edited on the product page.
export default function ChannelSyncPage() {
  const { data, isLoading } = useQuery({ queryKey: ["channels"], queryFn: getChannels });
  const channels = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Channel sync"
        description="Listings that failed to sync, with the channel's error. Retry after fixing the cause."
      />

      {isLoading ? (
        <Skeleton className="h-11 w-full rounded-2xl" />
      ) : channels.length === 0 ? (
        <NoChannelsConnectedCard />
      ) : null}

      <ChannelSyncTable channels={channels} />
    </div>
  );
}
