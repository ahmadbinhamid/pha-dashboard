import {
  DropdownMenu,
  ActionsMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/ActionsMenu";
import { Cloud, Pencil, Trash2, ExternalLink } from "lucide-react";

export function ListingRowActionsMenu({
  onPush,
  pushDisabled,
  onEdit,
  onDelete,
  ebayItemUrl,
}: {
  onPush: () => void;
  pushDisabled?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  ebayItemUrl?: string | null;
}) {
  return (
    <DropdownMenu>
      <ActionsMenuTrigger />
      <DropdownMenuContent align="end">
        {ebayItemUrl && (
          <DropdownMenuItem
            onSelect={() => window.open(ebayItemUrl, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-3.5 w-3.5 text-fg/50" />
            View on eBay
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onPush} disabled={pushDisabled}>
          <Cloud className="h-3.5 w-3.5 text-fg/50" />
          Push to eBay
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
