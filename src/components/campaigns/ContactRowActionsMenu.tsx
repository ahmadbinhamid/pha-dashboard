import { MailX, Pencil, Trash2 } from "lucide-react";
import {
  ActionsMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/ActionsMenu";
import { PERMISSIONS } from "@/config/permissions";
import { useMyAccess } from "@/hooks/useMyAccess";
import type { Contact } from "@/types/campaign";

interface ContactRowActionsMenuProps {
  contact: Contact;
  onEdit: () => void;
  onUnsubscribe: () => void;
  onDelete: () => void;
}

export function ContactRowActionsMenu({ contact, onEdit, onUnsubscribe, onDelete }: ContactRowActionsMenuProps) {
  const { can } = useMyAccess();
  const canUpdate = can(PERMISSIONS.campaigns.update);
  const canDelete = can(PERMISSIONS.campaigns.delete);
  if (!canUpdate && !canDelete) return null;
  return (
    <DropdownMenu>
      <ActionsMenuTrigger />
      <DropdownMenuContent align="end">
        {canUpdate && (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil className="h-3.5 w-3.5 text-fg/50" />
            Edit
          </DropdownMenuItem>
        )}
        {canUpdate && contact.status === "subscribed" && (
          <DropdownMenuItem onSelect={onUnsubscribe}>
            <MailX className="h-3.5 w-3.5 text-fg/50" />
            Unsubscribe
          </DropdownMenuItem>
        )}
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
