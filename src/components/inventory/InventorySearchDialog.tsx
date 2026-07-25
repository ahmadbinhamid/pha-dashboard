
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "@/hooks";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useInventoryData } from "@/context";
import {
  buildInventoryListUrl,
  inventoryFiltersFromSearchParams,
  type InventorySearchQuery,
} from "@/config/inventoryFilters";
import { InventorySearchFields } from "@/components/inventory/InventorySearchFields";

const EMPTY: InventorySearchQuery = {
  q: "",
  category: "",
  ebay: "all",
  make: "",
  model: "",
  year: "",
};

export function InventorySearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchParams] = useSearchParams();
  const { items: inventory } = useInventoryData();
  const [form, setForm] = useState<InventorySearchQuery>(EMPTY);

  const categories = useMemo(
    () => [...new Set(inventory.map((p) => p.category))].sort((a, b) => a.localeCompare(b)),
    [inventory],
  );

  useEffect(() => {
    if (!open) return;
    if (pathname.startsWith("/inventory")) {
      const f = inventoryFiltersFromSearchParams(searchParams);
      setForm({
        q: f.q,
        category: f.category,
        ebay: f.ebay,
        make: f.make,
        model: f.model,
        year: f.year,
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, pathname, searchParams]);

  function patch(p: Partial<InventorySearchQuery>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function submit() {
    const preserveTiles = pathname.startsWith("/inventory") && searchParams.get("view") === "tiles";
    router.push(
      buildInventoryListUrl({
        ...form,
        view: preserveTiles ? "tiles" : undefined,
      }),
    );
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Search inventory" anchor="left" bodyClassName="space-y-4">
      <p className="text-sm text-fg/65">
        Search your warehouse from anywhere. Results open on the inventory page with the same filters.
      </p>
      <InventorySearchFields value={form} onChange={patch} categories={categories} />
      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="button" variant="primary" className="gap-2" onClick={submit}>
          <Search className="h-4 w-4" />
          View results
        </Button>
        <Button type="button" variant="secondary" onClick={() => setForm(EMPTY)}>
          Clear
        </Button>
      </div>
    </Dialog>
  );
}
