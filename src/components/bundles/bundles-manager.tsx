
import { useMemo, useState } from "react";
import Link from "@/components/ui/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect as Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Icons } from "@/components/ui/icons";
import { useToast } from "@/context";
import { useInventoryData } from "@/context";
import { useBundles } from "@/context";
import type { Bundle, BundleItem } from "@/types";
import { useListingQueue } from "@/context";

function newId(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `bundle-${base || "new"}-${Date.now().toString(36)}`;
}

function clampQty(n: number) {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(999, Math.trunc(n)));
}

export function BundlesManager() {
  const { toast } = useToast();
  const { items: inventory } = useInventoryData();
  const { bundles, upsertBundle, deleteBundle } = useBundles();
  const { enqueue } = useListingQueue();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Bundle | null>(null);

  const [name, setName] = useState("");
  const [bundlePriceAud, setBundlePriceAud] = useState("");
  const [ebayTitle, setEbayTitle] = useState("");
  const [ebayCategory, setEbayCategory] = useState("");
  const [items, setItems] = useState<BundleItem[]>([{ sku: inventory[0]?.sku ?? "", qty: 1 }]);

  const skuOptions = useMemo(() => inventory.map((p) => ({ sku: p.sku, title: p.title })), [inventory]);

  const openNew = () => {
    setEditing(null);
    setName("");
    setBundlePriceAud("");
    setEbayTitle("");
    setEbayCategory("");
    setItems([{ sku: inventory[0]?.sku ?? "", qty: 1 }]);
    setOpen(true);
  };

  const openEdit = (b: Bundle) => {
    setEditing(b);
    setName(b.name);
    setBundlePriceAud(b.bundlePriceAud != null ? String(b.bundlePriceAud) : "");
    setEbayTitle(b.ebayTitle ?? "");
    setEbayCategory(b.ebayCategory ?? "");
    setItems(b.items.length ? b.items : [{ sku: inventory[0]?.sku ?? "", qty: 1 }]);
    setOpen(true);
  };

  const save = () => {
    if (!name.trim()) {
      toast({ tone: "warning", title: "Bundle name", description: "Give the bundle a name." });
      return;
    }
    const cleaned = items
      .map((i) => ({ sku: i.sku.trim(), qty: clampQty(i.qty) }))
      .filter((i) => i.sku);
    if (!cleaned.length) {
      toast({ tone: "warning", title: "Bundle items", description: "Add at least one SKU." });
      return;
    }
    const next: Bundle = {
      id: editing?.id ?? newId(name),
      name: name.trim(),
      items: cleaned,
      bundlePriceAud: bundlePriceAud.trim() ? Number(bundlePriceAud) : undefined,
      ebayTitle: ebayTitle.trim() || undefined,
      ebayCategory: ebayCategory.trim() || undefined,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    upsertBundle(next);
    setOpen(false);
    toast({ tone: "success", title: "Bundle saved", description: "Saved locally (demo)." });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold text-fg/55">
          <Link href="/inventory" className="hover:underline">
            Inventory
          </Link>{" "}
          / <span className="text-fg/75">Bundles</span>
        </div>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">Bundles</h1>
            <p className="mt-1 max-w-2xl text-sm text-fg/70">
              Create kits (multiple SKUs) for quick counter sales and channel listings.
            </p>
          </div>
          <Button size="sm" className="gap-2 self-start sm:self-auto" onClick={openNew}>
            <Icons.Plus className="h-4 w-4" />
            Create bundle
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader title="Bundle list" description="Saved in this browser for now (demo)." />
        <CardContent className="space-y-3">
          {bundles.length ? (
            bundles.map((b) => (
              <div
                key={b.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-bg px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{b.name}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge variant="outline">{b.items.length} item(s)</Badge>
                    {b.bundlePriceAud != null ? <Badge variant="ok">${b.bundlePriceAud.toFixed(2)} AUD</Badge> : null}
                    {b.ebayTitle ? <Badge variant="muted">eBay ready</Badge> : <Badge variant="outline">No eBay title</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(b)}>
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      enqueue({ type: "bundle", title: b.ebayTitle ?? b.name, refId: b.id });
                      toast({ tone: "success", title: "Queued for eBay", description: "Added to publish queue (demo)." });
                    }}
                  >
                    Queue eBay
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      deleteBundle(b.id);
                      toast({ tone: "default", title: "Bundle deleted", description: "Removed locally (demo)." });
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-border bg-bg-2/30 px-4 py-10 text-center text-sm text-fg/65">
              No bundles yet. Create one to sell kits at the counter.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "Edit bundle" : "Create bundle"}>
        <div className="space-y-5">
          <div>
            <div className="mb-2 text-xs font-semibold text-fg/70">Bundle name</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Basic Service Bundle" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-semibold text-fg/70">Bundle price (AUD, optional)</div>
              <Input value={bundlePriceAud} onChange={(e) => setBundlePriceAud(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold text-fg/70">eBay category (optional)</div>
              <Input value={ebayCategory} onChange={(e) => setEbayCategory(e.target.value)} placeholder="33559 — Automotive Filters" />
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-fg/70">eBay title (optional)</div>
            <Input value={ebayTitle} onChange={(e) => setEbayTitle(e.target.value)} placeholder="Bundle title for Motors search" />
          </div>

          <div className="rounded-xl border border-border bg-bg-2/30 p-4">
            <div className="text-xs font-semibold text-fg/60">Bundle items</div>
            <div className="mt-3 space-y-3">
              {items.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_44px] sm:items-center">
                  <Select
                    value={row.sku}
                    onChange={(e) =>
                      setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, sku: e.target.value } : r)))
                    }
                  >
                    {skuOptions.map((o) => (
                      <option key={o.sku} value={o.sku}>{o.sku} · {o.title}</option>
                    ))}
                  </Select>
                  <Input
                    value={String(row.qty)}
                    onChange={(e) =>
                      setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, qty: Number(e.target.value || 1) } : r)))
                    }
                    inputMode="numeric"
                    className="h-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-10 w-10 p-0"
                    onClick={() => setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))}
                    aria-label="Remove row"
                  >
                    <Icons.Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full gap-2"
                onClick={() => setItems((prev) => [...prev, { sku: inventory[0]?.sku ?? "", qty: 1 }])}
              >
                <Icons.Plus className="h-4 w-4" />
                Add SKU
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="flex-1" onClick={save}>
              Save bundle
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

