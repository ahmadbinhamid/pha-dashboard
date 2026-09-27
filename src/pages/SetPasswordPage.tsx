import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { AuthCardLayout } from "@/components/auth/AuthCardLayout";
import { Button } from "@/components/ui/Button";
import { CardContent, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import Link from "@/components/ui/Link";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { INVITE_PASSWORD_MIN_LENGTH } from "@/config/access";
import { useToast } from "@/context";
import { useAuth } from "@/context/auth";
import { activateInvitation, getInvitationByToken } from "@/lib/api/access";
import { login } from "@/lib/api/auth";

// Invite landing: choose a first password, then straight into the dashboard.
export default function SetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setAuth } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState("");

  const preview = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => getInvitationByToken(token),
    enabled: !!token,
    retry: false,
  });
  const invite = preview.data?.data;

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await activateInvitation(token, password);
      return login({ email: data?.email ?? invite?.email ?? "", password });
    },
    onSuccess: (res) => {
      if (res.token && res.data && "_id" in res.data) {
        setAuth(res.data, res.token);
        navigate("/dashboard", { replace: true });
        return;
      }
      // 2FA or several organisations: the login page finishes the job.
      toast({
        title: "Password set",
        description: "Sign in to continue.",
        tone: "success",
      });
      navigate("/login", { replace: true });
    },
    onError: (err: Error) => setFormError(err.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (password.length < INVITE_PASSWORD_MIN_LENGTH)
      return setFormError(
        `Use at least ${INVITE_PASSWORD_MIN_LENGTH} characters.`,
      );
    if (password !== confirm) return setFormError("Passwords don't match.");
    mutation.mutate();
  }

  const organisation =
    invite?.organisation?.company_name ||
    invite?.organisation?.name ||
    "your team";

  if (!token || preview.isError) {
    return (
      <AuthCardLayout>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertTriangle className="h-6 w-6 text-warn" />
          <p className="text-sm font-semibold text-fg">
            This link has expired or was already used
          </p>
          <p className="text-xs text-fg/60">
            Ask your organisation's admin to resend your invite.
          </p>
          <Link
            href="/login"
            className="mt-2 text-xs font-medium text-accent hover:underline"
          >
            Go to sign in
          </Link>
        </CardContent>
      </AuthCardLayout>
    );
  }

  if (preview.isLoading || !invite) {
    return (
      <AuthCardLayout>
        <CardContent className="space-y-3 py-8">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </AuthCardLayout>
    );
  }

  // Links sent before this flow still use the old join page.
  if (!invite.needs_password)
    return (
      <Navigate to={`/invite?token=${encodeURIComponent(token)}`} replace />
    );

  return (
    <AuthCardLayout>
      <CardHeader
        title={`Welcome${invite.first_name ? `, ${invite.first_name}` : ""}`}
        description={`Set a password for ${invite.email} to join ${organisation}.`}
      />
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <FormField
            label="Password"
            htmlFor="password"
            required
            hint={`At least ${INVITE_PASSWORD_MIN_LENGTH} characters.`}
          >
            <PasswordInput
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={mutation.isPending}
              autoFocus
            />
          </FormField>
          <FormField
            label="Confirm password"
            htmlFor="confirm_password"
            required
          >
            <PasswordInput
              id="confirm_password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={mutation.isPending}
            />
          </FormField>

          {formError && (
            <p
              className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
              role="alert"
            >
              {formError}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Setting up…" : "Set password and sign in"}
          </Button>
        </form>
      </CardContent>
    </AuthCardLayout>
  );
}
