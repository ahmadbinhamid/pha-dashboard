import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";

import { registerTenant } from "@/lib/api/auth";
import { useAuth } from "@/context/auth";

import { ArrowRight } from "lucide-react";
import { AppLogoMark, APP_NAME } from "@/components/branding/AppLogoMark";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import Link from "@/components/ui/Link";

export function RegisterCard() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const registerMutation = useMutation({
    mutationFn: registerTenant,
    // Active immediately — a brand-new tenant has no other admin to approve
    // this account, so signup logs straight in, same as login's onSuccess.
    onSuccess: (res) => {
      if (!res.token || !res.data) {
        setErrorMsg("Unexpected server response. Please try again.");
        return;
      }
      setAuth(res.data, res.token);
      navigate("/dashboard", { replace: true });
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const isLoading = registerMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    registerMutation.mutate({
      company_name: companyName.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
      password,
    });
  };

  return (
    <div className="w-full max-w-105">
      <div className="mb-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <AppLogoMark className="h-20 w-20 shadow-soft ring-1 ring-inset ring-[hsl(var(--accent)/0.28)]" />
        <div className="text-left">
          <div className="text-sm font-semibold tracking-tight">{APP_NAME}</div>
          <div className="text-xs text-fg/60">Inventory &amp; Listings</div>
        </div>
      </div>

      <Card className="overflow-hidden bg-bg/80 backdrop-blur supports-backdrop-filter:bg-bg/65">
        <CardHeader
          title="Create your account"
          description="Set up your own workspace — you'll be its first admin."
        />
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-fg/75" htmlFor="company_name">
                Company name
              </label>
              <Input
                id="company_name"
                type="text"
                placeholder="Acme Auto Parts"
                autoComplete="organization"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-fg/75" htmlFor="first_name">
                  First name
                </label>
                <Input
                  id="first_name"
                  type="text"
                  placeholder="Jane"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-fg/75" htmlFor="last_name">
                  Last name
                </label>
                <Input
                  id="last_name"
                  type="text"
                  placeholder="Doe"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-fg/75" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@partshub.com.au"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-fg/75" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={isLoading}
              />
            </div>

            {errorMsg && (
              <p className="rounded-lg border border-[hsl(var(--danger)/0.3)] bg-[hsl(var(--danger)/0.08)] px-3 py-2 text-xs text-[hsl(var(--danger))]">
                {errorMsg}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account…" : "Create account"}
              <span className="ml-2 opacity-80">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Button>

            <div className="pt-2 text-center text-xs text-fg/55">
              Already have an account?{" "}
              <Link href="/login" className="text-accent hover:underline">
                Sign in
              </Link>
            </div>

            <div className="text-center text-xs text-fg/55">
              By continuing you agree to the{" "}
              <Link href="#" className="text-fg/70 hover:underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="#" className="text-fg/70 hover:underline">
                Privacy Policy
              </Link>
              .
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
