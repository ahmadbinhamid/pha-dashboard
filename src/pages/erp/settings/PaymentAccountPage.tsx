import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { SaveStatusText } from "@/components/shared/SaveStatusText";
import { Button } from "@/components/ui/Button";
import { SettingsHeaderActions } from "@/context/settingsHeaderActions";
import { StripeKeysCard, STRIPE_KEYS_FORM_ID } from "@/components/tenant-settings/StripeKeysCard";

export default function PaymentAccountPage() {
  const [mutationState, setMutationState] = useState({ isPending: false, isSuccess: false, error: null as string | null });

  return (
    <div className="space-y-6">
      <PageHeader title="Payment Account" />

      <SettingsHeaderActions>
        <SaveStatusText isSuccess={mutationState.isSuccess} error={mutationState.error} />
        <Button type="submit" form={STRIPE_KEYS_FORM_ID} disabled={mutationState.isPending}>
          {mutationState.isPending ? "Saving…" : "Save changes"}
        </Button>
      </SettingsHeaderActions>

      <StripeKeysCard onMutationStateChange={setMutationState} />
    </div>
  );
}
