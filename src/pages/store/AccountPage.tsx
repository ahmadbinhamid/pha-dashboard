export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">My account</h1>
      <p className="mt-2 text-sm text-fg/60">
        Customer accounts, order history, and saved vehicles will be enabled once the backend is connected.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-card p-8">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-bg-2 ring-1 ring-border">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-fg/30" aria-hidden>
              <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-fg">Not signed in</p>
            <p className="mt-0.5 text-xs text-fg/50">
              Authentication will be handled by the Node.js backend.
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: "Order history", description: "Track your past orders" },
            { label: "Saved vehicles", description: "Store your vehicle profiles" },
            { label: "Wishlist", description: "Save parts for later" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-border bg-bg-2/40 p-4"
            >
              <p className="text-sm font-medium text-fg/70">{item.label}</p>
              <p className="mt-0.5 text-xs text-fg/40">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
