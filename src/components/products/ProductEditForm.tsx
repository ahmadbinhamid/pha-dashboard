import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CopyField } from "@/components/ui/CopyField";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { NativeSelect } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { ProductChannelChip } from "@/components/products/ProductChannelChip";
import { ProductEditHeader } from "@/components/products/ProductEditHeader";
import { ProductEssentialsCard, type EssentialItem } from "@/components/products/ProductEssentialsCard";
import { ProductFitmentGroup } from "@/components/products/ProductFitmentGroup";
import { ProductFormGroup } from "@/components/products/ProductFormGroup";
import { ProductMarginStrip } from "@/components/products/ProductMarginStrip";
import { ProductMediaPreviewCard, PRODUCT_MEDIA_ANCHOR } from "@/components/products/ProductMediaPreviewCard";
import { ProductNotesSection } from "@/components/products/ProductNotesSection";
import { ProductSalesChannelsSection } from "@/components/products/ProductSalesChannelsSection";
import { ProductStockField } from "@/components/products/ProductStockField";
import { SendProductEmailModal } from "@/components/products/SendProductEmailModal";
import { PRODUCT_EDIT_TABS, SALES_CHANNELS_ANCHOR, type ProductEditTab } from "@/config/salesChannels";
import { CONDITIONS, AUTHENTICITY_OPTIONS } from "@/config/productOptions";
import { useToast } from "@/context";
import { useProductChannelListings } from "@/hooks/useProductChannelListings";
import { updateProduct } from "@/lib/api/products";
import { productEditFormSchema, type ProductEditFormValues } from "@/lib/validation/product";
import type { Product, ProductCondition } from "@/types/product";

// Product fields a channel payload reads; editing any triggers a re-sync.
const SYNCED_FIELDS: (keyof ProductEditFormValues)[] = ["title", "description", "price", "brand", "mpn", "condition", "images"];

const CATEGORIES_FIELD_ID = "product-categories";

function productToForm(p: Product): ProductEditFormValues {
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
    has_variants: p.has_variants,
    categories: p.categories?.map((c) => c._id) ?? [],
    tags: p.tags ?? [],
    images: p.attachments ?? [],
    choices: p.choices?.map((c) => ({ name: c.name, items: c.items })) ?? [],
  };
}

