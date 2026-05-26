import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { ProductImages } from "@/components/media/product-images";
import { ChoicesEditor } from "@/components/products/choices-editor";
import { VariantRow } from "@/components/products/variant-row";
import { SetStockDialogSimple } from "@/components/inventory/set-stock-dialog";
import { useToast } from "@/context";
import {
  getProduct,
  updateProduct,
  duplicateProduct,
  getVariants,
  getCategories,
} from "@/lib/api/products";
import type {
  Category,
  Product,
  ProductVariant,
  ProductEditFormState,
} from "@/types/product";

import { ArrowLeft, Copy } from "lucide-react";

function productToForm(p: Product): ProductEditFormState {
  return {
    title: p.title,
    description: p.description,
    price: p.price?.toString() ?? "",
    compare_price: p.compare_price?.toString() ?? "",
    cost_price: p.cost_price?.toString() ?? "",
    is_taxable: p.is_taxable,
    is_vat_inclusive: p.is_vat_inclusive,
    vat_rate: p.vat_rate?.toString() ?? "",
    sku: p.sku ?? "",
    barcode: p.barcode ?? "",
    brand: p.brand ?? "",
    type: String(p.type) as "1" | "2",
    status: String(p.status) as "0" | "1",
    is_published_online: p.is_published_online,
    stock_control: p.stock_control,
    has_variants: p.has_variants,
    categories: p.categories?.map((c) => c._id) ?? [],
    tags: p.tags?.join(", ") ?? "",
    images: p.attachments ?? [],
    choices: p.choices?.map((c) => ({ name: c.name, items: c.items })) ?? [],
  };
}

