import { CreditCard, FolderTree, Globe, Link2, Mail } from "lucide-react";
import { EbayLogo, GoogleLogo } from "@/components/channels/channelLogos";

// The integrations Settings can configure, in catalogue order. Lives in config/ rather than the rendering tab because the id is also the URL segment SettingsPage routes on — two files need this list.
export type IntegrationId = "ebay" | "google" | "channel-categories" | "stripe" | "email" | "domains" | "payment-links";

export type IntegrationDefinition = {
  id: IntegrationId;
  name: string;
  description: string;
  icon: (props: { className?: string }) => React.ReactNode;
  // eBay/Google get their own brand mark; "Custom Domains" gets the tenant's uploaded logo (IntegrationsTab.tsx). All three share the neutral logo-chip treatment instead of the accent-tinted circle other icons use.
  logoTile?: boolean;
};

export const INTEGRATION_CATALOGUE: IntegrationDefinition[] = [
  {
    id: "ebay",
    name: "eBay",
    description: "Connect a seller account, push listings and keep stock in sync with your eBay store.",
    icon: (p) => <EbayLogo {...p} />,
    logoTile: true,
  },
  {
    id: "google",
    name: "Google Shopping",
    description: "Send your catalogue to Google Merchant Center and configure feed defaults.",
    icon: (p) => <GoogleLogo {...p} />,
    logoTile: true,
  },
  {
    id: "channel-categories",
    name: "Channel Categories",
    description: "Map your product categories to eBay and Google categories once, instead of per listing.",
    icon: (p) => <FolderTree {...p} />,
  },
  {
    id: "stripe",
    name: "Stripe Payments",
    description: "Your own Stripe keys, used for checkout, payment links and refunds.",
    icon: (p) => <CreditCard {...p} />,
  },
  {
    id: "email",
    name: "Transactional Email",
    description: "SMTP credentials for order confirmations, pickup notices and invoices.",
    icon: (p) => <Mail {...p} />,
  },
  {
    id: "domains",
    name: "Custom Domains",
    // Fallback icon until the tenant uploads a logo — IntegrationsTab.tsx swaps this for <img src={settings.logo_url}> once they have.
    description: "Point your own domain at the storefront, and verify it for customer-facing links.",
    icon: (p) => <Globe {...p} />,
    logoTile: true,
  },
  {
    id: "payment-links",
    name: "Payment Link Domain",
    description: "Which domain customer-facing payment links are issued on.",
    icon: (p) => <Link2 {...p} />,
  },
];

export function findIntegration(id: string | undefined): IntegrationDefinition | undefined {
  return INTEGRATION_CATALOGUE.find((i) => i.id === id);
}
