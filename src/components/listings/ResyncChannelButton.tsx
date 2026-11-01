import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/context";
import { resyncChannelListings } from "@/lib/api/channels";
import type { ChannelSummary } from "@/types/channel";

interface ResyncChannelButtonProps {
  // The channel picked in the table's filter; none means nothing to target.
  channel: ChannelSummary | undefined;
}

export function ResyncChannelButton({ channel }: ResyncChannelButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: (platform: string) => resyncChannelListings(platform),
    onSuccess: (res) => {
      setConfirming(false);
      toast({
        title: `${res.data?.listings ?? 0} ${channel?.name ?? ""} listing(s) queued for re-sync`,
        description: "They update in the background over the next few minutes.",
        tone: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
    onError: (err: Error) => {
      setConfirming(false);
      toast({ title: "Couldn't start the re-sync", description: err.message, tone: "danger" });
    },
  });

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-1.5"
        disabled={!channel || mutation.isPending}
        title={channel ? undefined : "Pick a channel in the filter to re-sync all of its listings"}
        onClick={() => setConfirming(true)}
      >
        <RefreshCcw className={mutation.isPending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        {channel ? `Re-sync all ${channel.name}` : "Re-sync all"}
      </Button>
      {channel && (
        <ConfirmModal
          open={confirming}
          onOpenChange={setConfirming}
          title={`Re-sync every ${channel.name} listing?`}
          description={`Every active ${channel.name} listing is pushed again with its current details, images and description. This runs in the background and can take a few minutes for large catalogues.`}
          confirmLabel="Re-sync all"
          tone="accent"
          confirming={mutation.isPending}
          onConfirm={() => mutation.mutate(channel.key)}
        />
      )}
    </>
  );
}
