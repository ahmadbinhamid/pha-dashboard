import {
  Bell,
  Blocks,
  CreditCard,
  Globe,
  History,
  Palette,
  Receipt,
  Shield,
  ShieldCheck,
  Store,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";

// The Settings page's top-level tabs, and the sub-sections inside Store
// Settings. Split out of the page itself (matching config/nav.tsx's role for
// the app sidebar) so the tab bar, the router's redirects and the page body
// all read from one list instead of three hand-kept copies.
//
// `available: false` marks an area the product doesn't have a backend for
// yet — the tab still renders and is still navigable, it just shows
// <ComingSoonPanel> instead of controls that would save nowhere.

export type SettingsTabId =
  | "appearance"
  | "store"
  | "integrations"
  | "users"
  | "roles"
  | "taxes"
  | "notifications"
  | "billing"
  | "activity";

export type SettingsTab = {
  id: SettingsTabId;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactNode;
  available: boolean;
  /** Shown by <ComingSoonPanel> — what this tab will do once it's built. */
  summary?: string;
  planned?: string[];
};

export const SETTINGS_TABS: SettingsTab[] = [
  { id: "appearance", label: "Appearance & Theme", icon: (p) => <Palette {...p} />, available: true },
  { id: "store", label: "Store Settings", icon: (p) => <Store {...p} />, available: true },
  { id: "integrations", label: "Integrations", icon: (p) => <Blocks {...p} />, available: true },
  // Both fully built end-to-end (Membership/Role/Invitation models, invite
  // email flow, permission matrix) but pulled behind Coming Soon for now —
  // see SettingsPage.tsx for the matching fallback. The backend routes,
  // services and UsersTab/RolesTab components are untouched and still work;
  // this only stops the UI from being reachable.
  {
    id: "users",
    label: "User Management",
    icon: (p) => <Users {...p} />,
    available: false,
    summary: "Invite teammates to your store and manage who has access.",
    planned: [
      "Invite people by email, with a role assigned on acceptance",
      "See everyone's status — active, pending invite, suspended",
      "Move someone to a different role, or remove their access",
    ],
  },
  {
    id: "roles",
    label: "Roles & Permissions",
    icon: (p) => <Shield {...p} />,
    available: false,
    summary: "Define what each role on your team can see and do.",
    planned: [
      "Built-in roles (Admin, Staff) plus custom roles you define",
      "Per-permission toggles across orders, inventory, reports and settings",
      "See which teammates hold each role before changing it",
    ],
  },
  {
    id: "taxes",
    label: "Taxes & Shipping",
    icon: (p) => <Truck {...p} />,
    available: false,
    summary: "Tax rates and freight rules. GST is currently fixed at the AU rate and applied to every order.",
    planned: [
      "Multiple tax rates, and tax-exempt customers",
      "Freight rules by weight, destination and carrier",
      "Free-shipping thresholds per sales channel",
    ],
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: (p) => <Bell {...p} />,
    available: false,
    summary:
      "Choose which events email you and your team. The in-app notification feed already runs — this is the preference layer over it.",
    planned: [
      "Per-event toggles for email and in-app delivery",
      "Route low-stock and refund alerts to specific people",
      "Daily or weekly digests instead of one email per event",
    ],
  },
  {
    id: "billing",
    label: "Billing & Plan",
    icon: (p) => <CreditCard {...p} />,
    available: false,
    summary: "Your subscription, invoices and usage limits. Billing isn't handled in-app yet.",
    planned: ["Current plan and usage against its limits", "Payment method and billing contact", "Downloadable past invoices"],
  },
  { id: "activity", label: "Activity", icon: (p) => <History {...p} />, available: true },
];

export const DEFAULT_SETTINGS_TAB: SettingsTabId = "store";

export function findSettingsTab(id: string | undefined): SettingsTab | undefined {
  return SETTINGS_TABS.find((t) => t.id === id);
}

// ── Store Settings sub-sections ─────────────────────────────────────────────

export type StoreSectionId = "general" | "warehouses" | "regional" | "invoices" | "policies";

export type StoreSection = {
  id: StoreSectionId;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactNode;
  available: boolean;
  summary?: string;
  planned?: string[];
};

export const STORE_SECTIONS: StoreSection[] = [
  { id: "general", label: "General & Legal", icon: (p) => <Store {...p} />, available: true },
  { id: "warehouses", label: "Warehouses & Hubs", icon: (p) => <Warehouse {...p} />, available: true },
  {
    id: "regional",
    label: "Currency & Regional",
    icon: (p) => <Globe {...p} />,
    available: false,
    summary: "Currency, locale and timezone. Everything is currently fixed to AUD and Australian formatting.",
    planned: [
      "Sell and report in more than one currency",
      "Per-store timezone for cut-off times and reports",
      "Date, number and address formatting by locale",
    ],
  },
  { id: "invoices", label: "Invoices & Dockets", icon: (p) => <Receipt {...p} />, available: true },
  { id: "policies", label: "Fitment & Warranty Policies", icon: (p) => <ShieldCheck {...p} />, available: true },
];

export const DEFAULT_STORE_SECTION: StoreSectionId = "general";

export function findStoreSection(id: string | undefined): StoreSection | undefined {
  return STORE_SECTIONS.find((s) => s.id === id);
}
