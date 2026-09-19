import { CreditCard, Globe, Link2, Mail, ShoppingBag, ShoppingCart } from "lucide-react";

// The integrations Settings can configure, in catalogue order. Lives in
// config/ (like settingsTabs.tsx and nav.tsx) rather than inside the tab that
// renders it, because the id is also the URL segment
// (/settings/integrations/:provider) that SettingsPage routes on — two files
// need the list, so neither should own it.
export type IntegrationId = "ebay" | "google" | "stripe" | "email" | "domains" | "payment-links";

export type IntegrationDefinition = {
  id: IntegrationId;
  name: string;
  description: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactNode;
};

export const INTEGRATION_CATALOGUE: IntegrationDefinition[] = [
  {
    id: "ebay",
    name: "eBay",
    description: "Connect a seller account, push listings and keep stock in sync with your eBay store.",
    icon: (p) => <ShoppingBag {...p} />,
  },
  {
    id: "google",
    name: "Google Shopping",
    description: "Send your catalogue to Google Merchant Center and configure feed defaults.",
    icon: (p) => <ShoppingCart {...p} />,
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
    description: "Point your own domain at the storefront, and verify it for customer-facing links.",
    icon: (p) => <Globe {...p} />,
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
