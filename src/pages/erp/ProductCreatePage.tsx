import { useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { NativeSelect } from "@/components/ui/Select";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { BreadcrumbNav } from "@/components/ui/BreadcrumbNav";
import { FormField } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import { ProductImages } from "@/components/media/ProductImages";
import { CreateStockSection } from "@/components/products/CreateStockSection";
import { CreateProductNotesSection } from "@/components/products/CreateProductNotesSection";
import { ProductVehicleSection } from "@/components/products/ProductVehicleSection";
import { FormSection } from "@/components/products/FormSection";
import { ProductLivePreviewCard } from "@/components/products/ProductLivePreviewCard";
import { ProductEssentialsProgress } from "@/components/products/ProductEssentialsProgress";
import { useToast } from "@/context";
import { createProduct, addProductNote } from "@/lib/api/products";
import { getCategories } from "@/lib/api/categories";
import type { ProductStatus, StockEntry } from "@/types/product";
import { formatCurrency } from "@/utils/format";
import { CONDITIONS, AUTHENTICITY_OPTIONS } from "@/config/productOptions";
import { productCreateFormSchema, type ProductCreateFormValues } from "@/lib/validation/product";

const INITIAL: ProductCreateFormValues = {
  title: "",
  description: "",
  price: "",
  compare_price: "",
  cost_price: "",
  shipping_cost: "",
  is_taxable: false,
  barcode: "",
  // New products track stock (starting at 0) by default, rather than
  // silently landing in the untracked "stock_count: null" state.
  stock_control: true,
  stock_entries: [],
  mpn: "",
  condition: "NEW",
  authenticity: "",
  vehicle_make: "",
  vehicle_model: "",
  vehicle_model_code: "",
  vehicle_year: "",
  vehicle_year_to: "",
  type: "physical",
  status: "active",
  is_published_online: true,
  categories: [],
  tags: [],
  images: [],
  notes: [],
};

function formToFD(form: ProductCreateFormValues, status: ProductStatus): FormData {
  const fd = new FormData();
  fd.append("title", form.title.trim());
  fd.append("description", form.description);
  fd.append("price", form.price || "0");
  if (form.compare_price) fd.append("compare_price", form.compare_price);
  if (form.cost_price) fd.append("cost_price", form.cost_price);
  if (form.shipping_cost) fd.append("shipping_cost", form.shipping_cost);
  fd.append("is_taxable", String(form.is_taxable));
  fd.append("barcode", form.barcode);
  fd.append("stock_control", String(form.stock_control));
  if (form.mpn) fd.append("mpn", form.mpn.trim());
  fd.append("condition", form.condition);
  if (form.authenticity) fd.append("authenticity", form.authenticity);
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
  if (form.stock_control && form.stock_entries.length > 0) {
    fd.append("stock_entries", JSON.stringify(form.stock_entries));
  }
  fd.append("type", form.type);
  fd.append("status", status);
  fd.append("is_published_online", String(form.is_published_online));
  fd.append("categories", JSON.stringify(form.categories));
  fd.append("tags", JSON.stringify(form.tags));
  fd.append(
    "attachments",
    JSON.stringify(form.images.map((img) => img._id || img.id).filter(Boolean)),
  );
  return fd;
}

export default function ProductCreatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductCreateFormValues>({
    resolver: zodResolver(productCreateFormSchema),
    defaultValues: INITIAL,
  });

  const form = watch();
  // Notes are drafted before the product exists (addProductNote needs a
  // productId, which doesn't exist yet) — captured here right before
  // mutate() so onSuccess can post them once creation succeeds, without
  // relying on react-query's onMutate-only `context` mechanism.
  const pendingNotesRef = useRef<string[]>([]);
  const [imagesUploading, setImagesUploading] = useState(false);

  const { data: categoriesRes } = useQuery({
    queryKey: ["categories", "all"],
    queryFn: () => getCategories({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });
  const categoryOptions = (categoriesRes?.data?.items ?? []).map((c) => ({
    value: c._id,
    label: c.name,
  }));

  const mutation = useMutation({
    mutationFn: (fd: FormData) => createProduct(fd),
    onSuccess: async (res) => {
      const productId = res.data?._id;
      const notes = pendingNotesRef.current;
      if (productId && notes.length > 0) {
        await Promise.allSettled(notes.map((text) => addProductNote(productId, text)));
      }
      toast({ title: "Product created", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      const slug = res.data?.slug;
      navigate(slug ? `/products/${slug}/edit` : "/products");
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to create product",
        description: err.message,
        tone: "danger",
      });
    },
  });

  const submitProduct = (values: ProductCreateFormValues, status: ProductStatus) => {
    pendingNotesRef.current = values.notes;
    mutation.mutate(formToFD(values, status));
  };

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
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 -mx-6 border-b border-border bg-bg/95 px-6 py-3 backdrop-blur-sm">
        <BreadcrumbNav
          items={[
            { label: "Products", href: "/products" },
            { label: "New product" },
          ]}
        />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">New product</h1>
            <p className="mt-0.5 text-sm text-fg/50">
              SKU generates on save · variants can be added after creating
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ProductEssentialsProgress completed={essentialsCompleted} total={essentials.length} />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={mutation.isPending || imagesUploading}
              onClick={() => handleSubmit((values) => submitProduct(values, "draft"))()}
            >
              Save draft
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={mutation.isPending || imagesUploading}
              onClick={() => handleSubmit((values) => submitProduct(values, "active"))()}
            >
              {mutation.isPending ? "Creating…" : imagesUploading ? "Uploading images…" : "Create product"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">

          {/* 1. Basics */}
          <FormSection number={1} title="Basics" tag={<span className="text-xs text-fg/40">Required</span>}>
            <FormField label="Product title" required error={errors.title?.message}>
              <Input {...register("title")} placeholder="e.g. Front brake pad set — ceramic" autoFocus />
            </FormField>
            <p className="-mt-2.5 text-xs text-fg/45">
              Include the part type and a key spec — it's what staff search for at the till.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-fg/65">Barcode</label>
                  <span className="text-[10px] tabular-nums text-fg/35">{form.barcode.length}/13</span>
                </div>
                <Input {...register("barcode")} placeholder="Scan or type EAN / UPC" maxLength={13} />
              </div>

              <FormField label="Manufacturer part number">
                <Input {...register("mpn")} placeholder='e.g. 45022-TBC-A01' />
              </FormField>
            </div>

            <Controller
              control={control}
              name="is_published_online"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  label="Show on storefront"
                  description="Visible to customers online as soon as it's created"
                />
              )}
            />
          </FormSection>

          {/* 2. Classification & fitment */}
          <FormSection number={2} title="Classification & fitment">
            <FormField label="Categories">
              <Controller
                control={control}
                name="categories"
                render={({ field }) => (
                  <MultiSelect
                    options={categoryOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Add category…"
                    searchPlaceholder="Search categories…"
                  />
                )}
              />
            </FormField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Condition">
                <NativeSelect {...register("condition")}>
                  {CONDITIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </NativeSelect>
              </FormField>

              <FormField label="Authenticity">
                <NativeSelect {...register("authenticity")}>
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
                onChange={(patch) => {
                  for (const [key, value] of Object.entries(patch)) {
                    setValue(key as keyof ProductCreateFormValues, value as never, { shouldValidate: true });
                  }
                }}
                yearRangeError={errors.vehicle_year_to?.message}
              />
            </div>
          </FormSection>

          {/* 3. Pricing */}
          <FormSection number={3} title="Pricing" tag={<span className="text-xs text-fg/40">All amounts in A$</span>}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField label="Retail price" required error={errors.price?.message}>
                <Input type="number" min="0" step="0.01" {...register("price")} placeholder="0.00" />
              </FormField>
              <FormField label="Cost price" error={errors.cost_price?.message}>
                <Input type="number" min="0" step="0.01" {...register("cost_price")} placeholder="0.00" />
              </FormField>
              <FormField label="Shipping cost" error={errors.shipping_cost?.message}>
                <Input type="number" min="0" step="0.01" {...register("shipping_cost")} placeholder="0.00" />
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
            description="Opening quantity for your only stock location"
            tag={
              <Controller
                control={control}
                name="stock_control"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={(v) => {
                      field.onChange(v);
                      if (!v) setValue("stock_entries", []);
                    }}
                    label="Track stock"
                    className="border-none bg-transparent px-0 py-0"
                  />
                )}
              />
            }
          >
            {form.stock_control && (
              <Controller
                control={control}
                name="stock_entries"
                render={({ field }) => (
                  <CreateStockSection entries={field.value} onChange={field.onChange} />
                )}
              />
            )}
          </FormSection>

          {/* 5. Media */}
          <FormSection
            number={5}
            title="Media"
            description="First image becomes the cover"
            tag={<Badge variant="outline">{form.images.length} {form.images.length === 1 ? "Image" : "Images"}</Badge>}
          >
            <Controller
              control={control}
              name="images"
              render={({ field }) => (
                <ProductImages images={field.value} onChange={field.onChange} onUploadingChange={setImagesUploading} />
              )}
            />
          </FormSection>

          {/* 6. Internal notes */}
          <FormSection number={6} title="Internal notes" description="Staff only — never shown to customers">
            <Controller
              control={control}
              name="notes"
              render={({ field }) => <CreateProductNotesSection notes={field.value} onChange={field.onChange} />}
            />
          </FormSection>

        </div>

        {/* Sidebar */}
        <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <ProductLivePreviewCard
            title={form.title}
            image={form.images[0]?.url}
            price={form.price}
            skuPending
            stockControl={form.stock_control}
            stockCount={form.stock_entries.reduce((sum: number, e: StockEntry) => sum + e.qty, 0)}
          />
        </div>
      </div>
    </div>
  );
}
