import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/ActionsMenu";
import { useAuth } from "@/context/auth";
import { LogOut } from "lucide-react";

function initials(firstName: string, lastName: string) {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return (a + b || a || "PH").toUpperCase();
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const fullName = `${user.first_name} ${user.last_name}`.trim();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="h-9 w-9 shrink-0 rounded-full ring-1 ring-border/60 hover:ring-border">
        <span className="grid h-full w-full place-items-center rounded-full bg-bg text-[11px] font-semibold text-fg">
          {initials(user.first_name, user.last_name)}
        </span>
        <span className="sr-only">Account menu</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <div className="px-3 py-2.5">
          <div className="truncate text-sm font-semibold text-fg">{fullName || "Account"}</div>
          <div className="truncate text-xs text-fg/50">{user.email}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={handleLogout}>
          <LogOut className="h-3.5 w-3.5" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
