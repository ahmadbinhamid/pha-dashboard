import { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";

import { login, verifyOtp, resendOtp } from "@/lib/api/auth";
import { useAuth } from "@/context/auth";

import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import Link from "@/components/ui/Link";
import { LoginCheckbox } from "@/components/auth/LoginCheckbox";

type Step = "credentials" | "otp";

export function LoginCard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuth();

  const redirectTo =
    (location.state as { from?: { pathname: string } } | null)?.from
      ?.pathname ?? "/dashboard";

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [remember, setRemember] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = () => {
    setResendCooldown(30);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const loginMutation = useMutation({
    mutationFn: login,
    // OTP DISABLED — authenticate directly on login success
    onSuccess: (res) => {
      if (!res.token || !res.data) {
        setErrorMsg("Unexpected server response. Please try again.");
        return;
      }
      setAuth(res.data, res.token);
      navigate(redirectTo, { replace: true });
      // OTP flow (re-enable when OTP is back):
      // setErrorMsg("");
      // setStep("otp");
      // startCooldown();
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const verifyMutation = useMutation({
    mutationFn: verifyOtp,
    onSuccess: (res) => {
      if (!res.token || !res.data) {
        setErrorMsg("Unexpected server response. Please try again.");
        return;
      }
      setAuth(res.data, res.token);
      navigate(redirectTo, { replace: true });
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const resendMutation = useMutation({
    mutationFn: resendOtp,
    onSuccess: () => {
      setErrorMsg("");
      startCooldown();
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    loginMutation.mutate({ email: email.trim().toLowerCase(), password });
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    verifyMutation.mutate({ email, otp: otp.trim() });
  };

  const handleResend = () => {
    if (resendCooldown > 0) return;
    resendMutation.mutate(email);
  };

  const handleBack = () => {
    setStep("credentials");
    setOtp("");
    setErrorMsg("");
    loginMutation.reset();
    verifyMutation.reset();
  };

  const isLoadingLogin = loginMutation.isPending;
  const isLoadingVerify = verifyMutation.isPending;
  const isLoadingResend = resendMutation.isPending;

  return (
    <div className="w-full lg:max-w-105">
      {/* Below `lg`, LoginPage renders this as a full-bleed sheet pulled up
          over its own compact brand header: rounded top only, no border/
          shadow, so it reads as one continuous surface rather than a card
          floating inside another container. At `lg` and up it's the usual
          floating card (rounded all around, bordered, shadowed) — see
          LoginPage for the header this pairs with on each breakpoint. */}
      <Card className="overflow-hidden rounded-b-none rounded-t-3xl border-0 shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.15)] lg:rounded-2xl lg:border lg:border-border lg:shadow-card">
        {step === "credentials" && (
          <>
            {/* A bespoke header instead of the shared CardHeader — that one's
                built for compact in-app panels (small title, divider
                underneath); a sign-in form reads better as a proper page
                headline: bigger, bolder, no divider line crowding it. */}
            <div className="px-6 pb-2 pt-8 lg:pt-6">
              <h1 className="text-3xl font-extrabold tracking-tight text-fg lg:text-[2rem]">
                Welcome back
              </h1>
              <p className="mt-2 text-base text-fg/60">
                Sign in to manage inventory, orders and analytics.
              </p>
            </div>
            <CardContent className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-6 lg:pb-6">
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <label
                    className="text-xs font-semibold text-fg/75"
                    htmlFor="email"
                  >
                    Work email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@partshub.com.au"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoadingLogin}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="flex items-center justify-between text-xs font-semibold text-fg/75"
                    htmlFor="password"
                  >
                    Password
                    <Link
                      href="/auth/forgot-password"
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </label>
                  <PasswordInput
                    id="password"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoadingLogin}
                  />
                </div>

                <LoginCheckbox
                  checked={remember}
                  onChange={setRemember}
                  label="Keep me signed in on this device"
                />

                {errorMsg && (
                  <p className="rounded-lg border border-[hsl(var(--danger)/0.3)] bg-[hsl(var(--danger)/0.08)] px-3 py-2 text-xs text-[hsl(var(--danger))]">
                    {errorMsg}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoadingLogin}
                >
                  {isLoadingLogin ? "Signing in…" : "Sign in"}
                  <span className="ml-2 opacity-80">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Button>

                {/* Public signup is disabled — see App.tsx's commented-out
                    /register route for why. Nothing routes here today, so
                    this link isn't shown. SSO is likewise skipped: there's
                    no SSO backend behind this app, so a "Continue with
                    company SSO" button (seen in the reference design) would
                    be decorative rather than functional. */}

                <div className="text-center text-xs text-fg/55">
                  By signing in you agree to the{" "}
                  <Link href="#" className="text-fg/70 underline hover:text-fg">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="#" className="text-fg/70 underline hover:text-fg">
                    Privacy Policy
                  </Link>
                  .
                </div>
              </form>
            </CardContent>
          </>
        )}

        {/* OTP DISABLED — OTP step hidden, login goes straight to dashboard
        {step === "otp" && (
          <>
            <CardHeader
              title="Check your email"
              description={`We sent a 6-digit code to ${email}. Enter it below to complete sign in.`}
            />
            <CardContent>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-fg/75" htmlFor="otp">
                    Verification code
                  </label>
                  <Input
                    id="otp" type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
                    placeholder="000000" autoComplete="one-time-code" value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    required disabled={isLoadingVerify}
                    className="text-center tracking-[0.4em] text-lg font-semibold"
                  />
                </div>
                {errorMsg && (
                  <p className="rounded-lg border border-[hsl(var(--danger)/0.3)] bg-[hsl(var(--danger)/0.08)] px-3 py-2 text-xs text-[hsl(var(--danger))]">
                    {errorMsg}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={isLoadingVerify || otp.length < 6}>
                  {isLoadingVerify ? "Verifying…" : "Verify & Sign in"}
                  <span className="ml-2 opacity-80"><Icons.ArrowRight /></span>
                </Button>
                <div className="flex items-center justify-between pt-1 text-xs text-fg/55">
                  <button type="button" onClick={handleBack} className="hover:text-fg transition-colors">← Back</button>
                  <button type="button" onClick={handleResend} disabled={resendCooldown > 0 || isLoadingResend}
                    className={cn("transition-colors", resendCooldown > 0 || isLoadingResend ? "cursor-not-allowed opacity-40" : "text-accent hover:underline")}>
                    {isLoadingResend ? "Sending…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>
                </div>
              </form>
            </CardContent>
          </>
        )}
        */}
      </Card>
    </div>
  );
}