function formToFD(form: ProductEditFormValues): FormData {
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
  // Stock is always tracked — no "track stock" toggle in the UI.
  fd.append("stock_control", "true");
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

export function ProductEditForm({
  product,
  slug,
  categoryOptions,
}: {
  product: Product;
  slug: string;
  categoryOptions: { value: string; label: string }[];
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [imagesUploading, setImagesUploading] = useState(false);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);
  // Last synced-field save; rows show "Syncing" until channels catch up.
  const [syncingSince, setSyncingSince] = useState<number | null>(null);

  // ?tab=channels&channel=<key>; legacy #sales-channels anchor also opens it.
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as ProductEditTab | null;
  const tab: ProductEditTab =
    tabParam && PRODUCT_EDIT_TABS.includes(tabParam)
      ? tabParam
      : location.hash === `#${SALES_CHANNELS_ANCHOR}`
        ? "channels"
        : "details";
  const focusChannel = searchParams.get("channel");

  function setTab(next: string) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === "details") params.delete("tab");
        else params.set("tab", next);
        params.delete("channel");
        return params;
      },
      { replace: true },
    );
  }

  const { channels, baseListings } = useProductChannelListings(product._id, syncingSince);
  const listedNames = baseListings.map((l) => channels.find((c) => c.key === l.platform)?.name ?? l.platform);
  // Tightest title limit any channel imposes (eBay: 80).
  const titleLimit = Math.min(...channels.map((c) => c.productConstraints?.title?.maxLength ?? Infinity));

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<ProductEditFormValues>({
    resolver: zodResolver(productEditFormSchema),
    defaultValues: productToForm(product),
  });

  const form = watch();

  // Browser-level guard only: BrowserRouter can't block in-app navigation.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const saveMutation = useMutation({
    mutationFn: (fd: FormData) => updateProduct(product._id, fd),
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, tone: "danger" });
    },
  });

  // Immediate, apart from Save; rebases dirty state so Save won't revert it.
  const statusMutation = useMutation({
    mutationFn: (status: Product["status"]) => {
      const fd = new FormData();
      fd.append("status", status);
      return updateProduct(product._id, fd);
    },
    onSuccess: (_res, status) => {
      reset({ ...getValues(), status }, { keepDirty: false });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["product", slug] });
      toast({ title: status === "active" ? "Marked Active" : "Moved to Draft", tone: "success" });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't update status", description: err.message, tone: "danger" });
    },
  });

  const onSave = (values: ProductEditFormValues) => {
    const syncs = baseListings.length > 0 && SYNCED_FIELDS.some((f) => dirtyFields[f]);
    saveMutation.mutate(formToFD(values), {
      onSuccess: (res) => {
        reset(values);
        if (syncs) setSyncingSince(Date.now());
        void queryClient.invalidateQueries({ queryKey: ["products"] });
        void queryClient.invalidateQueries({ queryKey: ["listings"] });
        void queryClient.invalidateQueries({ queryKey: ["variants", product._id] });
        toast({ title: syncs ? `Saved · ${listedNames.join(", ")} re-sync in ~5–10s` : "Saved", tone: "success" });
        const newSlug = res.data?.slug;
        if (newSlug && newSlug !== slug) {
          // Slug changed: just navigate; the old query GCs once it loses its subscriber.
          navigate(`/products/${newSlug}/edit${location.search}`, { replace: true });
        } else {
          void queryClient.invalidateQueries({ queryKey: ["product", slug] });
        }
      },
    });
  };

  function focusCategories() {
    setTab("details");
    setTimeout(() => document.getElementById(CATEGORIES_FIELD_ID)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }

  const essentials: EssentialItem[] = [
    { key: "title", label: "Title", done: form.title.trim().length > 0 },
    { key: "price", label: "Retail price", done: Number(form.price) > 0 },
    { key: "category", label: "Category", done: form.categories.length > 0, action: { label: "Add", onClick: focusCategories } },
    {
      key: "image",
      label: "At least one image",
      done: form.images.length > 0,
      action: {
        label: "Upload",
        onClick: () => document.getElementById(PRODUCT_MEDIA_ANCHOR)?.scrollIntoView({ behavior: "smooth", block: "center" }),
      },
    },
  ];

  const moneyInput = (name: "price" | "cost_price" | "shipping_cost") => (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-fg/45">A$</span>
      <Input type="number" min="0" step="0.01" inputMode="decimal" className="pl-8" {...register(name)} placeholder="0.00" />
    </div>
  );

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <div className="pb-24">
        <ProductEditHeader
          product={product}
          onStatusChange={(status) => statusMutation.mutate(status)}
          statusPending={statusMutation.isPending}
          channelChip={
            <ProductChannelChip channels={channels} listings={baseListings} syncingSince={syncingSince} onClick={() => setTab("channels")} />
          }
          isDirty={isDirty}
          onDiscard={() => {
            reset(productToForm(product));
            toast({ title: "Changes discarded", tone: "success" });
          }}
          onSave={() => void handleSubmit(onSave)()}
          saving={saveMutation.isPending}
          uploading={imagesUploading}
          onSendEmail={() => setSendEmailOpen(true)}
        >
          <TabsList className="gap-5 border-b-0">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="channels">
              Sales channels
              <Badge variant="muted" className="px-1.5 py-0 text-[11px]">{baseListings.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="notes">
              Internal notes
              <Badge variant="muted" className="px-1.5 py-0 text-[11px]">{product.internal_notes?.length ?? 0}</Badge>
            </TabsTrigger>
          </TabsList>
        </ProductEditHeader>

        <div className="mx-auto mt-6 grid max-w-[1240px] grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="min-w-0">
            <TabsContent value="details" className="mt-0">
              <Card className="divide-y divide-border">
                <ProductFormGroup title="Product">
                  <FormField
                    label="Title"
                    required
                    error={errors.title?.message}
                    aside={
                      Number.isFinite(titleLimit) ? (
                        <span className={form.title.length > titleLimit ? "text-danger" : undefined}>
                          {form.title.length} / {titleLimit}
                        </span>
                      ) : undefined
                    }
                  >
                    <Input {...register("title")} placeholder="Product title" />
                  </FormField>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <FormField label="SKU" aside="auto">
                      {form.sku ? <CopyField value={form.sku} /> : <Input value="" readOnly disabled placeholder="Not assigned" />}
                    </FormField>
                    <FormField label="Barcode" aside={`${form.barcode.length} / 13`}>
                      <Input {...register("barcode")} placeholder="EAN / UPC" maxLength={13} />
                    </FormField>
                    <FormField label="Manufacturer part number">
                      <Input {...register("mpn")} placeholder="e.g. 45022-TBC-A01" />
                    </FormField>
                  </div>
                </ProductFormGroup>

                <ProductFormGroup title="Pricing & stock" aside="All amounts in A$">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <FormField label="Retail price" required error={errors.price?.message}>
                      {moneyInput("price")}
                    </FormField>
                    <FormField label="Cost price" error={errors.cost_price?.message}>
                      {moneyInput("cost_price")}
                    </FormField>
                    <FormField label="Shipping cost" error={errors.shipping_cost?.message}>
                      {moneyInput("shipping_cost")}
                    </FormField>
                    {form.has_variants ? (
                      <div className="flex flex-col gap-1.5">
                        <Label>Stock</Label>
                        <p className="flex h-10 items-center text-xs text-fg/55">Managed per variant</p>
                      </div>
                    ) : (
                      <ProductStockField productId={product._id} />
                    )}
                  </div>
                  <ProductMarginStrip price={form.price} cost={form.cost_price} />
                </ProductFormGroup>

                <ProductFormGroup title="Classification">
                  <div id={CATEGORIES_FIELD_ID} className="scroll-mt-40">
                    <FormField label="Categories" aside="Not synced to channels">
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
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="Condition">
                      <Controller
                        control={control}
                        name="condition"
                        render={({ field }) => (
                          <SegmentedControl<ProductCondition>
                            aria-label="Condition"
                            options={CONDITIONS as { value: ProductCondition; label: string }[]}
                            value={field.value as ProductCondition}
                            onChange={field.onChange}
                          />
                        )}
                      />
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
                </ProductFormGroup>

                <ProductFitmentGroup
                  values={{
                    vehicle_make: form.vehicle_make,
                    vehicle_model: form.vehicle_model,
                    vehicle_model_code: form.vehicle_model_code,
                    vehicle_year: form.vehicle_year,
                    vehicle_year_to: form.vehicle_year_to,
                  }}
                  onChange={(patch) => {
                    for (const [key, value] of Object.entries(patch)) {
                      setValue(key as keyof ProductEditFormValues, value as never, { shouldValidate: true, shouldDirty: true });
                    }
                  }}
                  yearRangeError={errors.vehicle_year_to?.message}
                />
              </Card>
            </TabsContent>

            <TabsContent value="channels" className="mt-0">
              <ProductSalesChannelsSection product={product} syncingSince={syncingSince} focusChannel={focusChannel} />
            </TabsContent>

            <TabsContent value="notes" className="mt-0">
              <ProductNotesSection productId={product._id} slug={product.slug} notes={product.internal_notes} />
            </TabsContent>
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-32">
            <Controller
              control={control}
              name="images"
              render={({ field }) => (
                <ProductMediaPreviewCard
                  images={field.value}
                  onImagesChange={field.onChange}
                  onUploadingChange={setImagesUploading}
                  title={form.title}
                  sku={form.sku}
                  price={form.price}
                  stockCount={product.stock_count}
                />
              )}
            />
            <Card className="p-4">
              <Controller
                control={control}
                name="is_published_online"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    label="Show on storefront"
                    description="Visible to customers online"
                  />
                )}
              />
            </Card>
            <ProductEssentialsCard items={essentials} />
          </aside>
        </div>

        <SendProductEmailModal product={product} open={sendEmailOpen} onOpenChange={setSendEmailOpen} />
      </div>
    </Tabs>
  );
}
