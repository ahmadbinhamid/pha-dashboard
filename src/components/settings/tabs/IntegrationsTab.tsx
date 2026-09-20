import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SaveStatusText } from "@/components/shared/SaveStatusText";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { SettingsHeaderActions } from "@/context/settingsHeaderActions";
import { IntegrationCard, type IntegrationStatus } from "@/components/settings/IntegrationCard";
import { StripeKeysCard, STRIPE_KEYS_FORM_ID } from "@/components/tenant-settings/StripeKeysCard";
import { SmtpSettingsCard, SMTP_SETTINGS_FORM_ID } from "@/components/tenant-settings/SmtpSettingsCard";
import { PaymentDomainForm, PAYMENT_DOMAIN_FORM_ID } from "@/components/tenant-settings/PaymentDomainForm";
import { EbayConnectCard } from "@/components/ebay-settings/EbayConnectCard";
import { EbaySettingsForm, EBAY_SETTINGS_FORM_ID } from "@/components/ebay-settings/EbaySettingsForm";
import { GoogleConnectCard } from "@/components/google-settings/GoogleConnectCard";
import DomainsPage from "@/pages/erp/settings/DomainsPage";
import { getEbaySettings } from "@/lib/api/ebay";
import { getSmtpStatus } from "@/lib/api/tenantSettings";
import { INTEGRATION_CATALOGUE, findIntegration, type IntegrationId } from "@/config/integrations";
import type { TenantSettings } from "@/types/tenantSettings";

type MutationState = { isPending: boolean; isSuccess: boolean; error: string | null };
const IDLE: MutationState = { isPending: false, isSuccess: false, error: null };

function EbayPanel() {
  const { data, isLoading } = useQuery({ queryKey: ["ebay-settings"], queryFn: getEbaySettings });
  const settings = data?.data;
  const [state, setState] = useState<MutationState>(IDLE);

  return (
    <div className="space-y-6">
      <SettingsHeaderActions>
        <SaveStatusText isSuccess={state.isSuccess} error={state.error} />
        <Button type="submit" form={EBAY_SETTINGS_FORM_ID} disabled={!settings || state.isPending}>
          {state.isPending ? "Saving…" : "Save changes"}
        </Button>
      </SettingsHeaderActions>

      <EbayConnectCard />
      {isLoading || !settings ? <SkeletonCard /> : <EbaySettingsForm settings={settings} onMutationStateChange={setState} />}
    </div>
  );
}

function StripePanel() {
  const [state, setState] = useState<MutationState>(IDLE);
  return (
    <>
      <SettingsHeaderActions>
        <SaveStatusText isSuccess={state.isSuccess} error={state.error} />
        <Button type="submit" form={STRIPE_KEYS_FORM_ID} disabled={state.isPending}>
          {state.isPending ? "Saving…" : "Save changes"}
        </Button>
      </SettingsHeaderActions>
      <StripeKeysCard onMutationStateChange={setState} />
    </>
  );
}

function PaymentLinksPanel({ settings }: { settings?: TenantSettings }) {
  const [state, setState] = useState<MutationState>(IDLE);
  return (
    <>
      <SettingsHeaderActions>
        <SaveStatusText isSuccess={state.isSuccess} error={state.error} />
        <Button type="submit" form={PAYMENT_DOMAIN_FORM_ID} disabled={!settings || state.isPending}>
          {state.isPending ? "Saving…" : "Save changes"}
        </Button>
      </SettingsHeaderActions>
      {settings ? <PaymentDomainForm settings={settings} onMutationStateChange={setState} /> : <SkeletonCard />}
    </>
  );
}

function EmailPanel() {
  const [state, setState] = useState<MutationState>(IDLE);
  return (
    <>
      <SettingsHeaderActions>
        <SaveStatusText isSuccess={state.isSuccess} error={state.error} />
        <Button type="submit" form={SMTP_SETTINGS_FORM_ID} disabled={state.isPending}>
          {state.isPending ? "Saving…" : "Save changes"}
        </Button>
      </SettingsHeaderActions>
      <SmtpSettingsCard onMutationStateChange={setState} />
    </>
  );
}

export function IntegrationsTab({
  providerId,
  onSelectProvider,
  settings,
}: {
  providerId?: IntegrationId;
  onSelectProvider: (id?: IntegrationId) => void;
  settings?: TenantSettings;
}) {
  // Stripe's status rides along on tenant settings; SMTP has its own endpoint.
  const { data: smtpRes } = useQuery({ queryKey: ["smtp-status"], queryFn: getSmtpStatus });

  const stripeStatus: IntegrationStatus = settings?.stripe_connection_status ?? "unknown";
  const smtpStatus: IntegrationStatus = smtpRes?.data?.connection_status ?? "unknown";

  if (providerId) {
    const label = findIntegration(providerId)?.name ?? "Integration";
    return (
      <div className="space-y-5">
        <Button variant="ghost" size="sm" className="gap-1.5 text-fg/60" onClick={() => onSelectProvider(undefined)}>
          <ArrowLeft className="h-3.5 w-3.5" />
          All integrations
        </Button>

        {providerId === "domains" ? null : (
          <div>
            <h2 className="text-base font-bold text-fg">{label}</h2>
          </div>
        )}

        {providerId === "ebay" ? (
          <EbayPanel />
        ) : providerId === "google" ? (
          <GoogleConnectCard />
        ) : providerId === "stripe" ? (
          <StripePanel />
        ) : providerId === "email" ? (
          <EmailPanel />
        ) : providerId === "payment-links" ? (
          <PaymentLinksPanel settings={settings} />
        ) : (
          <DomainsPage />
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {INTEGRATION_CATALOGUE.map((integration) => {
        // "Custom Domains" stands in for the tenant's own storefront — once
        // they've uploaded a logo (Branding settings), show that instead of
        // the generic Globe fallback, same idea as eBay/Google showing their
        // own mark rather than a placeholder shopping-bag icon.
        const icon =
          integration.id === "domains" && settings?.logo_url ? (
            <img src={settings.logo_url} alt="" className="h-full w-full object-contain" />
          ) : (
            integration.icon({ className: "h-5 w-5" })
          );

        return (
          <IntegrationCard
            key={integration.id}
            name={integration.name}
            description={integration.description}
            icon={icon}
            logoTile={integration.logoTile}
            status={
              integration.id === "stripe" ? stripeStatus : integration.id === "email" ? smtpStatus : "unknown"
            }
            onManage={() => onSelectProvider(integration.id)}
          />
        );
      })}
    </div>
  );
}
