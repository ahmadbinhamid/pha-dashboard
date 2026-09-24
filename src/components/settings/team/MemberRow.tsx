import { MoreHorizontal, ShieldCheck, UserMinus, UserCog, Ban, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { TableRow, TableCell } from "@/components/ui/Table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/ActionsMenu";
import { cn } from "@/utils/cn";
import { SYSTEM_ROLE_SUPER_ADMIN } from "@/config/access";
import type { Member } from "@/types/access";

// Initials avatar, same fallback shape as TenantLogo's no-logo state.
function Initials({ first, last }: { first: string; last: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-2xs font-bold text-accent">
      {`${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?"}
    </span>
  );
}

function relativeTime(iso: string | null) {
  if (!iso) return "Never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function MemberRow({
  member,
  isSelf,
  onChangeRole,
  onToggleSuspended,
  onRemove,
}: {
  member: Member;
  /** Nobody edits their own access from this screen. */
  isSelf: boolean;
  onChangeRole: (member: Member) => void;
  onToggleSuspended: (member: Member) => void;
  onRemove: (member: Member) => void;
}) {
  const user = member.user_id;
  const suspended = member.status === "suspended";
  // Super Admin is also protected server-side; the menu omits refused actions.
  const isSuperAdmin = member.role_id?.name === SYSTEM_ROLE_SUPER_ADMIN;
  const locked = isSelf || isSuperAdmin;

  return (
    <TableRow className={cn(suspended && "opacity-60")}>
      <TableCell>
        <div className="flex items-center gap-3">
          <Initials first={user?.first_name ?? ""} last={user?.last_name ?? ""} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-fg">
                {`${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || user?.email}
              </span>
              {isSelf ? <span className="text-3xs font-semibold uppercase text-fg/40">You</span> : null}
            </div>
            <div className="truncate text-xs text-fg/50">{user?.email}</div>
          </div>
        </div>
      </TableCell>

      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-sm text-fg/80">
          {isSuperAdmin ? <ShieldCheck className="h-3.5 w-3.5 text-accent" /> : null}
          {member.role_id?.name ?? "—"}
        </span>
      </TableCell>

      <TableCell>
        <Badge variant={suspended ? "muted" : "ok"}>{suspended ? "Suspended" : "Active"}</Badge>
      </TableCell>

      <TableCell className="text-sm text-fg/60">{relativeTime(member.last_active_at)}</TableCell>

      <TableCell className="text-sm text-fg/60">
        {new Date(member.joined_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
      </TableCell>

      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={`Actions for ${user?.email}`}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={locked} onSelect={() => onChangeRole(member)}>
              <UserCog className="h-3.5 w-3.5 text-fg/50" />
              Change role
            </DropdownMenuItem>
            <DropdownMenuItem disabled={locked} onSelect={() => onToggleSuspended(member)}>
              {suspended ? <Undo2 className="h-3.5 w-3.5 text-fg/50" /> : <Ban className="h-3.5 w-3.5 text-fg/50" />}
              {suspended ? "Restore access" : "Suspend access"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive disabled={locked} onSelect={() => onRemove(member)}>
              <UserMinus className="h-3.5 w-3.5" />
              Remove from organisation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
