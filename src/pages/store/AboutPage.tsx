import { DEFAULT_STORE_TENANT } from "@/lib/store/tenant";

export default function AboutPage() {
  const tenant = DEFAULT_STORE_TENANT;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">About us</h1>
      <p className="mt-4 text-sm leading-relaxed text-fg/75">
        {tenant.companyName} is building a modern automotive parts supply experience — from warehouse accuracy to
        storefront clarity. We deal in <strong>new</strong> and <strong>genuine used</strong> auto parts across
        European and Japanese marques, with enterprise inventory tooling behind the scenes.
      </p>
      <p className="mt-4 text-sm leading-relaxed text-fg/75">
        This public site is designed as a white-label ready layer: branding, themes, and tenant configuration can be
        driven from your ERP and multi-tenant platform later — without rewriting the UI architecture.
      </p>
    </div>
  );
}
