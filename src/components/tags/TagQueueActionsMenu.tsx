import { ChevronDown, DownloadCloud, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/ActionsMenu";

interface TagQueueActionsMenuProps {
  onImportUnprinted: () => void;
  onClear: () => void;
  canClear: boolean;
  disabled?: boolean;
}

// "Actions" beside the queue search: bulk import and clear.
export function TagQueueActionsMenu({ onImportUnprinted, onClear, canClear, disabled }: TagQueueActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="secondary" size="sm" className="h-9 shrink-0 gap-1.5" disabled={disabled}>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Actions
          <ChevronDown className="h-3.5 w-3.5 text-fg/50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem onSelect={onImportUnprinted}>
          <DownloadCloud className="h-3.5 w-3.5 text-fg/50" />
          <div>
            <p className="text-sm">Import all products never printed</p>
            <p className="text-xs text-fg/55">Queues every in-stock product with no tag in the print history.</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive disabled={!canClear} onSelect={onClear}>
          <Trash2 className="h-3.5 w-3.5" />
          Clear tag queue
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
