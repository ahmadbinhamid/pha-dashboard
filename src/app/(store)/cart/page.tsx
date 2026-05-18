import Link from "next/link";
import { StoreButton } from "@/components/store/ui/button";

export default function CartPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Cart</h1>
      <p className="mt-2 text-sm text-fg/65">Checkout will connect to your commerce / ERP layer later.</p>
      <div className="mt-10 rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-fg/65">
        Your cart is empty (placeholder).
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <StoreButton asChild>
          <Link href="/parts">Continue shopping</Link>
        </StoreButton>
        <StoreButton asChild variant="secondary">
          <Link href="/account">Sign in (placeholder)</Link>
        </StoreButton>
      </div>
    </div>
  );
}
