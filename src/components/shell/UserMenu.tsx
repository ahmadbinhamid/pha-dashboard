import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/ActionsMenu";
import { useAuth } from "@/context/auth";
import { useThemePreference, type ThemePreference } from "@/hooks";
import { ACCOUNT_ROLE_LABEL } from "@/config/access";
import { personInitials } from "@/utils/initials";
import { cn } from "@/utils/cn";
import { ChevronsUpDown, LogOut, Moon, Settings, Sun, User } from "lucide-react";

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

// One account panel, two triggers. "compact" (Topbar, right-most) is just the
// avatar; "full" (a sidebar footer) adds name + role and a chevron. Both open
// the SAME menu, in this order: identity, the Light/Dark theme control
// (shares state with any other place reading useThemePreference — an
// external store, so flipping the theme from either place updates both
// instantly), then Profile and Settings, then Logout. Theme sits above the
// navigation links since it's a toggle acted on in place rather than
// somewhere the menu sends you. Settings and theme used to be their own
// standalone Topbar icons — moved in here so the header's icon row is just
// Search / Create Order / Notifications, with everything account-related
// behind one avatar.
//
// The panel aligns to whichever edge of the trigger has room: a sidebar
// trigger opens rightward from its start edge, the Topbar avatar sits against
// the window's right edge so it opens leftward from its end edge.
export function UserMenu({ variant = "compact" }: { variant?: "compact" | "full" }) {
  const { user, logout } = useAuth();
  const { preference, setTheme } = useThemePreference();
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

        <div className="px-3 py-2.5">
          <span className="text-xs text-fg/55">Theme</span>
          <div className="mt-2 grid grid-cols-2 gap-1">
            {THEME_OPTIONS.map((opt) => {
              const active = preference === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setTheme(opt.value);
                  }}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    active ? "bg-accent/10 text-accent" : "text-fg/60 hover:bg-muted/60",
                  )}
                >
                  <opt.icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>
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
          <DropdownMenuItem className="px-2 py-1.5 text-xs" onSelect={() => navigate("/settings")}>
            <Settings className="h-3.5 w-3.5" />
            Settings
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
