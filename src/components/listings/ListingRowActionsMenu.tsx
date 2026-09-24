import { DropdownMenu, ActionsMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/ActionsMenu";
import { Package, RefreshCw, ScrollText } from "lucide-react";

// Read or re-sync only; listing edits live on the product page.
export function ListingRowActionsMenu({
  onViewProduct,
  onResync,
  resyncDisabled,
  onViewLog,
}: {
  onViewProduct: (() => void) | null;
  onResync: () => void;
  resyncDisabled?: boolean;
  onViewLog: () => void;
}) {
  return (
    <DropdownMenu>
      <ActionsMenuTrigger />
      <DropdownMenuContent align="end">
        {onViewProduct && (
          <DropdownMenuItem onSelect={onViewProduct}>
            <Package className="h-3.5 w-3.5 text-fg/50" />
            View product
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onResync} disabled={resyncDisabled}>
          <RefreshCw className="h-3.5 w-3.5 text-fg/50" />
          Re-sync
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onViewLog}>
          <ScrollText className="h-3.5 w-3.5 text-fg/50" />
          View sync log
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
