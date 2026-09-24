import { ExternalLink, RefreshCw, SlidersHorizontal } from "lucide-react";
import { DropdownMenu, ActionsMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/ActionsMenu";
import { cn } from "@/utils/cn";

interface SalesChannelRowActionsMenuProps {
  channelName: string;
  onEdit: () => void;
  editDisabled?: boolean;
  // Listed-only actions; omitted before the product is on the channel.
  onResync?: () => void;
  resyncDisabled?: boolean;
  resyncing?: boolean;
  externalUrl?: string | null;
}

// Per-channel "..." menu on the product's Sales channels rows.
export function SalesChannelRowActionsMenu({
  channelName,
  onEdit,
  editDisabled,
  onResync,
  resyncDisabled,
  resyncing,
  externalUrl,
}: SalesChannelRowActionsMenuProps) {
  return (
    <DropdownMenu>
      <ActionsMenuTrigger />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit} disabled={editDisabled}>
          <SlidersHorizontal className="h-3.5 w-3.5 text-fg/50" />
          Edit listing
        </DropdownMenuItem>
        {externalUrl && (
          <DropdownMenuItem onSelect={() => window.open(externalUrl, "_blank", "noopener,noreferrer")}>
            <ExternalLink className="h-3.5 w-3.5 text-fg/50" />
            View on {channelName}
          </DropdownMenuItem>
        )}
        {onResync && (
          <DropdownMenuItem onSelect={onResync} disabled={resyncDisabled}>
            <RefreshCw className={cn("h-3.5 w-3.5 text-fg/50", resyncing && "animate-spin")} />
            Re-sync
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
