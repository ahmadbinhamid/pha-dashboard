import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { TagInput } from "@/components/ui/tag-input";
import { MultiSelect } from "@/components/ui/multi-select";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { FormField } from "@/components/ui/form-field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ProductImages } from "@/components/media/product-images";
import { ChoicesEditor } from "@/components/products/choices-editor";
import { VariantRow } from "@/components/products/variant-row";
import { ProductStockCard } from "@/components/products/product-stock-card";
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
  ProductType,
  ProductStatus,
} from "@/types/product";
import {
  Copy,
  RefreshCw,
  Save,
  Package2,
  Image,
  DollarSign,
  Layers,
  Tag,
  Boxes,
  ShoppingBag,
  Pencil,
} from "lucide-react";
import { getListings } from "@/lib/api/listings";
import type { EbayListing } from "@/types/marketplace";
import { cn } from "@/utils/cn";

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    type: p.type,
    status: p.status,
    is_published_online: p.is_published_online,
    stock_control: p.stock_control,
    has_variants: p.has_variants,
    categories: p.categories?.map((c) => c._id) ?? [],
    tags: p.tags ?? [],
    images: p.attachments ?? [],
    choices: p.choices?.map((c) => ({ name: c.name, items: c.items })) ?? [],
    ebay_category_id: p.ebay_category_id ?? "",
    ebay_condition: p.ebay_condition ?? "FOR_PARTS_OR_NOT_WORKING",
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
  fd.append("tags", JSON.stringify(form.tags));
  fd.append(
    "attachments",
    JSON.stringify(form.images.map((img) => img._id || img.id).filter(Boolean)),
  );
  fd.append("choices", JSON.stringify(form.choices));
  fd.append("ebay_category_id", form.ebay_category_id);
  fd.append("ebay_condition", form.ebay_condition);
  return fd;
}

function generateSku() {
  return "SKU-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-xs bg-accent/10">
        <Icon className="h-3.5 w-3.5 text-accent" />
      </div>
      <span>{children}</span>
    </div>
  );
}

