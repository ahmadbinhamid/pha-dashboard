import { DEFAULT_STORE_TENANT } from "@/lib/store/tenant";
import { ContactForm } from "@/components/store/contact-form";

export default function ContactPage() {
  const tenant = DEFAULT_STORE_TENANT;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Get in touch</h1>
      <p className="mt-2 max-w-xl text-sm text-fg/60">
        Reach {tenant.companyName} for parts lookup, fitment checks, bulk pricing, or wholesale enquiries.
        We typically respond within one business day.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        {/* Form */}
        <ContactForm />

        {/* Info sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-fg">Contact details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-fg/50">Email</dt>
                <dd className="mt-0.5 text-fg/80">{tenant.supportEmail}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-fg/50">Phone</dt>
                <dd className="mt-0.5 text-fg/80">{tenant.supportPhone}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-fg/50">Warehouse / pick-up</dt>
                <dd className="mt-0.5 text-fg/80">{tenant.defaultWarehouse}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-fg">Business hours</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-fg/60">Mon – Fri</dt>
                <dd className="text-fg/80">8:00 am – 5:30 pm</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg/60">Saturday</dt>
                <dd className="text-fg/80">9:00 am – 2:00 pm</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg/60">Sunday</dt>
                <dd className="text-fg/80 italic">Closed</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
