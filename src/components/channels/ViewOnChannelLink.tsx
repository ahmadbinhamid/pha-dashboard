import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";

interface ViewOnChannelLinkProps {
  url: string | null | undefined;
  channelName: string;
  // Plain text link for dense rows; ghost button elsewhere.
  compact?: boolean;
  className?: string;
}

// Opens the live listing on the channel; renders nothing without a public URL.
export function ViewOnChannelLink({ url, channelName, compact = false, className }: ViewOnChannelLinkProps) {
  if (!url) return null;
  const label = `View on ${channelName}`;

  if (compact) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent hover:text-accent/80", className)}
      >
        {label}
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  return (
    <Button asChild variant="ghost" size="sm" className={cn("h-8 gap-1 px-2 text-xs", className)}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="h-3.5 w-3.5" />
        {label}
      </a>
    </Button>
  );
}
