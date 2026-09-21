import { useState } from "react";
import { Check, Copy, MoreHorizontal, Send, XCircle } from "lucide-react";
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

/**
 * `link` only exists on an invitation this session just sent or resent — the
 * server stores the token hashed, so there is nothing to recover it from
 * afterwards. Copy is therefore offered only while we still hold it; resend
 * mints a new link.
 */
export function InvitationRow({
  invitation,
  link,
  onResend,
  onRevoke,
}: {
  invitation: Invitation;
  link?: string;
  onResend: (invitation: Invitation) => void;
  onRevoke: (invitation: Invitation) => void;
}) {
  const [copied, setCopied] = useState(false);
  const pending = invitation.status === "pending";
  const badge = INVITATION_STATUS_BADGE[invitation.status];

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <TableRow>
      <TableCell>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-fg">{invitation.email}</div>
          {invitation.invited_by ? (
            <div className="truncate text-xs text-fg/50">
              Invited by {`${invitation.invited_by.first_name} ${invitation.invited_by.last_name}`.trim()}
            </div>
          ) : null}
        </div>
      </TableCell>

      <TableCell className="text-sm text-fg/80">{invitation.role_id?.name ?? "—"}</TableCell>

      <TableCell>
        {/* Expiry isn't a status: a pending invite past its date is still
            pending server-side, but its link is dead until it's resent. */}
        {pending && invitation.is_expired ? <Badge variant="danger">Expired</Badge> : <Badge variant={badge.variant}>{badge.label}</Badge>}
      </TableCell>

      <TableCell className="text-sm text-fg/60">
        {invitation.expires_at && pending
          ? new Date(invitation.expires_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
          : "—"}
      </TableCell>

      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={`Actions for ${invitation.email}`}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={invitation.status === "accepted"} onSelect={() => onResend(invitation)}>
              <Send className="h-3.5 w-3.5 text-fg/50" />
              {invitation.is_expired || !pending ? "Send a new invite" : "Resend invite"}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!link} onSelect={(e) => { e.preventDefault(); void copy(); }}>
              {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5 text-fg/50" />}
              {copied ? "Link copied" : link ? "Copy invite link" : "Link available on resend"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive disabled={!pending} onSelect={() => onRevoke(invitation)}>
              <XCircle className="h-3.5 w-3.5" />
              Revoke invite
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
