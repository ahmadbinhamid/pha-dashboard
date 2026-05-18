import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getStoreTenant } from "@/lib/store/get-tenant";
import { StoreHeader } from "@/components/store/store-header";
import { StoreFooter } from "@/components/store/store-footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-store-sans",
  display: "swap",
});

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
      className={`store-luxury store-root flex min-h-[100dvh] w-full min-w-0 flex-col overflow-x-clip bg-bg text-fg ${inter.variable}`}
    >
      <StoreHeader tenant={tenant} />
      <main className="flex-1">{children}</main>
      <StoreFooter tenant={tenant} />
    </div>
  );
}
