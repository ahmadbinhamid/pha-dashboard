import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ACCOUNT_ROLE_LABEL } from "@/config/access";
import { personInitials } from "@/utils/initials";
import type { AuthUser } from "@/types/auth";

function formatJoined(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}

// Who you're signed in as, at the top of the Profile page. Read-only on
// purpose: role, verification and join date are all server-owned, so showing
// them beside the editable fields is what makes clear which parts of this page
// the account holder can actually change.
export function ProfileIdentityCard({ user }: { user: AuthUser }) {
  const fullName = `${user.first_name} ${user.last_name}`.trim();
  const joined = formatJoined(user.created_at);

  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
      <span
        className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-accent text-lg font-semibold text-accent-fg"
        aria-hidden
      >
        {personInitials(user.first_name, user.last_name)}
      </span>

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold tracking-tight text-fg">{fullName || "Your account"}</h2>
        <p className="mt-0.5 truncate text-sm text-fg/55">{user.email}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{ACCOUNT_ROLE_LABEL[user.role] ?? user.role}</Badge>
          <Badge variant={user.verified_at ? "ok" : "warn"}>{user.verified_at ? "Verified" : "Unverified"}</Badge>
          {joined ? <span className="text-xs text-fg/45">Member since {joined}</span> : null}
        </div>
      </div>
    </Card>
  );
}
