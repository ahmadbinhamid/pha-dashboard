"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StoreInput } from "@/components/store/ui/input";
import { StoreButton } from "@/components/store/ui/button";

export function StoreHeaderClient() {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch"
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        router.push(`/search?${params.toString()}`);
      }}
    >
      <StoreInput
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by part name, SKU, vehicle, VIN…"
        className="h-10 flex-1 border-white/10 bg-surface/90 text-fg placeholder:text-fg/40 focus-visible:ring-accent"
        aria-label="Search catalog"
      />
      <StoreButton type="submit" size="sm" className="h-10 w-full shrink-0 sm:h-10 sm:w-auto">
        Search
      </StoreButton>
    </form>
  );
}
