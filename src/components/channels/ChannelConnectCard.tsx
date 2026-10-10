import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SkeletonText } from "@/components/ui/Skeleton";
import { ChannelAttentionNotice } from "@/components/channels/ChannelAttentionNotice";
import { CHANNEL_CONNECT_PLUGINS } from "@/components/channels/channelConnectRegistry";
import { getChannels } from "@/lib/api/channels";
import { formatRelativeTime } from "@/utils/formatRelativeTime";
import { CHANNEL_STATUS_DISPLAY, CHANNEL_NEEDS_ATTENTION_LABEL, CHANNEL_UNAVAILABLE_LABEL } from "@/config/channelConnect";
import { PLATFORM_LABEL } from "@/config/marketplacePlatforms";
import type { ChannelConnectOptions, ChannelConnectPlugin, ChannelStatusDisplay } from "@/types/channelConnect";
import type { ChannelSummary } from "@/types/channel";
import { InlineNotice } from "@/components/ui/InlineNotice";

interface ChannelConnectCardProps {
  platform: string;
}

const NO_PLUGIN: Partial<ChannelConnectPlugin> = {};

function badgeFor(channel: ChannelSummary | undefined, plugin: Partial<ChannelConnectPlugin>): ChannelStatusDisplay {
  if (channel && !channel.available) return { variant: "muted", label: CHANNEL_UNAVAILABLE_LABEL };
  const status = channel?.connection.status ?? "disconnected";
  const display = plugin.statusOverrides?.[status] ?? CHANNEL_STATUS_DISPLAY[status];
  return channel?.connection.status_reason ? { ...display, label: CHANNEL_NEEDS_ATTENTION_LABEL } : display;
}

// Manifest-driven connect card; platform specifics come from the registry.
export function ChannelConnectCard({ platform }: ChannelConnectCardProps) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [connectOptions, setConnectOptions] = useState<ChannelConnectOptions>({});
  const [completedText, setCompletedText] = useState<string | null>(null);
  const plugin = CHANNEL_CONNECT_PLUGINS[platform] ?? NO_PLUGIN;

  const callbackParam = plugin.callbackParam ?? `${platform}_connect`;
  const callbackResult = searchParams.get(callbackParam);
  const callbackReason = searchParams.get("reason");
  const inInlineStep = !!plugin.InlineStep && !!plugin.inlineStepValue && callbackResult === plugin.inlineStepValue;

  const clearCallback = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete(callbackParam);
    next.delete("reason");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, callbackParam]);

  // One-time callback params clear so a refresh doesn't re-show a stale banner.
  useEffect(() => {
    if (!callbackResult || callbackResult === plugin.inlineStepValue) return;
    for (const queryKey of [["channels"], ...(plugin.invalidateQueryKeys ?? [])]) {
      queryClient.invalidateQueries({ queryKey: [...queryKey] });
    }
    clearCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackResult]);

  const { data: channelsData, isLoading } = useQuery({ queryKey: ["channels"], queryFn: getChannels });
  const channel = channelsData?.data.find((c) => c.key === platform);
  const name = channel?.name ?? PLATFORM_LABEL[platform] ?? platform;
  const status = channel?.connection.status ?? "disconnected";
  const connected = status === "connected";
  const unavailable = channel ? !channel.available : false;
  const lastSynced = connected ? formatRelativeTime(channel?.last_synced_at ?? null) : null;
  const badge = badgeFor(channel, plugin);

  const connectMutation = useMutation({
    mutationFn: () => {
      if (!plugin.getConnectUrl) throw new Error(`${name} can't be connected from here yet.`);
      return plugin.getConnectUrl(connectOptions);
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
  });

  const onInlineStepComplete = (message: string) => {
    setCompletedText(message);
    clearCallback();
  };

  const { ConnectOptions, ConnectedText, InlineStep, Section } = plugin;
  const connectNoun = plugin.connectNoun ?? name;
  const callbackErrorText =
    plugin.callbackErrorText?.(callbackReason) ??
    `Failed to connect ${name}${callbackReason ? ` (${callbackReason})` : ""}. Please try again.`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={`${name} integration`}
          description={plugin.description ?? channel?.description}
          right={<Badge variant={badge.variant}>{badge.label}</Badge>}
        />
        <CardContent>
          {isLoading ? (
            <SkeletonText lines={2} />
          ) : (
            <div className="flex flex-col gap-4">
              {callbackResult === "success" && plugin.callbackSuccessText && (
                <InlineNotice variant="ok">{plugin.callbackSuccessText}</InlineNotice>
              )}
              {callbackResult === "error" && (
                <InlineNotice variant="danger">{callbackErrorText}</InlineNotice>
              )}
              {completedText && (
                <InlineNotice variant="ok">{completedText}</InlineNotice>
              )}

              {channel?.connection.status_reason ? (
                <ChannelAttentionNotice channel={channel} />
              ) : (
                channel?.connection.last_error &&
                !connected && <p className="text-xs font-medium text-danger">{channel.connection.last_error}</p>
              )}

              {unavailable ? (
                <InlineNotice variant="warn">{channel?.unavailable_reason}</InlineNotice>
              ) : inInlineStep && InlineStep && channel ? (
                <InlineStep channel={channel} onComplete={onInlineStepComplete} />
              ) : (
                <>
                  {connected && ConnectedText ? (
                    <ConnectedText />
                  ) : (
                    <p className="text-sm text-fg/65">
                      {connected
                        ? (plugin.connectedText ?? `This store is connected to ${name} and syncing listings.`)
                        : (plugin.disconnectedText ??
                          `No ${name} account connected yet — listings can be created locally but won't sync to ${name}.`)}
                    </p>
                  )}
                  {lastSynced && <p className="text-xs text-fg/55">Last synced {lastSynced}</p>}
                  {ConnectOptions && <ConnectOptions value={connectOptions} onChange={setConnectOptions} />}
                  {/* NOTE: no disconnect: neither channel has a disconnect API yet. */}
                  <div>
                    <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
                      {connectMutation.isPending ? "Redirecting…" : `${connected ? "Reconnect" : "Connect"} ${connectNoun}`}
                    </Button>
                  </div>
                  {connectMutation.isError && (
                    <p className="text-xs font-medium text-danger">
                      {(connectMutation.error as Error)?.message || plugin.connectErrorText || `Failed to start ${name} connection`}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {Section && <Section channel={channel} />}
    </div>
  );
}
