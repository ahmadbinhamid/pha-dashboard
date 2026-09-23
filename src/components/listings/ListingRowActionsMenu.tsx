import {
  DropdownMenu,
  ActionsMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/ActionsMenu";
import { PLATFORM_LABEL } from "@/config/marketplacePlatforms";
import { Cloud, Pencil, Trash2, ExternalLink } from "lucide-react";

// Platform-agnostic since the Listings table mixes every channel's rows (listing.query.service.js); `externalUrl` is whichever platform's "view live" link is populated (only eBay today, via ebay_item_url).
export function ListingRowActionsMenu({
  platform,
  onPush,
  pushDisabled,
  onEdit,
  onDelete,
  externalUrl,
}: {
  platform: string;
  onPush: () => void;
  pushDisabled?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  externalUrl?: string | null;
}) {
  const platformLabel = PLATFORM_LABEL[platform] ?? platform;
  return (
    <DropdownMenu>
      <ActionsMenuTrigger />
      <DropdownMenuContent align="end">
        {externalUrl && (
          <DropdownMenuItem
            onSelect={() => window.open(externalUrl, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-3.5 w-3.5 text-fg/50" />
            View on {platformLabel}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onPush} disabled={pushDisabled}>
          <Cloud className="h-3.5 w-3.5 text-fg/50" />
          Push to {platformLabel}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil className="h-3.5 w-3.5 text-fg/50" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
