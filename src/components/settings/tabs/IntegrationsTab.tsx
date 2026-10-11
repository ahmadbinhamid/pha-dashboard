import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Can } from "@/components/auth/Can";
import { PERMISSIONS } from "@/config/permissions";
import { SaveStatusText } from "@/components/shared/SaveStatusText";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { SettingsHeaderActions } from "@/context/settingsHeaderActions";
import { IntegrationCard, type IntegrationStatus } from "@/components/settings/IntegrationCard";
import { StripeKeysCard, STRIPE_KEYS_FORM_ID } from "@/components/tenant-settings/StripeKeysCard";
import { SmtpSettingsCard, SMTP_SETTINGS_FORM_ID } from "@/components/tenant-settings/SmtpSettingsCard";
import { PaymentDomainForm, PAYMENT_DOMAIN_FORM_ID } from "@/components/tenant-settings/PaymentDomainForm";
import { TransdirectSettingsCard, TRANSDIRECT_SETTINGS_FORM_ID } from "@/components/shipping-settings/TransdirectSettingsCard";
import { SHIPPING_SETTINGS_QUERY_KEY, getShippingSettings } from "@/lib/api/shipping";
import { ChannelConnectCard } from "@/components/channels/ChannelConnectCard";
import { CategoryMappingsPanel } from "@/components/category-mappings/CategoryMappingsPanel";
import DomainsPage from "@/pages/erp/settings/DomainsPage";
import { getEbaySettings } from "@/lib/api/ebay";
import { getChannels } from "@/lib/api/channels";
import { getDomains } from "@/lib/api/domains";
import { getSmtpStatus } from "@/lib/api/tenantSettings";
import { INTEGRATION_CATALOGUE, findIntegration, type IntegrationId } from "@/config/integrations";
import type { TenantSettings, SettingsMutationState } from "@/types/tenantSettings";
import type { EbayConnectionStatus } from "@/types/ebaySettings";
import type { ChannelConnectionStatus } from "@/types/channel";

const IDLE: SettingsMutationState = { isPending: false, isSuccess: false, error: null };

const EBAY_STATUS_MAP: Record<EbayConnectionStatus, IntegrationStatus> = {
  connected: "connected",
  not_connected: "not_connected",
  token_expired: "error",
  revoked: "error",
  error: "error",
};

const CHANNEL_STATUS_MAP: Record<ChannelConnectionStatus, IntegrationStatus> = {
  connected: "connected",
  disconnected: "not_connected",
  degraded: "error",
  error: "error",
  pending: "error",
};

function StripePanel() {
  const [state, setState] = useState<SettingsMutationState>(IDLE);
  return (
    <>
      <SettingsHeaderActions>
        <SaveStatusText isSuccess={state.isSuccess} error={state.error} />
        <Can permission={PERMISSIONS.integrations.update}>
          <Button type="submit" form={STRIPE_KEYS_FORM_ID} disabled={state.isPending}>
            {state.isPending ? "Saving…" : "Save changes"}
          </Button>
        </Can>
      </SettingsHeaderActions>
      <StripeKeysCard onMutationStateChange={setState} />
    </>
  );
}

function PaymentLinksPanel({ settings }: { settings?: TenantSettings }) {
  const [state, setState] = useState<SettingsMutationState>(IDLE);
  return (
    <>
      <SettingsHeaderActions>
        <SaveStatusText isSuccess={state.isSuccess} error={state.error} />
        <Can permission={PERMISSIONS.integrations.update}>
          <Button type="submit" form={PAYMENT_DOMAIN_FORM_ID} disabled={!settings || state.isPending}>
            {state.isPending ? "Saving…" : "Save changes"}
          </Button>
        </Can>
      </SettingsHeaderActions>
      {settings ? <PaymentDomainForm settings={settings} onMutationStateChange={setState} /> : <SkeletonCard />}
    </>
  );
}

