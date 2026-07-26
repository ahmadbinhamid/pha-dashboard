import {
  DropdownMenu,
  ActionsMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/ActionsMenu";
import { SlidersHorizontal, Hash, History } from "lucide-react";

interface InventoryRowActionsMenuProps {
  onAdjust: () => void;
  onSetStock: () => void;
  onViewHistory: () => void;
}

export function InventoryRowActionsMenu({ onAdjust, onSetStock, onViewHistory }: InventoryRowActionsMenuProps) {
  return (
    <DropdownMenu>
      <ActionsMenuTrigger />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onAdjust}>
          <SlidersHorizontal className="h-3.5 w-3.5 text-fg/50" />
          Adjust Stock
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onSetStock}>
          <Hash className="h-3.5 w-3.5 text-fg/50" />
          Set Stock
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onViewHistory}>
          <History className="h-3.5 w-3.5 text-fg/50" />
          View History
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
