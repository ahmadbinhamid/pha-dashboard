import {
  Bell,
  Blocks,
  CreditCard,
  Globe,
  Palette,
  Receipt,
  Shield,
  ShieldCheck,
  Store,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { PERMISSIONS, type Permission } from "@/config/permissions";

// Settings tabs; `available: false` shows ComingSoonPanel instead of controls.

export type SettingsTabId =
  | "appearance"
  | "store"
  | "integrations"
  | "users"
  | "roles"
  | "taxes"
  | "notifications"
  | "billing";

export type SettingsTab = {
  id: SettingsTabId;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactNode;
  available: boolean;
  // Needed to see the tab at all; omitted means everyone sees it.
  permission?: Permission;
  /** Shown by <ComingSoonPanel> — what this tab will do once it's built. */
  summary?: string;
  planned?: string[];
};

export const SETTINGS_TABS: SettingsTab[] = [
  { id: "appearance", label: "Appearance & Theme", icon: (p) => <Palette {...p} />, available: true },
  {
    id: "store",
    label: "Store Settings",
    icon: (p) => <Store {...p} />,
    available: true,
    permission: PERMISSIONS.settings.view,
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: (p) => <Blocks {...p} />,
    available: true,
    permission: PERMISSIONS.integrations.view,
  },
  {
    id: "users",
    label: "User Management",
    icon: (p) => <Users {...p} />,
    available: true,
    permission: PERMISSIONS.users.view,
  },
  {
    id: "roles",
    label: "Roles & Permissions",
    icon: (p) => <Shield {...p} />,
    available: true,
    permission: PERMISSIONS.roles.view,
  },
  {
    id: "taxes",
    permission: PERMISSIONS.settings.view,
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
    permission: PERMISSIONS.settings.view,
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
    permission: PERMISSIONS.settings.view,
    label: "Billing & Plan",
    icon: (p) => <CreditCard {...p} />,
    available: false,
    summary: "Your subscription, invoices and usage limits. Billing isn't handled in-app yet.",
    planned: ["Current plan and usage against its limits", "Payment method and billing contact", "Downloadable past invoices"],
  },
];

export const DEFAULT_SETTINGS_TAB: SettingsTabId = "store";

/** Tabs the user may open, given useMyAccess().can. */
export function visibleSettingsTabs(can: (permission: Permission) => boolean): SettingsTab[] {
  return SETTINGS_TABS.filter((tab) => !tab.permission || can(tab.permission));
}

export function findSettingsTab(id: string | undefined): SettingsTab | undefined {
  return SETTINGS_TABS.find((t) => t.id === id);
}

// ── Store Settings sub-sections ──

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
