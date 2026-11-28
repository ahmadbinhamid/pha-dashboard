import { Copy, Pause, Pencil, Trash2 } from "lucide-react";
import {
  ActionsMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/ActionsMenu";
import { PERMISSIONS } from "@/config/permissions";
import { useMyAccess } from "@/hooks/useMyAccess";
import type { CampaignStatus } from "@/types/campaign";

interface CampaignRowActionsMenuProps {
  status: CampaignStatus;
  onOpen: () => void;
  onDuplicate: () => void;
  onPause: () => void;
  onDelete: () => void;
}

export function CampaignRowActionsMenu({ status, onOpen, onDuplicate, onPause, onDelete }: CampaignRowActionsMenuProps) {
  const { can } = useMyAccess();
  const editable = can(PERMISSIONS.campaigns.update) && status !== "sent" && status !== "sending";
  const pausable = can(PERMISSIONS.campaigns.send) && (status === "scheduled" || status === "active");
  return (
    <DropdownMenu>
      <ActionsMenuTrigger />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onOpen}>
          <Pencil className="h-3.5 w-3.5 text-fg/50" />
          {editable ? "Edit" : "View"}
        </DropdownMenuItem>
        {can(PERMISSIONS.campaigns.create) && (
          <DropdownMenuItem onSelect={onDuplicate}>
            <Copy className="h-3.5 w-3.5 text-fg/50" />
            Duplicate
          </DropdownMenuItem>
        )}
        {pausable && (
          <DropdownMenuItem onSelect={onPause}>
            <Pause className="h-3.5 w-3.5 text-fg/50" />
            Pause
          </DropdownMenuItem>
        )}
        {can(PERMISSIONS.campaigns.delete) && status !== "sending" && (
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