function formToFD(form: ProductEditFormState): FormData {
  const fd = new FormData();
  fd.append("title", form.title.trim());
  fd.append("description", form.description);
  fd.append("price", form.price || "0");
  fd.append("compare_price", form.compare_price || "");
  fd.append("cost_price", form.cost_price || "");
  fd.append("is_taxable", String(form.is_taxable));
  fd.append("is_vat_inclusive", String(form.is_vat_inclusive));
  if (form.vat_rate) fd.append("vat_rate", form.vat_rate);
  fd.append("sku", form.sku);
  fd.append("barcode", form.barcode);
  fd.append("brand", form.brand);
  fd.append("type", form.type);
  fd.append("status", form.status);
  fd.append("is_published_online", String(form.is_published_online));
  fd.append("stock_control", String(form.stock_control));
  fd.append("has_variants", String(form.has_variants));
  fd.append("categories", JSON.stringify(form.categories));
  fd.append(
    "tags",
    JSON.stringify(
      form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  );
  fd.append(
    "attachments",
    JSON.stringify(form.images.map((img) => img._id || img.id).filter(Boolean)),
  );
  fd.append("choices", JSON.stringify(form.choices));
  return fd;
}

export default function ProductEditPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: productData, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => getProduct(slug!),
    enabled: !!slug,
  });
  const product = productData?.data;

  const [form, setForm] = useState<ProductEditFormState | null>(null);
  const [setStockDialog, setSetStockDialog] = useState<{
    inventoryId: string;
    stock: number;
    label: string;
  } | null>(null);

  useEffect(() => {
    if (product) setForm(productToForm(product));
  }, [product?._id]);

  const { data: variantsData, refetch: refetchVariants } = useQuery({
    queryKey: ["variants", product?._id],
    queryFn: () => getVariants(product!._id),
    enabled: !!product?._id && !!product.has_variants,
  });
  const variants: ProductVariant[] = variantsData?.data ?? [];

  const { data: catData } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });
  const categories: Category[] = catData?.data ?? [];

  const saveMutation = useMutation({
    mutationFn: (fd: FormData) => updateProduct(product!._id, fd),
    onSuccess: (res) => {
      toast({ title: "Product saved", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["product", slug] });
      queryClient.invalidateQueries({ queryKey: ["variants", product?._id] });
      const newSlug = res.data?.slug;
      if (newSlug && newSlug !== slug) {
        navigate(`/products/${newSlug}/edit`, { replace: true });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, tone: "danger" });
    },
  });

  const dupMutation = useMutation({
    mutationFn: () => duplicateProduct(product!._id),
    onSuccess: (res) => {
      toast({ title: "Product duplicated", tone: "success" });
      const newSlug = res.data?.slug;
      if (newSlug) navigate(`/products/${newSlug}/edit`);
    },
    onError: (err: Error) => {
      toast({
        title: "Duplication failed",
        description: err.message,
        tone: "danger",
      });
    },
  });

  const set = <K extends keyof ProductEditFormState>(
    key: K,
    value: ProductEditFormState[K],
  ) => setForm((prev) => (prev ? { ...prev, [key]: value } : null));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !product) return;
    if (!form.title.trim()) {
      toast({ title: "Title is required", tone: "danger" });
      return;
    }
    saveMutation.mutate(formToFD(form));
  };

  if (isLoading || !product) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-fg/50">
        Loading product...
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => navigate("/products")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {product.title}
            </h1>
            <p className="mt-0.5 text-sm text-fg/50">/{product.slug}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={dupMutation.isPending}
          onClick={() => dupMutation.mutate()}
        >
          <Copy className="h-3.5 w-3.5" />
          Duplicate
        </Button>
      </div>

      <form
        onSubmit={handleSave}
        className="grid grid-cols-1 gap-5 lg:grid-cols-3"
      >
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Basic Information" />
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg/70">
                  Title <span className="text-danger">*</span>
                </label>
                <Input
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Product title"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg/70">
                  Description
                </label>
                <RichTextEditor
                  value={form.description}
                  onChange={(html) => set("description", html)}
                  placeholder="Describe your product..."
                  minHeight="140px"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Images"
              description="First image is used as the cover"
            />
            <CardContent>
              <ProductImages
                images={form.images}
                onChange={(imgs) => set("images", imgs)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Pricing" />
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(
                  [
                    { key: "price", label: "Price ($)" },
                    { key: "compare_price", label: "Compare at ($)" },
                    { key: "cost_price", label: "Cost price ($)" },
                  ] as const
                ).map(({ key, label }) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-xs font-medium text-fg/70">
                      {label}
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form[key]}
                      onChange={(e) => set(key, e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-fg/80">
                  <input
                    type="checkbox"
                    checked={form.is_taxable}
                    onChange={(e) => set("is_taxable", e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-accent"
                  />
                  Taxable
                </label>
                <label className="flex items-center gap-2 text-sm text-fg/80">
                  <input
                    type="checkbox"
                    checked={form.is_vat_inclusive}
                    onChange={(e) => set("is_vat_inclusive", e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-accent"
                  />
                  VAT inclusive
                </label>
              </div>
              {form.is_taxable && (
                <div className="max-w-30">
                  <label className="mb-1.5 block text-xs font-medium text-fg/70">
                    VAT Rate (%)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.vat_rate}
                    onChange={(e) => set("vat_rate", e.target.value)}
                    placeholder="10"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Organization" />
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-fg/70">
                    SKU
                  </label>
                  <Input
                    value={form.sku}
                    onChange={(e) => set("sku", e.target.value)}
                    placeholder="SKU-001"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-fg/70">
                    Barcode
                  </label>
                  <Input
                    value={form.barcode}
                    onChange={(e) => set("barcode", e.target.value)}
                    placeholder="EAN / UPC"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg/70">
                  Brand
                </label>
                <Input
                  value={form.brand}
                  onChange={(e) => set("brand", e.target.value)}
                  placeholder="Brand name"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Product Options"
              description="Add options like Size or Color to generate variants"
              right={
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.has_variants}
                    onChange={(e) => set("has_variants", e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-accent"
                  />
                  Has variants
                </label>
              }
            />
            {form.has_variants && (
              <CardContent>
                <ChoicesEditor
                  choices={form.choices}
                  onChange={(c) => set("choices", c)}
                />
              </CardContent>
            )}
          </Card>

          {product.has_variants && variants.length > 0 && (
            <Card>
              <CardHeader
                title="Variants"
                description={`${variants.length} variant${variants.length !== 1 ? "s" : ""}`}
              />
              <div className="divide-y divide-border">
                {variants.map((v) => (
                  <VariantRow
                    key={v._id}
                    variant={v}
                    productId={product._id}
                    onUpdate={() => {
                      refetchVariants();
                      queryClient.invalidateQueries({
                        queryKey: ["inventory"],
                      });
                    }}
                  />
                ))}
              </div>
            </Card>
          )}

          {product.stock_control && !product.has_variants && (
            <Card>
              <CardHeader
                title="Inventory"
                description="Stock is tracked. Manage per-location stock from the Inventory page."
              />
              <CardContent>
                <button
                  type="button"
                  className="text-xs text-accent underline underline-offset-2"
                  onClick={() => navigate("/inventory")}
                >
                  Go to Inventory →
                </button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Status" />
            <CardContent className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium text-fg/70">
                  Product Type
                </label>
                <div className="flex gap-2">
                  {[
                    { value: "1", label: "Physical" },
                    { value: "2", label: "Digital" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set("type", opt.value as "1" | "2")}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${
                        form.type === opt.value
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border bg-bg text-fg/60 hover:border-fg/20"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg/70">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => set("status", e.target.value as "0" | "1")}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-bg"
                >
                  <option value="0">Draft</option>
                  <option value="1">Active</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-fg/80">
                <input
                  type="checkbox"
                  checked={form.is_published_online}
                  onChange={(e) => set("is_published_online", e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-accent"
                />
                Published online
              </label>
              <label className="flex items-center gap-2 text-sm text-fg/80">
                <input
                  type="checkbox"
                  checked={form.stock_control}
                  onChange={(e) => set("stock_control", e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-accent"
                />
                Track stock
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Categories & Tags" />
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg/70">
                  Categories
                </label>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {categories.map((cat) => (
                    <label
                      key={cat._id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-bg-2"
                    >
                      <input
                        type="checkbox"
                        checked={form.categories.includes(cat._id)}
                        onChange={(e) =>
                          set(
                            "categories",
                            e.target.checked
                              ? [...form.categories, cat._id]
                              : form.categories.filter((id) => id !== cat._id),
                          )
                        }
                        className="h-4 w-4 rounded border-border accent-accent"
                      />
                      {cat.name}
                    </label>
                  ))}
                  {categories.length === 0 && (
                    <p className="text-xs text-fg/40">No categories yet</p>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg/70">
                  Tags <span className="text-fg/40">(comma-separated)</span>
                </label>
                <Input
                  value={form.tags}
                  onChange={(e) => set("tags", e.target.value)}
                  placeholder="spare part, engine"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="eBay" />
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-xs text-fg/60">Sync status</span>
                <Badge
                  variant={
                    product.ebay_sync_status === "synced"
                      ? "ok"
                      : product.ebay_sync_status === "pending"
                        ? "warn"
                        : product.ebay_sync_status === "error"
                          ? "danger"
                          : "muted"
                  }
                >
                  {product.ebay_sync_status}
                </Badge>
              </div>
              {product.ebay_synced_at && (
                <div className="mt-2 text-xs text-fg/40">
                  Last synced:{" "}
                  {new Date(product.ebay_synced_at).toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={saveMutation.isPending}
              className="w-full"
            >
              {saveMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-full"
              onClick={() => navigate("/products")}
            >
              Cancel
            </Button>
          </div>
        </div>
      </form>

      {setStockDialog && (
        <SetStockDialogSimple
          inventoryId={setStockDialog.inventoryId}
          currentStock={setStockDialog.stock}
          label={setStockDialog.label}
          onClose={() => setSetStockDialog(null)}
        />
      )}
    </div>
  );
}
