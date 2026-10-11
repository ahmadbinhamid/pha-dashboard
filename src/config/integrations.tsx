import { CreditCard, FolderTree, Globe, Link2, Mail, Truck } from "lucide-react";
import { EbayLogo, GoogleLogo } from "@/components/channels/channelLogos";
import { MetaLogo } from "@/components/channels/MetaLogo";

// In config/ because the id is also the URL segment SettingsPage routes on.
export type IntegrationId = "ebay" | "google" | "meta" | "channel-categories" | "stripe" | "email" | "transdirect" | "domains" | "payment-links";

export type IntegrationDefinition = {
  id: IntegrationId;
  name: string;
  description: string;
  icon: (props: { className?: string }) => React.ReactNode;
  // These three use the neutral logo chip, not the accent-tinted circle.
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
    id: "meta",
    name: "Meta",
    description: "Sell on Facebook and Instagram Shops from a Meta catalog, with checkout on your storefront.",
    icon: (p) => <MetaLogo {...p} />,
    logoTile: true,
  },
  {
    id: "channel-categories",
    name: "Channel Categories",
    description: "Map your product categories to eBay, Google and Meta categories once, instead of per listing.",
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
    id: "transdirect",
    name: "Transdirect Shipping",
    description: "Live courier rates by postcode for products set to calculated shipping.",
    icon: (p) => <Truck {...p} />,
  },
  {
    id: "domains",
    name: "Custom Domains",
    // Fallback until the tenant uploads a logo (swapped in IntegrationsTab).
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
