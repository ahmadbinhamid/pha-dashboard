import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";

import { setTwoFactor } from "@/lib/api/auth";
import { useAuth } from "@/context/auth";
import { useToast } from "@/context";

import { SettingsSection } from "@/components/settings/SettingsSection";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import type { AuthUser } from "@/types/auth";

export function SecuritySettingsCard({ user }: { user: AuthUser }) {
  const navigate = useNavigate();
  const { setAuth, token } = useAuth();
  const { toast } = useToast();

  const twoFactorMutation = useMutation({
    mutationFn: setTwoFactor,
    onSuccess: (res) => {
      if (res.data && token) setAuth(res.data, token);
      toast({
        title: res.data?.two_factor_enabled
          ? "Two-factor authentication enabled"
          : "Two-factor authentication disabled",
        tone: "success",
      });
    },
    onError: (err: Error) =>
      toast({ title: "Couldn't update two-factor authentication", description: err.message, tone: "danger" }),
  });

  return (
    <SettingsSection title="Security Settings" description="Manage your password and account security.">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-bg-2/40 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg">Password</p>
            <p className="mt-0.5 text-xs text-fg/55">Change your password to keep your account secure.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/profile?section=password")}>
            Change Password
          </Button>
        </div>

        <Switch
          checked={user.two_factor_enabled}
          onCheckedChange={(checked) => twoFactorMutation.mutate({ enabled: checked })}
          loading={twoFactorMutation.isPending}
          label="Two Factor Authentication"
          description="Enable two-factor authentication to add an extra layer of security to your account."
        />
      </div>
    </SettingsSection>
  );
}
