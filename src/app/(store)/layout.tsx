import type { Metadata } from "next";
import { getStoreTenant } from "@/lib/store/get-tenant";
import { StoreHeader } from "@/components/store/store-header";
import { StoreFooter } from "@/components/store/store-footer";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getStoreTenant();
  return {
    title: { default: tenant.companyName, template: `%s | ${tenant.companyName}` },
    description: `${tenant.companyName} — ${tenant.tagline}`,
    openGraph: {
      title: tenant.companyName,
      description: tenant.tagline,
    },
  };
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getStoreTenant();

  return (
    <div
      className="store-luxury flex min-h-dvh w-full min-w-0 flex-col overflow-x-clip bg-bg text-fg"
    >
      <StoreHeader tenant={tenant} />
      <main className="flex-1">{children}</main>
      <StoreFooter tenant={tenant} />
    </div>
  );
}
