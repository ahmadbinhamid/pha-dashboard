"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { useInventory } from "@/components/inventory/inventory-store";
import { buildInventoryListUrl, type InventorySearchQuery } from "@/lib/inventory-list-url";
import { InventorySearchFields } from "@/components/inventory/inventory-search-fields";

const EMPTY: InventorySearchQuery = {
  q: "",
  category: "",
  ebay: "all",
  make: "",
  model: "",
  year: "",
};

export function DashboardCounterSearch() {
  const router = useRouter();
  const { items: inventory } = useInventory();

  const [form, setForm] = useState<InventorySearchQuery>(EMPTY);

  const categories = useMemo(
    () => [...new Set(inventory.map((p) => p.category))].sort((a, b) => a.localeCompare(b)),
    [inventory],
  );

  function patch(p: Partial<InventorySearchQuery>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function submit() {
    router.push(buildInventoryListUrl(form));
  }

  return (
    <Card>
      <CardHeader
        title="Search inventory"
        description="Keyword plus make, model, and model-year fitment. Same search is available from the header on every page."
      />
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg/40">
              <Icons.Search />
            </span>
            <Input
              value={form.q}
              onChange={(e) => patch({ q: e.target.value })}
              className="h-11 pl-11 text-[15px]"
              placeholder="Search title, SKU, category, or product ID…"
              aria-label="Inventory search"
            />
          </div>

          <InventorySearchFields value={form} onChange={patch} categories={categories} showQueryField={false} />

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="primary" size="md" className="gap-2">
              <Icons.Search className="h-4 w-4" />
              Open in inventory
            </Button>
            <Button type="button" variant="secondary" size="md" onClick={() => setForm(EMPTY)}>
              Clear
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
