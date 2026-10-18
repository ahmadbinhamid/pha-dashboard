import { Copy, Pause, Pencil, Play, Trash2 } from "lucide-react";
import {
  ActionsMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/ActionsMenu";
import { PERMISSIONS } from "@/config/permissions";
import { useMyAccess } from "@/hooks/useMyAccess";

interface DiscountRowActionsMenuProps {
  active: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

export function DiscountRowActionsMenu({ active, onEdit, onDuplicate, onToggleActive, onDelete }: DiscountRowActionsMenuProps) {
  const { can } = useMyAccess();
  const canUpdate = can(PERMISSIONS.discounts.update);
  return (
    <DropdownMenu>
      <ActionsMenuTrigger />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil className="h-3.5 w-3.5 text-fg/50" />
          {canUpdate ? "Edit" : "View"}
        </DropdownMenuItem>
        {can(PERMISSIONS.discounts.create) && (
          <DropdownMenuItem onSelect={onDuplicate}>
            <Copy className="h-3.5 w-3.5 text-fg/50" />
            Duplicate
          </DropdownMenuItem>
        )}
        {canUpdate && (
          <DropdownMenuItem onSelect={onToggleActive}>
            {active ? <Pause className="h-3.5 w-3.5 text-fg/50" /> : <Play className="h-3.5 w-3.5 text-fg/50" />}
            {active ? "Pause" : "Resume"}
          </DropdownMenuItem>
        )}
        {can(PERMISSIONS.discounts.delete) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
