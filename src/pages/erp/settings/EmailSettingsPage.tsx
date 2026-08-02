import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { SaveStatusText } from "@/components/shared/SaveStatusText";
import { Button } from "@/components/ui/Button";
import { SettingsHeaderActions } from "@/context/settingsHeaderActions";
import { SmtpSettingsCard, SMTP_SETTINGS_FORM_ID } from "@/components/tenant-settings/SmtpSettingsCard";

export default function EmailSettingsPage() {
  const [mutationState, setMutationState] = useState({ isPending: false, isSuccess: false, error: null as string | null });

  return (
    <div className="space-y-6">
      <PageHeader title="Email Settings" />

      <SettingsHeaderActions>
        <SaveStatusText isSuccess={mutationState.isSuccess} error={mutationState.error} />
        <Button type="submit" form={SMTP_SETTINGS_FORM_ID} disabled={mutationState.isPending}>
          {mutationState.isPending ? "Saving…" : "Save changes"}
        </Button>
      </SettingsHeaderActions>

      <SmtpSettingsCard onMutationStateChange={setMutationState} />
    </div>
  );
}
