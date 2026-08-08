import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { User, KeyRound, Eye, EyeOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useAuth } from "@/context/auth";
import { useToast } from "@/context";
import { updateProfile, changePassword } from "@/lib/api/auth";
import { cn } from "@/utils/cn";

const PROFILE_FORM_ID = "profile-information-form";
const CHANGE_PASSWORD_FORM_ID = "change-password-form";

type Section = "profile" | "change-password";

const EMPTY_PASSWORD_FORM = { current_password: "", new_password: "", confirm_password: "" };

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <Label htmlFor={id} required className="text-xs">
        {label}
      </Label>
      <div className="relative mt-1.5">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={6}
          disabled={disabled}
          className="pr-9"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg/35 transition-colors hover:text-fg/60"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, setAuth, token } = useAuth();
  const { toast } = useToast();
  const [section, setSection] = useState<Section>("profile");
  const [form, setForm] = useState({ first_name: "", last_name: "" });
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (user) setForm({ first_name: user.first_name, last_name: user.last_name });
  }, [user]);

  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (res) => {
      if (res.data && token) setAuth(res.data, token);
      toast({ title: "Profile updated", tone: "success" });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't update profile", description: err.message, tone: "danger" });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      toast({ title: "Password changed", tone: "success" });
      setPasswordForm(EMPTY_PASSWORD_FORM);
      setSection("profile");
    },
    onError: (err: Error) => setPasswordError(err.message),
  });

  if (!user) return null;

  const isProfileDirty = form.first_name !== user.first_name || form.last_name !== user.last_name;

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isProfileDirty) return;
    profileMutation.mutate(form);
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");

    if (passwordForm.new_password === passwordForm.current_password) {
      setPasswordError("New password must be different from your current password.");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError("New password and confirmation don't match.");
      return;
    }

    passwordMutation.mutate({
      current_password: passwordForm.current_password,
      new_password: passwordForm.new_password,
    });
  }

  function handleCancelPassword() {
    setPasswordForm(EMPTY_PASSWORD_FORM);
    setPasswordError("");
    setSection("profile");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-fg">
            {section === "profile" ? "Profile Settings" : "Change Password"}
          </h1>
          <p className="mt-0.5 text-xs text-fg/45">
            {section === "profile"
              ? "Manage your personal account information."
              : "Choose a new password for your account."}
          </p>
        </div>
        {section === "profile" ? (
          <Button size="sm" type="submit" form={PROFILE_FORM_ID} disabled={!isProfileDirty || profileMutation.isPending}>
            {profileMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" type="button" onClick={handleCancelPassword} disabled={passwordMutation.isPending}>
              Cancel
            </Button>
            <Button size="sm" type="submit" form={CHANGE_PASSWORD_FORM_ID} disabled={passwordMutation.isPending}>
              {passwordMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full shrink-0 lg:w-48">
          <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-fg/35">Personal</p>
          <nav className="space-y-0.5">
            <button
              type="button"
              onClick={() => setSection("profile")}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                section === "profile" ? "bg-accent/10 text-accent" : "text-fg/65 hover:bg-bg-2 hover:text-fg",
              )}
            >
              <User className="h-3.5 w-3.5" />
              Profile
            </button>
            <button
              type="button"
              onClick={() => setSection("change-password")}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                section === "change-password" ? "bg-accent/10 text-accent" : "text-fg/65 hover:bg-bg-2 hover:text-fg",
              )}
            >
              <KeyRound className="h-3.5 w-3.5" />
              Change Password
            </button>
          </nav>
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-5">
          {section === "profile" ? (
            <>
              <Card className="p-4 sm:p-5">
                <h2 className="text-[13px] font-semibold text-fg">Profile Information</h2>
                <form id={PROFILE_FORM_ID} onSubmit={handleProfileSubmit} className="mt-3.5 space-y-3.5">
                  <div>
                    <Label htmlFor="first_name" required className="text-xs">
                      First Name
                    </Label>
                    <Input
                      id="first_name"
                      size="sm"
                      className="mt-1.5"
                      value={form.first_name}
                      onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                      required
                      disabled={profileMutation.isPending}
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name" required className="text-xs">
                      Last Name
                    </Label>
                    <Input
                      id="last_name"
                      size="sm"
                      className="mt-1.5"
                      value={form.last_name}
                      onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                      required
                      disabled={profileMutation.isPending}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-xs">
                      Email Address
                    </Label>
                    <Input id="email" size="sm" className="mt-1.5" value={user.email} disabled />
                  </div>
                </form>
              </Card>

              <Card className="p-4 sm:p-5">
                <h2 className="text-[13px] font-semibold text-fg">Security Settings</h2>
                <div className="mt-3.5">
                  <p className="text-xs font-medium text-fg">Password</p>
                  <p className="mt-1 text-xs text-fg/45">Update your password through the button below.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-2.5"
                    onClick={() => setSection("change-password")}
                  >
                    Change Password
                  </Button>
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-4 sm:p-5">
              <form id={CHANGE_PASSWORD_FORM_ID} onSubmit={handlePasswordSubmit} className="space-y-3.5">
                <PasswordField
                  id="current_password"
                  label="Current Password"
                  placeholder="Enter your current password"
                  autoComplete="current-password"
                  value={passwordForm.current_password}
                  onChange={(v) => setPasswordForm((f) => ({ ...f, current_password: v }))}
                  disabled={passwordMutation.isPending}
                />
                <PasswordField
                  id="new_password"
                  label="New Password"
                  placeholder="Enter your new password"
                  autoComplete="new-password"
                  value={passwordForm.new_password}
                  onChange={(v) => setPasswordForm((f) => ({ ...f, new_password: v }))}
                  disabled={passwordMutation.isPending}
                />
                <PasswordField
                  id="confirm_password"
                  label="Confirm Password"
                  placeholder="Confirm your new password"
                  autoComplete="new-password"
                  value={passwordForm.confirm_password}
                  onChange={(v) => setPasswordForm((f) => ({ ...f, confirm_password: v }))}
                  disabled={passwordMutation.isPending}
                />

                {passwordError && (
                  <p className="rounded-md border border-[hsl(var(--danger)/0.3)] bg-[hsl(var(--danger)/0.08)] px-3 py-2 text-xs text-[hsl(var(--danger))]">
                    {passwordError}
                  </p>
                )}
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
