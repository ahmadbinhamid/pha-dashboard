import Link from "next/link";
import { StoreButton } from "@/components/store/ui/button";

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
      <p className="mt-2 text-sm text-fg/65">
        Customer accounts, order history, and saved vehicles will authenticate against your backend later.
      </p>
      <div className="mt-10 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-fg/70">You’re not signed in (placeholder).</p>
        <div className="mt-6 flex justify-center gap-3">
          <StoreButton asChild variant="secondary">
            <Link href="/login">Staff login (ERP)</Link>
          </StoreButton>
          <StoreButton asChild>
            <Link href="/">Back to store</Link>
          </StoreButton>
        </div>
      </div>
    </div>
  );
}
