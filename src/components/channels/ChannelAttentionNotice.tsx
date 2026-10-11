import { AlertTriangle, ExternalLink } from "lucide-react";
import Link from "@/components/ui/Link";
import { channelRemedy } from "@/lib/marketplace/channelRemedy";
import { isChannelComingSoon } from "@/lib/marketplace/channelRelease";
import { cn } from "@/utils/cn";
import type { ChannelSummary } from "@/types/channel";

interface ChannelAttentionNoticeProps {
  channel: ChannelSummary;
  className?: string;
}

// Flagged or unavailable channel with its remedy link; nothing when healthy.
export function ChannelAttentionNotice({ channel, className }: ChannelAttentionNoticeProps) {
  // A coming-soon channel has nothing for the tenant to fix yet.
  const remedy = isChannelComingSoon(channel) ? null : channelRemedy(channel);
  if (!remedy) return null;
  const { message, action } = remedy;

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
