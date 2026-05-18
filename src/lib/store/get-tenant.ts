import type { StoreTenant } from "@/lib/store/tenant-types";
import { DEFAULT_STORE_TENANT } from "@/lib/store/tenant-defaults";

/**
 * Mock tenant resolution. Later: read `Host` header / subdomain, fetch from DB.
 */
export async function getStoreTenant(): Promise<StoreTenant> {
  const slug = process.env.NEXT_PUBLIC_STORE_TENANT_SLUG;
  if (slug && slug !== DEFAULT_STORE_TENANT.slug) {
    return {
      ...DEFAULT_STORE_TENANT,
      id: `tenant-${slug}`,
      slug,
      companyName: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      tagline: "Your trusted parts partner.",
      theme: {
        primary: "25 95% 53%",
        primaryForeground: "0 0% 8%",
      },
    };
  }
  return DEFAULT_STORE_TENANT;
}
