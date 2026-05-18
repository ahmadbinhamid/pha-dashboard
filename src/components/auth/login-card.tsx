"use client";

import Link from "next/link";
import { useState } from "react";
import { PartsHubLogoImage } from "@/components/branding/parts-hub-logo-image";
import { Icons } from "@/components/ui/icons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useOrgSettings } from "@/components/settings/org-settings-provider";

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
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const { settings } = useOrgSettings();

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <div className="rounded-2xl bg-black p-2 ring-1 ring-inset ring-[hsl(var(--accent)/0.28)] shadow-soft">
          <PartsHubLogoImage sizeClass="h-20" maxWidthClass="max-w-20" priority />
        </div>
        <div className="text-left">
          <div className="text-sm font-semibold tracking-tight">{settings.storeName}</div>
          <div className="text-xs text-fg/60">Inventory & Listings</div>
        </div>
      </div>

      <Card className="overflow-hidden bg-bg/80 backdrop-blur supports-[backdrop-filter]:bg-bg/65">
        <CardHeader
          title="Sign in"
          description="Use your work email to access inventory, orders, and analytics."
        />
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-fg/75" htmlFor="email">
              Email
            </label>
            <Input id="email" type="email" placeholder="you@partshub.com.au" autoComplete="email" />
          </div>

          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs font-semibold text-fg/75" htmlFor="password">
              Password
              <Link href="#" className="text-xs font-medium text-accent hover:underline">
                Forgot password?
              </Link>
            </label>
            <Input id="password" type="password" placeholder="••••••••••" autoComplete="current-password" />
          </div>

          <div className="flex items-center justify-between">
            <Checkbox checked={remember} onChange={setRemember} label="Remember me" />
            <span className="text-xs text-fg/55">SSO ready</span>
          </div>

          <Button
            className="w-full"
            onClick={() => {
              setLoading(true);
              window.setTimeout(() => {
                window.location.href = "/dashboard";
              }, 650);
            }}
            disabled={loading}
          >
            {loading ? "Signing in…" : "Continue"}
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
        </CardContent>
      </Card>
    </div>
  );
}

