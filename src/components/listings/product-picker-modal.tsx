import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/modal";
import { getProducts } from "@/lib/api/products";
import { getListings } from "@/lib/api/listings";
import type { Product } from "@/types/product";
import { Search, Package } from "lucide-react";

interface ProductPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (product: Product) => void;
}

export function ProductPickerModal({ open, onClose, onSelect }: ProductPickerModalProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["products-picker", debouncedSearch],
    queryFn: () => getProducts({ search: debouncedSearch, page: 1 }),
    enabled: open,
  });

  const { data: listingsData } = useQuery({
    queryKey: ["listings-all-ids"],
    queryFn: () => getListings({ limit: 500 }),
    enabled: open,
  });

  const listedProductIds = new Set(
    (listingsData?.data?.items ?? [])
      .filter((l) => l.product != null)
      .map((l) =>
        typeof l.product === "string" ? l.product : (l.product as { _id: string })._id,
      ),
  );

  const products: Product[] = (data?.data?.items ?? []).filter(
    (p) => !listedProductIds.has(p._id),
  );

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>Select a product</ModalTitle>
          <ModalDescription>Choose the product this listing is for.</ModalDescription>
        </ModalHeader>

        <div className="px-6 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40 pointer-events-none" />
            <Input
              autoFocus
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto px-6 pb-4">
          {isLoading ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-bg-2" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Package className="h-8 w-8 text-fg/30" />
              <p className="text-sm text-fg/50">
                {debouncedSearch ? `No results for "${debouncedSearch}"` : "No products found"}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {products.map((p) => (
                <li key={p._id}>
                  <button
                    type="button"
                    onClick={() => onSelect(p)}
                    className="flex w-full items-center gap-3 py-3 text-left hover:opacity-80 transition-opacity"
                  >
                    <div className="h-9 w-9 shrink-0 rounded-xs bg-bg-2 overflow-hidden">
                      {p.attachments?.[0]?.url ? (
                        <img src={p.attachments[0].url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-4 w-4 text-fg/30" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">{p.title}</p>
                      <p className="text-xs text-fg/50">{p.sku ?? "No SKU"}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}
