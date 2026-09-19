import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/ActionsMenu";
import { useAuth } from "@/context/auth";
import { ACCOUNT_ROLE_LABEL } from "@/config/access";
import { personInitials } from "@/utils/initials";
import { ChevronsUpDown, LogOut, User } from "lucide-react";

// One account panel, two triggers. "compact" (Topbar, right-most) is just the
// avatar; "full" (a sidebar footer) adds name + role and a chevron. Both open
// the SAME menu: identity, then Profile and Logout. Settings and Activity Log
// are not repeated here — the Topbar has its own Settings button and both are
// in the sidebar nav.
// Theme is deliberately NOT here — the Topbar's ThemeToggle is the one place
// to switch it, rather than two controls holding the same state.
//
// The panel aligns to whichever edge of the trigger has room: a sidebar
// trigger opens rightward from its start edge, the Topbar avatar sits against
// the window's right edge so it opens leftward from its end edge.
export function UserMenu({ variant = "compact" }: { variant?: "compact" | "full" }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const fullName = `${user.first_name} ${user.last_name}`.trim();
  const avatar = (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fg text-[10px] font-semibold text-bg">
      {personInitials(user.first_name, user.last_name)}
    </span>
  );

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const trigger =
    variant === "compact" ? (
      <button
        type="button"
        className="h-8 w-8 shrink-0 rounded-full transition hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        aria-label="Open account menu"
        title={fullName || "Account"}
      >
        {avatar}
      </button>
    ) : (
      <button
        type="button"
        className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-muted/60"
      >
        {avatar}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold leading-tight text-fg">{fullName || "Account"}</div>
          <div className="truncate text-[11px] text-fg/50">{ACCOUNT_ROLE_LABEL[user.role] ?? user.role}</div>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-fg/35" />
      </button>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>

      {/* Width is fixed so the panel reads the same from either trigger: it
          matches the sidebar footer's inset when opened there, and stays
          clear of the window edge when opened from the Topbar avatar. */}
      <DropdownMenuContent align={variant === "compact" ? "end" : "start"} className="w-61 p-0">
        <div className="px-3 py-2.5">
          <div className="truncate text-[13px] font-semibold text-fg">{fullName || "Account"}</div>
          <div className="truncate text-xs text-fg/50">{user.email}</div>
        </div>

        <DropdownMenuSeparator className="mx-0" />

        <div className="p-1">
          {/* Kept because the Topbar avatar used to BE a link to /profile —
              turning it into a menu trigger would otherwise have removed the
              only one-click route to the profile page. */}
          <DropdownMenuItem className="px-2 py-1.5 text-xs" onSelect={() => navigate("/profile")}>
            <User className="h-3.5 w-3.5" />
            Profile
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator className="mx-0" />

        <div className="p-1">
          <DropdownMenuItem className="px-2 py-1.5 text-xs" destructive onSelect={handleLogout}>
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
