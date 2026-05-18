import type { StoreTenant } from "@/lib/store/tenant-types";

export const DEFAULT_STORE_TENANT: StoreTenant = {
  id: "tenant-pha",
  slug: "parts-hub-australia",
  companyName: "Parts Hub Australia",
  tagline: "New & genuine used auto parts — nationwide.",
  /** Served from /public — swap per tenant in CMS/API later */
  logoUrl: "/branding/parts-hub-australia-logo.png",
  theme: {
    primary: "43 70% 58%",
    primaryForeground: "0 0% 4%",
  },
  supportEmail: "parts@partshub.example",
  supportPhone: "1300 000 000",
  currency: "AUD",
  defaultWarehouse: "Campbellfield, VIC",
};
