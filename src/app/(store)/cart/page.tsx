import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review your cart and proceed to checkout.",
};

export default function CartPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Your cart</h1>
      <p className="mt-2 text-sm text-fg/60">
        Checkout and payment will be enabled once the backend is connected.
      </p>

      <div className="mt-8 rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <svg
          viewBox="0 0 48 48"
          fill="none"
          className="mx-auto h-12 w-12 text-fg/20"
          aria-hidden
        >
          <path d="M10 10h28l-4 18H14L10 10Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
          <path d="M10 10 8 4H4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="18" cy="40" r="3" stroke="currentColor" strokeWidth="2.5"/>
          <circle cx="34" cy="40" r="3" stroke="currentColor" strokeWidth="2.5"/>
        </svg>
        <p className="mt-4 text-sm font-medium text-fg/60">Your cart is empty</p>
        <p className="mt-1 text-xs text-fg/40">Checkout will connect to the Node.js backend later.</p>
      </div>

      <div className="mt-8">
        <Button asChild>
          <Link href="/parts">Browse parts catalogue</Link>
        </Button>
      </div>
    </div>
  );
}