function EmailPanel() {
  const [state, setState] = useState<SettingsMutationState>(IDLE);
  return (
    <>
      <SettingsHeaderActions>
        <SaveStatusText isSuccess={state.isSuccess} error={state.error} />
        <Can permission={PERMISSIONS.integrations.update}>
          <Button type="submit" form={SMTP_SETTINGS_FORM_ID} disabled={state.isPending}>
            {state.isPending ? "Saving…" : "Save changes"}
          </Button>
        </Can>
      </SettingsHeaderActions>
      <SmtpSettingsCard onMutationStateChange={setState} />
    </>
  );
}

function TransdirectPanel() {
  const [state, setState] = useState<SettingsMutationState>(IDLE);
  return (
    <>
      <SettingsHeaderActions>
        <SaveStatusText isSuccess={state.isSuccess} error={state.error} />
        <Can permission={PERMISSIONS.shipping.update}>
          <Button type="submit" form={TRANSDIRECT_SETTINGS_FORM_ID} disabled={state.isPending}>
            {state.isPending ? "Saving…" : "Save changes"}
          </Button>
        </Can>
      </SettingsHeaderActions>
      <TransdirectSettingsCard onMutationStateChange={setState} />
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
  // Shares queryKeys with the detail panels, so visiting one warms this grid.
  const { data: ebayRes } = useQuery({ queryKey: ["ebay-settings"], queryFn: getEbaySettings });
  const { data: channelsRes } = useQuery({ queryKey: ["channels"], queryFn: getChannels });
  const { data: domainsRes } = useQuery({ queryKey: ["domains"], queryFn: getDomains });
  const { data: shippingRes } = useQuery({ queryKey: SHIPPING_SETTINGS_QUERY_KEY, queryFn: getShippingSettings });

  const stripeStatus: IntegrationStatus = settings?.stripe_connection_status ?? "unknown";
  const smtpStatus: IntegrationStatus = smtpRes?.data?.connection_status ?? "unknown";
  const ebayStatus: IntegrationStatus = ebayRes?.data
    ? EBAY_STATUS_MAP[ebayRes.data.connection_status]
    : "unknown";
  const googleChannel = channelsRes?.data?.find((c) => c.key === "google");
  const googleStatus: IntegrationStatus = googleChannel
    ? CHANNEL_STATUS_MAP[googleChannel.connection.status]
    : "unknown";
  const metaChannel = channelsRes?.data?.find((c) => c.key === "meta");
  const metaStatus: IntegrationStatus = metaChannel ? CHANNEL_STATUS_MAP[metaChannel.connection.status] : "unknown";
  const domainsStatus: IntegrationStatus = domainsRes?.data
    ? domainsRes.data.some((d) => d.status === "active")
      ? "connected"
      : "not_connected"
    : "unknown";
  const paymentLinksStatus: IntegrationStatus =
    settings?.payment_domain_mode === "vendor_slug" ? "connected" : "not_connected";
  const transdirectStatus: IntegrationStatus = shippingRes?.data
    ? shippingRes.data.transdirect_configured
      ? "connected"
      : "not_connected"
    : "unknown";
  // Every catalogue entry must map to a status (enforced by the Record type).
  const statusById: Record<IntegrationId, IntegrationStatus> = {
    ebay: ebayStatus,
    google: googleStatus,
    meta: metaStatus,
    "channel-categories": "unknown",
    stripe: stripeStatus,
    email: smtpStatus,
    transdirect: transdirectStatus,
    domains: domainsStatus,
    "payment-links": paymentLinksStatus,
  };

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

        {providerId === "ebay" || providerId === "google" || providerId === "meta" ? (
          <ChannelConnectCard platform={providerId} />
        ) : providerId === "channel-categories" ? (
          <CategoryMappingsPanel />
        ) : providerId === "stripe" ? (
          <StripePanel />
        ) : providerId === "email" ? (
          <EmailPanel />
        ) : providerId === "transdirect" ? (
          <TransdirectPanel />
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
        // Stands in for the storefront: show the tenant logo once uploaded.
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
            status={statusById[integration.id]}
            onManage={() => onSelectProvider(integration.id)}
          />
        );
      })}
    </div>
  );
}
