import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { resetPassword } from "@/lib/api/auth";
import { AppLogoMark } from "@/components/branding/AppLogoMark";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import Link from "@/components/ui/Link";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");

  const mutation = useMutation({
    mutationFn: resetPassword,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError("");

    if (newPassword.length < 6) {
      setValidationError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setValidationError("Passwords don't match.");
      return;
    }

    mutation.mutate({ token, new_password: newPassword });
  }

  const errorMsg = validationError || (mutation.isError ? (mutation.error as Error).message : "");

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="w-full max-w-105">
        <div className="mb-6 flex flex-col items-center justify-center gap-2">
          {/* The lockup already spells out the app name — no separate text label
              beside it, or the name would show up twice. */}
          <AppLogoMark className="h-12" />
          <div className="text-xs text-fg/60">Inventory &amp; Listings</div>
        </div>

        <Card className="overflow-hidden bg-bg/80 backdrop-blur supports-backdrop-filter:bg-bg/65">
          {!token ? (
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm font-semibold text-fg">Invalid reset link</p>
              <p className="text-xs text-fg/60">This password reset link is missing or malformed.</p>
              <Link href="/auth/forgot-password" className="mt-2 text-xs font-medium text-accent hover:underline">
                Request a new link
              </Link>
            </CardContent>
          ) : mutation.isSuccess ? (
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                <CheckCircle2 className="h-5 w-5 text-accent" />
              </span>
              <div>
                <p className="text-sm font-semibold text-fg">Password reset</p>
                <p className="mt-1 text-xs text-fg/60">You can now sign in with your new password.</p>
              </div>
              <Link href="/login" className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </Link>
            </CardContent>
          ) : (
            <>
              <CardHeader title="Reset password" description="Choose a new password for your account." />
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <FormField label="New password" htmlFor="new_password" required>
                    <PasswordInput
                      id="new_password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      disabled={mutation.isPending}
                    />
                  </FormField>
                  <FormField label="Confirm new password" htmlFor="confirm_password" required>
                    <PasswordInput
                      id="confirm_password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      disabled={mutation.isPending}
                    />
                  </FormField>

                  {errorMsg && (
                    <p className="rounded-lg border border-[hsl(var(--danger)/0.3)] bg-[hsl(var(--danger)/0.08)] px-3 py-2 text-xs text-[hsl(var(--danger))]">
                      {errorMsg}
                    </p>
                  )}

                  <Button type="submit" className="w-full" disabled={mutation.isPending}>
                    {mutation.isPending ? "Resetting…" : "Reset password"}
                  </Button>

                  <div className="text-center text-xs text-fg/55">
                    <Link href="/login" className="inline-flex items-center gap-1.5 text-accent hover:underline">
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back to sign in
                    </Link>
                  </div>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
