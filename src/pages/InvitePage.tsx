import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, MailX, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { useAuth, useToast } from "@/context";
import { acceptInvitation, declineInvitation, getInvitationByToken, registerFromInvitation } from "@/lib/api/access";
import { setToken } from "@/lib/api/client";

/**
 * Where an invite link lands. Public — the token IS the credential, and the
 * address it was sent to comes back from the API so this page can prefill
 * either path:
 *
 *   no account yet  -> sign up here, which joins the organisation in one step
 *   has an account  -> sign in as that address, then accept
 */
export default function InvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => getInvitationByToken(token),
    enabled: Boolean(token),
    retry: false,
  });

  const invite = data?.data;

  const registerMutation = useMutation({
    mutationFn: () => registerFromInvitation(token, { first_name: firstName, last_name: lastName, password }),
    onSuccess: (res) => {
      // The API signs them in as part of joining, so there's no second step.
      if (res.data?.token) setToken(res.data.token);
      toast({ title: `Welcome to ${orgName}`, tone: "success" });
      navigate("/dashboard");
    },
    onError: (err: Error) => setError(err.message || "Couldn't create your account"),
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptInvitation(token),
    onSuccess: () => {
      toast({ title: `You've joined ${orgName}`, tone: "success" });
      navigate("/dashboard");
    },
    onError: (err: Error) => setError(err.message || "Couldn't accept this invitation"),
  });

  const declineMutation = useMutation({
    mutationFn: () => declineInvitation(token),
    onSuccess: () => {
      toast({ title: "Invitation declined", tone: "default" });
      navigate("/login");
    },
    onError: (err: Error) => setError(err.message || "Couldn't decline this invitation"),
  });

  const orgName = invite?.organisation?.company_name || invite?.organisation?.name || "the organisation";

  /**
   * Send them to sign in, and bring them back here afterwards. /login sits
   * behind GuestRoute, which redirects anyone already authenticated to the
   * dashboard — so when this is a "wrong account" switch, the current session
   * has to end first or the button silently lands them back in the app as
   * themselves. LoginCard reads `state.from.pathname` for where to return.
   */
  const goSignIn = ({ switchAccount }: { switchAccount: boolean }) => {
    if (switchAccount) logout();
    navigate("/login", {
      replace: true,
      state: { from: { pathname: `/invite?token=${encodeURIComponent(token)}` } },
    });
  };

  if (!token || isError || (!isLoading && !invite)) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-fg/40">
            <MailX className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-fg">This invitation link isn't valid</h1>
            <p className="mt-1 text-sm text-fg/60">
              It may have already been used, been revoked, or expired. Ask whoever invited you to send a new one.
            </p>
          </div>
          <Button variant="secondary" onClick={() => navigate("/login")}>
            Go to sign in
          </Button>
        </div>
      </Shell>
    );
  }

  if (isLoading || !invite) {
    return (
      <Shell>
        <div className="space-y-4">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Shell>
    );
  }

  // Signed in as someone else — the link is bound to one address, so the only
  // honest options are to switch accounts or walk away.
  const signedInAsOther = user && user.email?.toLowerCase() !== invite.email.toLowerCase();

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <Building2 className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-fg">You've been invited to {orgName}</h1>
            <p className="mt-1 text-sm text-fg/60">
              {invite.invited_by ? `${invite.invited_by.name} invited ` : "Invitation sent to "}
              <span className="font-medium text-fg/80">{invite.email}</span>
              {invite.role?.name ? " to join as " : ""}
              {invite.role?.name ? <Badge variant="muted" className="gap-1"><ShieldCheck className="h-3 w-3" />{invite.role.name}</Badge> : null}
            </p>
          </div>
        </div>

        {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-center text-sm text-danger">{error}</p> : null}

        {signedInAsOther ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-fg/60">
              You're signed in as <span className="font-medium text-fg/80">{user?.email}</span>, but this invitation is for{" "}
              <span className="font-medium text-fg/80">{invite.email}</span>.
            </p>
            <Button variant="secondary" className="w-full" onClick={() => goSignIn({ switchAccount: true })}>
              Sign out and sign in as {invite.email}
            </Button>
          </div>
        ) : invite.has_account ? (
          <div className="space-y-3">
            {user ? (
              <Button
                variant="primary"
                className="w-full"
                disabled={acceptMutation.isPending}
                onClick={() => acceptMutation.mutate()}
              >
                <CheckCircle2 className="h-4 w-4" />
                {acceptMutation.isPending ? "Joining…" : `Join ${orgName}`}
              </Button>
            ) : (
              <Button variant="primary" className="w-full" onClick={() => goSignIn({ switchAccount: false })}>
                Sign in to accept
              </Button>
            )}
            <Button
              variant="ghost"
              className="w-full"
              disabled={declineMutation.isPending || !user}
              onClick={() => declineMutation.mutate()}
            >
              Decline invitation
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              registerMutation.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField label="First name" required>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
              </FormField>
              <FormField label="Last name" required>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </FormField>
            </div>

            <FormField label="Email">
              {/* Fixed: the link is bound to this address. */}
              <Input value={invite.email} readOnly disabled />
            </FormField>

            <FormField label="Create a password" required hint="At least 6 characters.">
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
            </FormField>

            <Button type="submit" variant="primary" className="w-full" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? "Creating your account…" : `Join ${orgName}`}
            </Button>
          </form>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <Card className="w-full max-w-md p-6 sm:p-8">{children}</Card>
    </div>
  );
}
