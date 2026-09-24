import { AlertTriangle, ExternalLink } from "lucide-react";
import Link from "@/components/ui/Link";
import { CHANNEL_STATUS_REASON_ACTION } from "@/config/channelStatusReasons";
import { cn } from "@/utils/cn";
import type { ChannelSummary } from "@/types/channel";

interface ChannelAttentionNoticeProps {
  channel: ChannelSummary;
  className?: string;
}

// Unmet channel prerequisite with its remedy; renders nothing when healthy.
export function ChannelAttentionNotice({ channel, className }: ChannelAttentionNoticeProps) {
  const { status_reason: reason, status_message: message } = channel.connection;
  if (!reason || !message) return null;
  const action = CHANNEL_STATUS_REASON_ACTION[reason];

  return (
    <div
      role="alert"
      className={cn("flex flex-wrap items-start gap-2 rounded-md bg-tag-warn-bg px-3 py-2 text-xs text-tag-warn-fg", className)}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      {action && (
        <Link href={action.href} className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">
          {action.label}
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
