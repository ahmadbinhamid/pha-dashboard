import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { SettingsSection, SettingsFieldGrid } from "@/components/settings/SettingsSection";
import { useAuth } from "@/context/auth";
import { useToast } from "@/context";
import { updateProfile } from "@/lib/api/auth";
import type { AuthUser, ProfileFormState } from "@/types/auth";

const FORM_ID = "profile-information-form";

// Owns its own save, the same way each Settings card does — PUT /user only
// takes the name fields, so a page-wide submit would have nothing else to
// carry and would just couple this card to the password one.
export function ProfileInformationForm({ user }: { user: AuthUser }) {
  const { setAuth, token } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<ProfileFormState>({ first_name: user.first_name, last_name: user.last_name });

  // Re-syncs when the signed-in user changes underneath the form — e.g. the
  // save below writes a new user into auth context.
  useEffect(() => {
    setForm({ first_name: user.first_name, last_name: user.last_name });
  }, [user]);

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (res) => {
      if (res.data && token) setAuth(res.data, token);
      toast({ title: "Profile updated", tone: "success" });
    },
    onError: (err: Error) => toast({ title: "Couldn't update profile", description: err.message, tone: "danger" }),
  });

  const isDirty = form.first_name !== user.first_name || form.last_name !== user.last_name;
  const isBlank = !form.first_name.trim() || !form.last_name.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isDirty || isBlank) return;
    mutation.mutate({ first_name: form.first_name.trim(), last_name: form.last_name.trim() });
  }

  return (
    <SettingsSection
      title="Personal Information"
      description="The name shown on your account, in the activity log and on anything you send to customers."
      footerDivider={false}
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            disabled={!isDirty || mutation.isPending}
            onClick={() => setForm({ first_name: user.first_name, last_name: user.last_name })}
          >
            Reset
          </Button>
          <Button type="submit" form={FORM_ID} variant="primary" disabled={!isDirty || isBlank || mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit}>
        <SettingsFieldGrid>
          <FormField label="First Name" htmlFor="first_name" required>
            <Input
              id="first_name"
              autoComplete="given-name"
              value={form.first_name}
              onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              required
              disabled={mutation.isPending}
            />
          </FormField>

          <FormField label="Last Name" htmlFor="last_name" required>
            <Input
              id="last_name"
              autoComplete="family-name"
              value={form.last_name}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              required
              disabled={mutation.isPending}
            />
          </FormField>

          <FormField
            label="Email Address"
            htmlFor="email"
            className="sm:col-span-2"
          >
            <Input id="email" type="email" value={user.email} readOnly disabled />
          </FormField>
        </SettingsFieldGrid>
      </form>
    </SettingsSection>
  );
}
