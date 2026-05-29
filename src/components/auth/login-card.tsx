import { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";

import { login, verifyOtp, resendOtp } from "@/lib/api/auth";
import { useAuth } from "@/context/auth";
import { useOrgSettings } from "@/context";

import { PartsHubLogoImage } from "@/components/branding/parts-hub-logo-image";
import { Icons } from "@/components/ui/icons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { cn } from "@/utils/cn";

type Step = "credentials" | "otp";

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-fg/75">
      <span
        className={cn(
          "grid h-4 w-4 place-items-center rounded border border-border bg-bg shadow-sm",
          checked ? "border-accent bg-accent text-accent-fg" : "",
        )}
        aria-hidden="true"
      >
        {checked ? (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
            <path
              d="M20 6 9 17l-5-5"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function LoginCard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuth();
  const { settings } = useOrgSettings();

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
    onSuccess: () => {
      setErrorMsg("");
      setStep("otp");
      startCooldown();
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
    <div className="w-full max-w-105">
      <div className="mb-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <div className="rounded-2xl bg-black p-2 ring-1 ring-inset ring-[hsl(var(--accent)/0.28)] shadow-soft">
          <PartsHubLogoImage
            sizeClass="h-20"
            maxWidthClass="max-w-20"
            priority
          />
        </div>
        <div className="text-left">
          <div className="text-sm font-semibold tracking-tight">
            {settings.storeName}
          </div>
          <div className="text-xs text-fg/60">Inventory &amp; Listings</div>
        </div>
      </div>

      <Card className="overflow-hidden bg-bg/80 backdrop-blur supports-backdrop-filter:bg-bg/65">
        {step === "credentials" && (
          <>
            <CardHeader
              title="Sign in"
              description="Use your work email to access inventory, orders, and analytics."
            />
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label
                    className="text-xs font-semibold text-fg/75"
                    htmlFor="email"
                  >
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
                      href="#"
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoadingLogin}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Checkbox
                    checked={remember}
                    onChange={setRemember}
                    label="Remember me"
                  />
                  <span className="text-xs text-fg/55">SSO ready</span>
                </div>

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
                  {isLoadingLogin ? "Signing in…" : "Continue"}
                  <span className="ml-2 opacity-80">
                    <Icons.ArrowRight />
                  </span>
                </Button>

                <div className="pt-2 text-center text-xs text-fg/55">
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
          </>
        )}

        {step === "otp" && (
          <>
            <CardHeader
              title="Check your email"
              description={`We sent a 6-digit code to ${email}. Enter it below to complete sign in.`}
            />
            <CardContent>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <label
                    className="text-xs font-semibold text-fg/75"
                    htmlFor="otp"
                  >
                    Verification code
                  </label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    placeholder="000000"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    required
                    disabled={isLoadingVerify}
                    className="text-center tracking-[0.4em] text-lg font-semibold"
                  />
                </div>

                {errorMsg && (
                  <p className="rounded-lg border border-[hsl(var(--danger)/0.3)] bg-[hsl(var(--danger)/0.08)] px-3 py-2 text-xs text-[hsl(var(--danger))]">
                    {errorMsg}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoadingVerify || otp.length < 6}
                >
                  {isLoadingVerify ? "Verifying…" : "Verify & Sign in"}
                  <span className="ml-2 opacity-80">
                    <Icons.ArrowRight />
                  </span>
                </Button>

                <div className="flex items-center justify-between pt-1 text-xs text-fg/55">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="hover:text-fg transition-colors"
                  >
                    ← Back
                  </button>

                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || isLoadingResend}
                    className={cn(
                      "transition-colors",
                      resendCooldown > 0 || isLoadingResend
                        ? "cursor-not-allowed opacity-40"
                        : "text-accent hover:underline",
                    )}
                  >
                    {isLoadingResend
                      ? "Sending…"
                      : resendCooldown > 0
                        ? `Resend in ${resendCooldown}s`
                        : "Resend code"}
                  </button>
                </div>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
