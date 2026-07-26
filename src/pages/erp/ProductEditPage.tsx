import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { NativeSelect } from "@/components/ui/Select";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { BreadcrumbNav } from "@/components/ui/BreadcrumbNav";
import { FormField } from "@/components/ui/FormField";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/ActionsMenu";
import { ProductImages } from "@/components/media/ProductImages";
import { ProductStockCard } from "@/components/products/ProductStockCard";
import { AddToCartButton } from "@/components/pos/AddToCartButton";
import { ProductVehicleSection } from "@/components/products/ProductVehicleSection";
import { ProductNotesSection } from "@/components/products/ProductNotesSection";
import { FormSection } from "@/components/products/FormSection";
import { ProductLivePreviewCard } from "@/components/products/ProductLivePreviewCard";
import { ProductFormActionsCard } from "@/components/products/ProductFormActionsCard";
import { ProductEssentialsProgress } from "@/components/products/ProductEssentialsProgress";
import { useToast } from "@/context";
import {
  getProduct,
  updateProduct,
} from "@/lib/api/products";
import { getCategories } from "@/lib/api/categories";
import type {
  Product,
  ProductEditFormState,
} from "@/types/product";
import { formatCurrency } from "@/utils/format";
import {
  ShoppingBag,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import { CONDITIONS, AUTHENTICITY_OPTIONS } from "@/config/productOptions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function productToForm(p: Product): ProductEditFormState {
  return {
    title: p.title,
    description: p.description,
    price: p.price?.toString() ?? "",
    compare_price: p.compare_price?.toString() ?? "",
    cost_price: p.cost_price?.toString() ?? "",
    shipping_cost: p.shipping_cost?.toString() ?? "",
    is_taxable: p.is_taxable,
    sku: p.sku ?? "",
    barcode: p.barcode ?? "",
    brand: p.brand ?? "",
    mpn: p.mpn ?? "",
    condition: p.condition,
    authenticity: p.authenticity ?? "",
    vehicle_make: p.vehicle?.make ?? "",
    vehicle_model: p.vehicle?.model ?? "",
    vehicle_model_code: p.vehicle?.model_code ?? "",
    vehicle_year: p.vehicle?.year_from != null ? String(p.vehicle.year_from) : "",
    vehicle_year_to: p.vehicle?.year_to != null ? String(p.vehicle.year_to) : "",
    type: p.type,
    status: p.status,
    is_published_online: p.is_published_online,
    stock_control: p.stock_control,
    has_variants: p.has_variants,
    categories: p.categories?.map((c) => c._id) ?? [],
    tags: p.tags ?? [],
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
  fd.append("shipping_cost", form.shipping_cost || "");
  fd.append("is_taxable", String(form.is_taxable));
  fd.append("sku", form.sku);
  fd.append("barcode", form.barcode);
  fd.append("brand", form.brand);
  fd.append("mpn", form.mpn);
  fd.append("condition", form.condition);
  fd.append("authenticity", form.authenticity);
  fd.append(
    "vehicle",
    JSON.stringify({
      make: form.vehicle_make || null,
      model: form.vehicle_model || null,
      model_code: form.vehicle_model_code || null,
      year_from: form.vehicle_year ? Number(form.vehicle_year) : null,
      year_to: form.vehicle_year_to ? Number(form.vehicle_year_to) : null,
    }),
  );
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
  return fd;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ProductEditSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-24">
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

  const { data: categoriesRes } = useQuery({
    queryKey: ["categories", "all"],
    queryFn: () => getCategories({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });
  const categoryOptions = (categoriesRes?.data?.items ?? []).map((c) => ({
    value: c._id,
    label: c.name,
  }));

  useEffect(() => {
    if (product) {
      const f = productToForm(product);
      setForm(f);
      savedFormRef.current = JSON.stringify(f);
    }
  }, [product?._id]);

  const isDirty = form !== null && JSON.stringify(form) !== savedFormRef.current;

  const saveMutation = useMutation({
    mutationFn: (fd: FormData) => updateProduct(product!._id, fd),
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, tone: "danger" });
    },
  });

  // Immediate, independent of the main Save flow — mirrors the Products list's
  // publish/hide toggle. Also patches `form`/savedFormRef directly so the
  // in-progress edit's dirty-check doesn't go stale and a later Save doesn't
  // silently revert the status back.
  const statusMutation = useMutation({
    mutationFn: (status: Product["status"]) => {
      const fd = new FormData();
      fd.append("status", status);
      return updateProduct(product!._id, fd);
    },
    onSuccess: (_res, status) => {
      setForm((prev) => (prev ? { ...prev, status } : null));
      try {
        savedFormRef.current = JSON.stringify({ ...JSON.parse(savedFormRef.current), status });
      } catch {
        /* ignore — worst case isDirty is briefly wrong until next save */
      }
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", slug] });
      toast({ title: "Product marked as active", tone: "success" });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't update status", description: err.message, tone: "danger" });
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
    if (!form?.title.trim()) e.title = "Title is required";
    if (!form?.price || Number(form.price) <= 0) e.price = "Price is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!form || !product) return;
    if (!validate()) return;
    // Capture the snapshot now — onSuccess fires async and `form` may have
    // changed by then, causing the dirty check to silently clear unsaved edits.
    const snapshot = JSON.stringify(form);
    saveMutation.mutate(formToFD(form), {
      onSuccess: (res) => {
        savedFormRef.current = snapshot;
        queryClient.invalidateQueries({ queryKey: ["products"] });
        queryClient.invalidateQueries({ queryKey: ["listings"] });
        queryClient.invalidateQueries({ queryKey: ["variants", product?._id] });
        toast({ title: "Saved", tone: "success" });
        const newSlug = res.data?.slug;
        if (newSlug && newSlug !== slug) {
          // Slug changed: just navigate — don't touch the old query.
          // Removing it while the component is still subscribed causes RQ to
          // immediately refetch the now-dead URL. Leaving it in cache is safe:
          // it loses its subscriber on re-render and gets GC'd after gcTime.
          navigate(`/products/${newSlug}/edit`, { replace: true });
        } else {
          queryClient.invalidateQueries({ queryKey: ["product", slug] });
        }
      },
    });
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading || !product || !form) {
    return <ProductEditSkeleton />;
  }

  const showSetStockCard = form.stock_control && !form.has_variants;

  const essentials = [
    form.title.trim().length > 0,
    Number(form.price) > 0,
    form.categories.length > 0,
    form.images.length > 0,
  ];
  const essentialsCompleted = essentials.filter(Boolean).length;

  const priceNumber = Number(form.price) || 0;
  const costNumber = Number(form.cost_price) || 0;
  const hasMargin = priceNumber > 0 && form.cost_price !== "";
  const profitPerUnit = priceNumber - costNumber;
  const marginPct = hasMargin ? Math.round((profitPerUnit / priceNumber) * 100) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-24">

      {/* Sticky page header */}
      <div className="sticky top-0 z-30 -mx-6 border-b border-border bg-bg/95 px-6 py-3 backdrop-blur-sm">
        <BreadcrumbNav
          items={[
            { label: "Products", href: "/products" },
            { label: product.title },
          ]}
        />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <h1 className="truncate text-xl font-semibold tracking-tight">{product.title}</h1>
              </TooltipTrigger>
              <TooltipContent side="bottom">{product.title}</TooltipContent>
            </Tooltip>
            <p className="mt-0.5 truncate text-sm text-fg/45">/{product.slug}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ProductEssentialsProgress completed={essentialsCompleted} total={essentials.length} />
            {product.status === "active" ? (
              <Badge variant="ok" className="hidden sm:inline-flex">Active</Badge>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger className="hidden h-auto w-auto items-center gap-1 rounded-full px-0 py-0 text-fg/40 hover:bg-transparent hover:text-fg/40 data-[state=open]:bg-transparent data-[state=open]:text-fg/40 sm:inline-flex">
                  <Badge variant="muted" className="cursor-pointer">
                    Draft
                    <ChevronDown className="h-3 w-3" />
                  </Badge>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onSelect={() => statusMutation.mutate("active")}
                    disabled={statusMutation.isPending}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-fg/50" />
                    Active
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <AddToCartButton product={product} display="labeled" />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(`/listings/new?product=${product._id}&productSlug=${product.slug}`)}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              List on eBay
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!isDirty || saveMutation.isPending}
              onClick={handleSave}
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">

          {/* 1. Basics */}
          <FormSection number={1} title="Basics" tag={<span className="text-xs text-fg/40">Required</span>}>
            <FormField label="Product title" required error={errors.title}>
              <Input
                value={form.title}
                onChange={(e) => { set("title", e.target.value); clearError("title"); }}
                placeholder="Product title"
              />
            </FormField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField label="SKU">
                <Input
                  value={form.sku}
                  readOnly
                  disabled
                  placeholder="Not assigned"
                  className="cursor-not-allowed font-mono opacity-60"
                />
              </FormField>

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

              <FormField label="Manufacturer part number">
                <Input
                  value={form.mpn}
                  onChange={(e) => set("mpn", e.target.value)}
                  placeholder='e.g. 45022-TBC-A01'
                />
              </FormField>
            </div>

            <Switch
              checked={form.is_published_online}
              onCheckedChange={(v) => set("is_published_online", v)}
              label="Show on storefront"
              description="Visible to customers online as soon as it's created"
            />
          </FormSection>

          {/* 2. Classification & fitment */}
          <FormSection number={2} title="Classification & fitment">
            <FormField label="Categories">
              <MultiSelect
                options={categoryOptions}
                value={form.categories}
                onChange={(v) => set("categories", v)}
                placeholder="Add category…"
                searchPlaceholder="Search categories…"
              />
            </FormField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Condition">
                <NativeSelect
                  value={form.condition}
                  onChange={(e) => set("condition", e.target.value as ProductEditFormState["condition"])}
                >
                  {CONDITIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </NativeSelect>
              </FormField>

              <FormField label="Authenticity">
                <NativeSelect
                  value={form.authenticity}
                  onChange={(e) => set("authenticity", e.target.value as ProductEditFormState["authenticity"])}
                >
                  <option value="">Select authenticity…</option>
                  {AUTHENTICITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>

            <div className="border-t border-dashed border-border pt-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-semibold text-fg">Vehicle fitment</span>
                <Badge variant="muted">Optional</Badge>
              </div>
              <ProductVehicleSection
                values={{
                  vehicle_make: form.vehicle_make,
                  vehicle_model: form.vehicle_model,
                  vehicle_model_code: form.vehicle_model_code,
                  vehicle_year: form.vehicle_year,
                  vehicle_year_to: form.vehicle_year_to,
                }}
                onChange={(patch) => setForm((prev) => prev ? { ...prev, ...patch } : null)}
              />
            </div>
          </FormSection>

          {/* 3. Pricing */}
          <FormSection number={3} title="Pricing" tag={<span className="text-xs text-fg/40">All amounts in A$</span>}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField label="Retail price" required error={errors.price}>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => { set("price", e.target.value); clearError("price"); }}
                  placeholder="0.00"
                />
              </FormField>
              <FormField label="Cost price">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost_price}
                  onChange={(e) => set("cost_price", e.target.value)}
                  placeholder="0.00"
                />
              </FormField>
              <FormField label="Shipping cost">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.shipping_cost}
                  onChange={(e) => set("shipping_cost", e.target.value)}
                  placeholder="0.00"
                />
              </FormField>
            </div>

            <div className="flex flex-wrap items-center gap-4 rounded-xs border border-border bg-bg-2/40 px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-fg/40">Margin</p>
                <p className="mt-0.5 text-sm font-semibold text-fg">{hasMargin ? `${marginPct}%` : "—"}</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-fg/40">Profit per unit</p>
                <p className="mt-0.5 text-sm font-semibold text-fg">
                  {hasMargin ? formatCurrency(profitPerUnit) : "—"}
                </p>
              </div>
              {!hasMargin && (
                <p className="text-xs text-fg/45">Enter retail and cost to see live margin.</p>
              )}
            </div>
          </FormSection>

          {/* 4. Stock */}
          <FormSection
            number={4}
            title="Stock"
            description="Manage stock for your only location"
            tag={
              <Switch
                checked={form.stock_control}
                onCheckedChange={(v) => set("stock_control", v)}
                label="Track stock"
                className="border-none bg-transparent px-0 py-0"
              />
            }
          >
            {showSetStockCard && <ProductStockCard productId={product._id} />}
          </FormSection>

          {/* 5. Media */}
          <FormSection
            number={5}
            title="Media"
            description="First image is used as the product cover"
            tag={<Badge variant="outline">{form.images.length} {form.images.length === 1 ? "Image" : "Images"}</Badge>}
          >
            <ProductImages
              images={form.images}
              onChange={(imgs) => set("images", imgs)}
            />
          </FormSection>

          {/* 6. Internal notes */}
          <ProductNotesSection
            number={6}
            productId={product._id}
            slug={product.slug}
            notes={product.internal_notes}
          />

        </div>

        {/* Sidebar */}
        <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <ProductLivePreviewCard
            title={form.title}
            image={form.images[0]?.url}
            price={form.price}
            sku={form.sku}
            stockControl={form.stock_control}
            stockCount={product.stock_count}
          />
          <ProductFormActionsCard
            heading="Before you save"
            buttonLabel="Save changes"
            pendingLabel="Saving…"
            pending={saveMutation.isPending}
            disabled={!isDirty}
            onClick={handleSave}
          />
        </div>
      </div>
    </div>
  );
}
