import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, MailCheck } from "lucide-react";
import { forgotPassword } from "@/lib/api/auth";
import { AppLogoMark, APP_NAME } from "@/components/branding/AppLogoMark";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import Link from "@/components/ui/Link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");

  const mutation = useMutation({
    mutationFn: forgotPassword,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(email.trim().toLowerCase());
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="w-full max-w-105">
        <div className="mb-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <AppLogoMark className="h-20 w-20 shadow-soft ring-1 ring-inset ring-[hsl(var(--accent)/0.28)]" />
          <div className="text-left">
            <div className="text-sm font-semibold tracking-tight">{APP_NAME}</div>
            <div className="text-xs text-fg/60">Inventory &amp; Listings</div>
          </div>
        </div>

        <Card className="overflow-hidden bg-bg/80 backdrop-blur supports-backdrop-filter:bg-bg/65">
          {mutation.isSuccess ? (
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                <MailCheck className="h-5 w-5 text-accent" />
              </span>
              <div>
                <p className="text-sm font-semibold text-fg">Check your email</p>
                <p className="mt-1 text-xs text-fg/60">
                  If an account exists for <span className="font-medium text-fg/80">{email}</span>, we've sent a
                  link to reset your password.
                </p>
              </div>
              <Link href="/login" className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </Link>
            </CardContent>
          ) : (
            <>
              <CardHeader title="Forgot password" description="Enter your email and we'll send you a link to reset your password." />
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <FormField label="Email" htmlFor="email" required>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@partshub.com.au"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={mutation.isPending}
                    />
                  </FormField>

                  {mutation.isError && (
                    <p className="rounded-lg border border-[hsl(var(--danger)/0.3)] bg-[hsl(var(--danger)/0.08)] px-3 py-2 text-xs text-[hsl(var(--danger))]">
                      {(mutation.error as Error).message}
                    </p>
                  )}

                  <Button type="submit" className="w-full" disabled={mutation.isPending}>
                    {mutation.isPending ? "Sending…" : "Send reset link"}
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
