import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { FormField } from "@/components/ui/FormField";
import { SettingsSection, SettingsFieldGrid } from "@/components/settings/SettingsSection";
import { useToast } from "@/context";
import { changePassword } from "@/lib/api/auth";
import type { PasswordFormState } from "@/types/auth";

const FORM_ID = "change-password-form";

// Mirrors auth.validation.js#changePassword — 6–128 characters, and the new
// one can't be the current one (the server rejects that outright, so checking
// here turns a 400 into an inline message).
const MIN_LENGTH = 6;

const EMPTY_FORM: PasswordFormState = { current_password: "", new_password: "", confirm_password: "" };

export function ChangePasswordForm() {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      toast({ title: "Password changed", tone: "success" });
      setForm(EMPTY_FORM);
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  // Still computed — these gate the submit button and the inline messages,
  // they just aren't listed as a checklist any more.
  const longEnough = form.new_password.length >= MIN_LENGTH;
  const isDifferent = form.new_password.length > 0 && form.new_password !== form.current_password;
  const matches = form.confirm_password.length > 0 && form.new_password === form.confirm_password;
  const touched = Boolean(form.current_password || form.new_password || form.confirm_password);
  const canSubmit = Boolean(form.current_password) && longEnough && isDifferent && matches && !mutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!isDifferent) return setError("New password must be different from your current password.");
    if (!matches) return setError("New password and confirmation don't match.");

    mutation.mutate({ current_password: form.current_password, new_password: form.new_password });
  }

  function set(key: keyof PasswordFormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setForm((f) => ({ ...f, [key]: value }));
      // Clears the server's message as soon as the input it referred to
      // changes, rather than leaving a stale error under an edited field.
      if (error) setError("");
    };
  }

  return (
    <SettingsSection
      title="Password"
      description="Change the password you use to sign in. You'll stay signed in on this device."
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            disabled={!touched || mutation.isPending}
            onClick={() => {
              setForm(EMPTY_FORM);
              setError("");
            }}
          >
            Clear
          </Button>
          <Button type="submit" form={FORM_ID} variant="primary" disabled={!canSubmit}>
            {mutation.isPending ? "Updating…" : "Update Password"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        <SettingsFieldGrid>
          <FormField label="Current Password" htmlFor="current_password" required className="sm:col-span-2">
            <PasswordInput
              id="current_password"
              placeholder="Enter your current password"
              autoComplete="current-password"
              value={form.current_password}
              onChange={set("current_password")}
              required
              minLength={MIN_LENGTH}
              disabled={mutation.isPending}
            />
          </FormField>

          <FormField
            label="New Password"
            htmlFor="new_password"
            required
            error={form.new_password && !longEnough ? `Use at least ${MIN_LENGTH} characters.` : undefined}
          >
            <PasswordInput
              id="new_password"
              placeholder="Enter your new password"
              autoComplete="new-password"
              value={form.new_password}
              onChange={set("new_password")}
              required
              minLength={MIN_LENGTH}
              disabled={mutation.isPending}
            />
          </FormField>

          <FormField
            label="Confirm Password"
            htmlFor="confirm_password"
            required
            error={form.confirm_password && !matches ? "Passwords don't match." : undefined}
          >
            <PasswordInput
              id="confirm_password"
              placeholder="Re-enter your new password"
              autoComplete="new-password"
              value={form.confirm_password}
              onChange={set("confirm_password")}
              required
              minLength={MIN_LENGTH}
              disabled={mutation.isPending}
            />
          </FormField>
        </SettingsFieldGrid>

        {error ? (
          <p className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/8 px-3 py-2.5 text-xs text-danger" role="alert">
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        ) : null}
      </form>
    </SettingsSection>
  );
}
