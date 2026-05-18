import { getStoreTenant } from "@/lib/store/get-tenant";
import { ContactForm } from "@/components/store/contact-form";

export default async function ContactPage() {
  const tenant = await getStoreTenant();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Contact</h1>
      <p className="mt-2 text-sm text-fg/65">
        Reach {tenant.companyName} for parts lookup, fitment checks, or wholesale enquiries.
      </p>
      <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm text-fg/70">
          <span className="font-semibold text-fg">Email:</span> {tenant.supportEmail}
        </p>
        <p className="mt-2 text-sm text-fg/70">
          <span className="font-semibold text-fg">Phone:</span> {tenant.supportPhone}
        </p>
        <p className="mt-2 text-sm text-fg/70">
          <span className="font-semibold text-fg">Warehouse:</span> {tenant.defaultWarehouse}
        </p>
      </div>
      <div className="mt-8">
        <ContactForm />
      </div>
    </div>
  );
}
