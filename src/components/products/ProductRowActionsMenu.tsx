import {
  DropdownMenu,
  ActionsMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/ActionsMenu";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { PERMISSIONS } from "@/config/permissions";
import { useMyAccess } from "@/hooks/useMyAccess";

// Without products.update the editor opens read-only, so it's "View".
export function ProductRowActionsMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const { can } = useMyAccess();
  const canEdit = can(PERMISSIONS.products.update);
  const canDelete = can(PERMISSIONS.products.delete);

  return (
    <DropdownMenu>
      <ActionsMenuTrigger />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          {canEdit ? <Pencil className="h-3.5 w-3.5 text-fg/50" /> : <Eye className="h-3.5 w-3.5 text-fg/50" />}
          {canEdit ? "Edit" : "View"}
        </DropdownMenuItem>
        {canDelete && (
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
