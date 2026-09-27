import {
  DropdownMenu,
  ActionsMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/ActionsMenu";
import { SlidersHorizontal, Hash, History } from "lucide-react";
import { PERMISSIONS } from "@/config/permissions";
import { useMyAccess } from "@/hooks/useMyAccess";

interface InventoryRowActionsMenuProps {
  onAdjust: () => void;
  onSetStock: () => void;
  onViewHistory: () => void;
}

export function InventoryRowActionsMenu({ onAdjust, onSetStock, onViewHistory }: InventoryRowActionsMenuProps) {
  const { can } = useMyAccess();
  const canUpdate = can(PERMISSIONS.inventory.update);
  return (
    <DropdownMenu>
      <ActionsMenuTrigger />
      <DropdownMenuContent align="end">
        {canUpdate && (
          <>
            <DropdownMenuItem onSelect={onAdjust}>
              <SlidersHorizontal className="h-3.5 w-3.5 text-fg/50" />
              Adjust Stock
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onSetStock}>
              <Hash className="h-3.5 w-3.5 text-fg/50" />
              Set Stock
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem onSelect={onViewHistory}>
          <History className="h-3.5 w-3.5 text-fg/50" />
          View History
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