// ── Channels card ─────────────────────────────────────────────────────────────
function ChannelsCard({ product }: { product: import("@/types/product").Product }) {
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["listings", { product: product._id }],
    queryFn: () => getListings({ product: product._id }),
  });

  const listings = (data?.data?.items ?? []) as EbayListing[];

  const STATUS_VARIANT: Record<string, "ok" | "warn" | "danger" | "muted"> = {
    synced: "ok", pending: "warn", error: "danger",
    not_listed: "muted", out_of_stock: "warn",
  };

  return (
    <Card>
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-xs bg-accent/10">
              <ShoppingBag className="h-3.5 w-3.5 text-accent" />
            </div>
            <span>Channels</span>
          </div>
        }
      />
      <CardContent className="space-y-3">
        {listings.length === 0 ? (
          <p className="text-xs text-fg/50">No channel listings yet.</p>
        ) : (
          <ul className="space-y-2">
            {listings.map((l) => (
              <li key={l._id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium capitalize text-fg">{l.platform}</span>
                  <Badge variant={STATUS_VARIANT[l.sync_status] ?? "muted"} className="text-[10px]">
                    {l.sync_status.replace("_", " ")}
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/listings/${l._id}/edit`)}
                  className="shrink-0 rounded p-1 text-fg/40 hover:text-fg transition-colors"
                  title="Edit listing"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => navigate(`/listings/new?product=${product._id}&productSlug=${product.slug}`)}
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          List on eBay
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ProductEditSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-24">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-5 lg:col-span-2">
          {[180, 120, 100].map((h, i) => (
            <div key={i} className="rounded-xs border border-border bg-card p-5 space-y-4">
              <Skeleton className="h-4 w-36" />
              <Skeleton className={`h-${h === 180 ? 10 : 10} w-full`} />
              {h === 180 && <Skeleton className="h-32 w-full" />}
            </div>
          ))}
        </div>
        {/* Sidebar */}
        <div className="space-y-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xs border border-border bg-card p-5 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const savedFormRef = useRef<string>("");

  useEffect(() => {
    if (product) {
      const f = productToForm(product);
      setForm(f);
      savedFormRef.current = JSON.stringify(f);
    }
  }, [product?._id]);

  const isDirty = form !== null && JSON.stringify(form) !== savedFormRef.current;

  const { data: variantsData, refetch: refetchVariants } = useQuery({
    queryKey: ["variants", product?._id],
    queryFn: () => getVariants(product!._id),
    enabled: !!product?._id,
  });
  const variants: ProductVariant[] = variantsData?.data ?? [];

  const { data: catData } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });
  const categories: Category[] = catData?.data ?? [];
  const categoryOptions = categories.map((c) => ({ value: c._id, label: c.name }));

  const saveMutation = useMutation({
    mutationFn: (fd: FormData) => updateProduct(product!._id, fd),
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, tone: "danger" });
    },
  });

  const dupMutation = useMutation({
    mutationFn: () => duplicateProduct(product!._id),
    onSuccess: (res) => {
      toast({ title: "Duplicated", tone: "success" });
      const newSlug = res.data?.slug;
      if (newSlug) navigate(`/products/${newSlug}/edit`);
    },
    onError: (err: Error) => {
      toast({ title: "Duplication failed", description: err.message, tone: "danger" });
    },
  });

  const set = <K extends keyof ProductEditFormState>(
    key: K,
    value: ProductEditFormState[K],
  ) => setForm((prev) => (prev ? { ...prev, [key]: value } : null));

  const clearError = (key: string) =>
    setErrors((p) => { const n = { ...p }; delete n[key]; return n; });

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form?.title.trim()) e.title = "Name is required";
    if (!form?.price || Number(form.price) <= 0) e.price = "Price is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form || !product) return;
    if (!validate()) return;
    // Capture the snapshot now — onSuccess fires async and `form` may have
    // changed by then, causing the dirty check to silently clear unsaved edits.
    const snapshot = JSON.stringify(form);
    saveMutation.mutate(formToFD(form), {
      onSuccess: (res) => {
        savedFormRef.current = snapshot;
        queryClient.invalidateQueries({ queryKey: ["product", slug] });
        queryClient.invalidateQueries({ queryKey: ["variants", product?._id] });
        toast({ title: "Saved", tone: "success" });
        const newSlug = res.data?.slug;
        if (newSlug && newSlug !== slug) {
          navigate(`/products/${newSlug}/edit`, { replace: true });
        }
      },
    });
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading || !product || !form) {
    return <ProductEditSkeleton />;
  }

  const showSetStockCard = form.stock_control && !form.has_variants;
  const showVariants = form.has_variants && variants.length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-24">

      {/* Sticky page header */}
      <div className="sticky top-0 z-30 -mx-6 border-b border-border bg-bg/95 px-6 py-3 backdrop-blur-sm">
        <BreadcrumbNav
          items={[
            { label: "Products", href: "/products" },
            { label: product.title },
          ]}
        />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{product.title}</h1>
            <p className="mt-0.5 text-sm text-fg/45">/{product.slug}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={product.status === "active" ? "ok" : "muted"} className="hidden sm:inline-flex">
              {product.status === "active" ? "Active" : "Draft"}
            </Badge>
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
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="gap-1.5"
              disabled={!isDirty || saveMutation.isPending}
              onClick={() => handleSave()}
            >
              <Save className="h-3.5 w-3.5" />
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSave}
        className="grid grid-cols-1 gap-5 lg:grid-cols-3"
      >
        {/* ── Main Column ── */}
        <div className="space-y-5 lg:col-span-2">

          {/* Basic Info */}
          <Card>
            <CardHeader title={<SectionLabel icon={Package2}>Basic Information</SectionLabel>} />
            <CardContent className="space-y-4">
              <FormField label="Name" required error={errors.title}>
                <Input
                  value={form.title}
                  onChange={(e) => { set("title", e.target.value); clearError("title"); }}
                  placeholder="Product name"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                {/* SKU */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-fg/65">SKU</label>
                    <span className="text-[10px] tabular-nums text-fg/35">{form.sku.length}/64</span>
                  </div>
                  <div className="flex gap-1.5">
                    <Input
                      value={form.sku}
                      onChange={(e) => set("sku", e.target.value)}
                      placeholder="e.g. PART-001"
                      maxLength={64}
                    />
                    <button
                      type="button"
                      title="Generate SKU"
                      onClick={() => set("sku", generateSku())}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xs border border-border bg-bg text-fg/45 shadow-sm transition hover:text-fg"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Barcode */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-fg/65">Barcode</label>
                    <span className="text-[10px] tabular-nums text-fg/35">{form.barcode.length}/13</span>
                  </div>
                  <Input
                    value={form.barcode}
                    onChange={(e) => set("barcode", e.target.value)}
                    placeholder="EAN / UPC"
                    maxLength={13}
                  />
                </div>
              </div>

              <FormField label="Description">
                <RichTextEditor
                  value={form.description}
                  onChange={(html) => set("description", html)}
                  placeholder="Describe your product…"
                  minHeight="140px"
                />
              </FormField>
            </CardContent>
          </Card>

          {/* Media */}
          <Card>
            <CardHeader
              title={<SectionLabel icon={Image}>Media</SectionLabel>}
              description="First image is used as the product cover"
            />
            <CardContent>
              <ProductImages
                images={form.images}
                onChange={(imgs) => set("images", imgs)}
              />
              {form.images.length === 0 && (
                <p className="mt-3 text-xs text-fg/40">
                  Tip: high-quality images from multiple angles increase conversion.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader title={<SectionLabel icon={DollarSign}>Pricing</SectionLabel>} />
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Price (£)" required error={errors.price}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => { set("price", e.target.value); clearError("price"); }}
                    placeholder="0.00"
                  />
                </FormField>
                {(
                  [
                    { key: "compare_price", label: "Compare at (£)" },
                    { key: "cost_price", label: "Cost price (£)" },
                  ] as const
                ).map(({ key, label }) => (
                  <FormField key={key} label={label}>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form[key]}
                      onChange={(e) => set(key, e.target.value)}
                      placeholder="0.00"
                    />
                  </FormField>
                ))}
              </div>

              <Switch
                checked={form.is_taxable}
                onCheckedChange={(v) => set("is_taxable", v)}
                label="Taxable"
                description="Charge tax on this product"
              />

              {form.is_taxable && (
                <div className="grid grid-cols-2 gap-3">
                  <Switch
                    checked={form.is_vat_inclusive}
                    onCheckedChange={(v) => set("is_vat_inclusive", v)}
                    label="VAT inclusive"
                    description="Price already includes VAT"
                  />
                  <FormField label="VAT Rate (%)">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={form.vat_rate}
                      onChange={(e) => set("vat_rate", e.target.value)}
                      placeholder="20"
                    />
                  </FormField>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inventory */}
          <Card>
            <CardHeader title={<SectionLabel icon={Boxes}>Inventory</SectionLabel>} />
            <CardContent>
              <Switch
                checked={form.stock_control}
                onCheckedChange={(v) => set("stock_control", v)}
                label="Track stock"
                description="Manage inventory levels and get low-stock alerts"
              />
            </CardContent>
          </Card>

          {/* Set Stock */}
          {showSetStockCard && (
            <Card>
              <CardHeader
                title={<SectionLabel icon={Layers}>Set Stock</SectionLabel>}
                description="Manage stock levels per location"
              />
              <CardContent>
                <ProductStockCard productId={product._id} />
              </CardContent>
            </Card>
          )}

          {/* Choices */}
          <Card>
            <CardHeader
              title={<SectionLabel icon={Tag}>Choices</SectionLabel>}
              description="Add options like Size or Color to generate variants"
              right={
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.has_variants}
                    onChange={(e) => set("has_variants", e.target.checked)}
                    className="h-4 w-4 rounded-xs border-border accent-accent"
                  />
                  Has variants
                </label>
              }
            />
            <CardContent>
              <ChoicesEditor
                choices={form.choices}
                onChange={(c) => set("choices", c)}
              />
            </CardContent>
          </Card>

          {/* Variant Combinations */}
          {form.has_variants && (
            <Card>
              <CardHeader
                title={
                  <SectionLabel icon={Layers}>
                    Variant Combinations
                  </SectionLabel>
                }
                description={
                  showVariants
                    ? `${variants.length} variant${variants.length !== 1 ? "s" : ""} · save choices above then refresh to update`
                    : "No variants yet — add choices above and save to generate"
                }
              />
              {showVariants ? (
                <div className="divide-y divide-border">
                  {variants.map((v) => (
                    <VariantRow
                      key={v._id}
                      variant={v}
                      productId={product._id}
                      onUpdate={() => {
                        refetchVariants();
                        queryClient.invalidateQueries({ queryKey: ["inventory"] });
                      }}
                    />
                  ))}
                </div>
              ) : (
                <CardContent>
                  <p className="text-sm text-fg/45">
                    No variants yet. Add choices above to generate variants.
                  </p>
                </CardContent>
              )}
            </Card>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-5">

          {/* Status */}
          <Card>
            <CardHeader title="Status" />
            <CardContent className="space-y-4">
              {/* Product Type */}
              <div>
                <p className="mb-2 text-xs font-medium text-fg/65">Product Type</p>
                <div className="flex gap-2">
                  {(
                    [
                      { value: "physical", label: "Physical" },
                      { value: "digital", label: "Digital" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set("type", opt.value as ProductType)}
                      className={cn(
                        "flex-1 rounded-xs border py-2 text-sm font-medium transition",
                        form.type === opt.value
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-fg/55 hover:border-fg/25 hover:text-fg",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status dropdown */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg/65">
                  Product Status
                </label>
                <Select
                  value={form.status}
                  onValueChange={(v) => set("status", v as ProductStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Published toggle */}
              <Switch
                checked={form.is_published_online}
                onCheckedChange={(v) => set("is_published_online", v)}
                label="Published Online"
                description="Visible on your storefront"
              />
            </CardContent>
          </Card>

          {/* Organisation */}
          <Card>
            <CardHeader title="Organisation" />
            <CardContent className="space-y-4">
              {/* Categories */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg/65">
                  Categories
                </label>
                <MultiSelect
                  options={categoryOptions}
                  value={form.categories}
                  onChange={(v) => set("categories", v)}
                  placeholder="Select categories…"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg/65">
                  Tags
                </label>
                <TagInput
                  value={form.tags}
                  onChange={(tags) => set("tags", tags)}
                  placeholder="Add tags…"
                />
                <p className="mt-1 text-[10px] text-fg/40">
                  Press Enter or comma to add
                </p>
              </div>

              {/* Brand */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg/65">
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

          {/* Channels */}
          <ChannelsCard product={product} />

        </div>
      </form>
    </div>
  );
}
