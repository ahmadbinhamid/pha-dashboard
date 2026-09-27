import { MoreHorizontal, Send, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { TableRow, TableCell } from "@/components/ui/Table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/ActionsMenu";
import { INVITATION_STATUS_BADGE } from "@/config/access";
import type { Invitation } from "@/types/access";

// One outstanding invite; the link itself only ever goes out by email.
export function InvitationRow({
  invitation,
  canManage,
  onResend,
  onRevoke,
}: {
  invitation: Invitation;
  canManage: boolean;
  onResend: (invitation: Invitation) => void;
  onRevoke: (invitation: Invitation) => void;
}) {
  const pending = invitation.status === "pending";
  const badge = INVITATION_STATUS_BADGE[invitation.status];

  return (
    <TableRow>
      <TableCell>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-fg">
            {invitation.email}
          </div>
          {invitation.invited_by ? (
            <div className="truncate text-xs text-fg/50">
              Invited by{" "}
              {`${invitation.invited_by.first_name} ${invitation.invited_by.last_name}`.trim()}
            </div>
          ) : null}
        </div>
      </TableCell>

      <TableCell className="text-sm text-fg/80">
        {invitation.role_id?.name ?? "—"}
      </TableCell>

      <TableCell>
        {/* Expired is shown, not stored: the row stays pending until resent. */}
        {pending && invitation.is_expired ? (
          <Badge variant="danger">Expired</Badge>
        ) : (
          <Badge variant={badge.variant}>{badge.label}</Badge>
        )}
      </TableCell>

      <TableCell className="text-sm text-fg/60">
        {invitation.expires_at && pending
          ? new Date(invitation.expires_at).toLocaleDateString("en-AU", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "—"}
      </TableCell>

      <TableCell className="text-right">
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={`Actions for ${invitation.email}`}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={invitation.status === "accepted"}
                onSelect={() => onResend(invitation)}
              >
                <Send className="h-3.5 w-3.5 text-fg/50" />
                {invitation.is_expired || !pending
                  ? "Send a new invite"
                  : "Resend invite"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                disabled={!pending}
                onSelect={() => onRevoke(invitation)}
              >
                <XCircle className="h-3.5 w-3.5" />
                Revoke invite
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
}
