import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { SkeletonText } from "@/components/ui/Skeleton";
import { getEbayStatus, getEbaySettings, getEbayConnectUrl } from "@/lib/api/ebay";
import type { EbayConnectionStatus } from "@/types/ebaySettings";

const STATUS_VARIANT: Record<EbayConnectionStatus, "ok" | "warn" | "danger" | "muted"> = {
  connected: "ok",
  token_expired: "warn",
  revoked: "danger",
  error: "danger",
  not_connected: "muted",
};

const STATUS_LABEL: Record<EbayConnectionStatus, string> = {
  connected: "Connected",
  token_expired: "Token expired — reconnect",
  revoked: "Access revoked — reconnect",
  error: "Connection error",
  not_connected: "Not connected",
};

export function EbayConnectCard() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sandbox, setSandbox] = useState(false);

  const callbackResult = searchParams.get("ebay_connect");
  const callbackReason = searchParams.get("reason");

  // Clear the one-time callback query params so a page refresh doesn't
  // re-show a stale success/error banner.
  useEffect(() => {
    if (!callbackResult) return;
    queryClient.invalidateQueries({ queryKey: ["ebay-status"] });
    queryClient.invalidateQueries({ queryKey: ["ebay-settings"] });
    const next = new URLSearchParams(searchParams);
    next.delete("ebay_connect");
    next.delete("reason");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackResult]);

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ["ebay-status"],
    queryFn: getEbayStatus,
  });
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["ebay-settings"],
    queryFn: getEbaySettings,
  });

  const settings = settingsData?.data;
  const connectionStatus = settings?.connection_status ?? "not_connected";
  const isLoading = statusLoading || settingsLoading;

  const connectMutation = useMutation({
    mutationFn: () => getEbayConnectUrl(sandbox),
    onSuccess: (res) => {
      window.location.href = res.data.url;
    },
  });

  return (
    <Card>
      <CardHeader
        title="eBay integration"
        description="Connect this store's eBay seller account to publish and sync listings."
        right={<Badge variant={STATUS_VARIANT[connectionStatus]}>{STATUS_LABEL[connectionStatus]}</Badge>}
      />
      <CardContent>
        {isLoading ? (
          <SkeletonText lines={2} />
        ) : (
          <div className="flex flex-col gap-4">
            {callbackResult === "success" && (
              <p className="rounded-xs bg-tag-success-bg px-3 py-2 text-sm text-tag-success-fg">
                eBay account connected successfully.
              </p>
            )}
            {callbackResult === "error" && (
              <p className="rounded-xs bg-tag-danger-bg px-3 py-2 text-sm text-tag-danger-fg">
                Failed to connect eBay account{callbackReason ? ` (${callbackReason})` : ""}. Please try again.
              </p>
            )}

            {settings?.last_error && connectionStatus !== "connected" && (
              <p className="text-xs font-medium text-danger">{settings.last_error}</p>
            )}

            {connectionStatus === "connected" ? (
              <p className="text-sm text-fg/65">
                {statusData?.data.connected
                  ? "This store is connected to eBay and syncing listings."
                  : "Connected, but the last token refresh failed — check back shortly or reconnect below."}
              </p>
            ) : (
              <p className="text-sm text-fg/65">
                No eBay account connected yet — listings can be created locally but won't sync to eBay.
              </p>
            )}

            <Switch
              checked={sandbox}
              onCheckedChange={setSandbox}
              label="Use eBay sandbox"
              description="For testing only — connects to eBay's sandbox environment instead of production."
            />

            <div>
              <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
                {connectMutation.isPending
                  ? "Redirecting…"
                  : connectionStatus === "connected"
                    ? "Reconnect eBay account"
                    : "Connect eBay account"}
              </Button>
            </div>
            {connectMutation.isError && (
              <p className="text-xs font-medium text-danger">
                {(connectMutation.error as Error)?.message || "Failed to start eBay connection"}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
