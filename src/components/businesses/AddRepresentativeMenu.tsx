import { ChevronDown, Link2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/ActionsMenu";
import { PERMISSIONS } from "@/config/permissions";
import { useMyAccess } from "@/hooks/useMyAccess";

interface AddRepresentativeMenuProps {
  onAddExisting: () => void;
  onCreateNew: () => void;
}

// Linking needs edit rights, creating needs add rights, so items gate apart.
export function AddRepresentativeMenu({ onAddExisting, onCreateNew }: AddRepresentativeMenuProps) {
  const { can } = useMyAccess();
  const canLink = can(PERMISSIONS.customers.update);
  const canCreate = can(PERMISSIONS.customers.create);
  if (!canLink && !canCreate) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          <UserPlus className="h-3.5 w-3.5" />
          Add representative
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {canLink && (
          <DropdownMenuItem onSelect={onAddExisting} className="items-start py-2">
            <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-fg/50" />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-fg">Existing customer</span>
              <span className="block text-xs text-fg/55">Link someone already on file</span>
            </span>
          </DropdownMenuItem>
        )}
        {canCreate && (
          <DropdownMenuItem onSelect={onCreateNew} className="items-start py-2">
            <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-fg/50" />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-fg">New customer</span>
              <span className="block text-xs text-fg/55">Create a rep for this business</span>
            </span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
