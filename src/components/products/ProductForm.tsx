import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { CopyField } from "@/components/ui/CopyField";
import { Input } from "@/components/ui/Input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { CreateProductNotesSection } from "@/components/products/CreateProductNotesSection";
import { ProductChannelChip } from "@/components/products/ProductChannelChip";
import { CreateStockSection } from "@/components/products/CreateStockSection";
import { ProductCreateHeader } from "@/components/products/ProductCreateHeader";
import { ProductFormSections } from "@/components/products/ProductFormSections";
import { ProductEditHeader } from "@/components/products/ProductEditHeader";
import { ProductLivePreviewCard } from "@/components/products/ProductLivePreviewCard";
import { ProductNotesSection } from "@/components/products/ProductNotesSection";
import { ProductSalesChannelsSection } from "@/components/products/ProductSalesChannelsSection";
import { ProductStockCard } from "@/components/products/ProductStockCard";
import { SendProductEmailModal } from "@/components/products/SendProductEmailModal";
import { PRODUCT_EDIT_TABS, SALES_CHANNELS_ANCHOR, type ProductEditTab } from "@/config/salesChannels";
import { useToast } from "@/context";
import { useElementHeight } from "@/hooks/useElementHeight";
import { useProductChannelListings } from "@/hooks/useProductChannelListings";
import { addProductNote, createProduct, updateProduct } from "@/lib/api/products";
import { EMPTY_PRODUCT_FORM, productFormToFormData, productToForm } from "@/lib/products/productForm";
import { productCreateFormSchema, productFormSchema, type ProductFormValues } from "@/lib/validation/product";
import type { Product, ProductStatus, StockEntry } from "@/types/product";

// Product fields a channel payload reads; editing any triggers a re-sync.
const SYNCED_FIELDS: (keyof ProductFormValues)[] = ["title", "description", "price", "brand", "mpn", "condition", "images"];

type ProductFormProps =
  | { mode: "create"; categoryOptions: { value: string; label: string }[] }
  | { mode: "edit"; product: Product; slug: string; categoryOptions: { value: string; label: string }[] };

// Create and edit share this form; only header, stock, notes and tabs differ.
export function ProductForm(props: ProductFormProps) {
  const { categoryOptions } = props;
  const product = props.mode === "edit" ? props.product : null;
  const slug = props.mode === "edit" ? props.slug : null;
  const isEdit = product !== null;

  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [imagesUploading, setImagesUploading] = useState(false);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);
  // Last synced-field save; rows show "Syncing" until channels catch up.
  const [syncingSince, setSyncingSince] = useState<number | null>(null);
  // Create notes are posted once the product exists (needs its id).
  const pendingNotesRef = useRef<string[]>([]);
  // Sidebar sticks one section gap below the sticky header, whatever its height.
  const headerRef = useRef<HTMLDivElement>(null);
  const headerHeight = useElementHeight(headerRef);

  // Edit only: ?tab=channels&channel=<key>; legacy #sales-channels also opens it.
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

  const { channels, baseListings } = useProductChannelListings(product?._id ?? null, syncingSince);
  const listedNames = baseListings.map((l) => channels.find((c) => c.key === l.platform)?.name ?? l.platform);
  // Tightest title limit any channel imposes (eBay: 80).
  const titleLimit = Math.min(...channels.map((c) => c.productConstraints?.title?.maxLength ?? Infinity));

  const methods = useForm<ProductFormValues>({
    resolver: zodResolver(isEdit ? productFormSchema : productCreateFormSchema),
    defaultValues: product ? productToForm(product) : EMPTY_PRODUCT_FORM,
  });
  const {
    control,
    handleSubmit,
    reset,
    getValues,
    watch,
    formState: { errors, isDirty, dirtyFields },
  } = methods;
  const form = watch();

  // Browser-level guard only: BrowserRouter can't block in-app navigation.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const saveMutation = useMutation({
    mutationFn: (fd: FormData) => (product ? updateProduct(product._id, fd) : createProduct(fd)),
    onError: (err: Error) => {
      toast({ title: isEdit ? "Save failed" : "Failed to create product", description: err.message, tone: "danger" });
    },
  });

  // Immediate, apart from Save; rebases dirty state so Save won't revert it.
  const statusMutation = useMutation({
    mutationFn: (status: Product["status"]) => {
      const fd = new FormData();
      fd.append("status", status);
      return updateProduct(product!._id, fd);
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

  const onSave = (values: ProductFormValues) => {
    if (!product) return;
    const syncs = baseListings.length > 0 && SYNCED_FIELDS.some((f) => dirtyFields[f]);
    saveMutation.mutate(productFormToFormData(values, "edit"), {
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

  // Posts the drafted notes, then opens the new product's edit page.
  async function finishCreate(created: { _id?: string; slug?: string } | undefined, values: ProductFormValues, status: ProductStatus) {
    const notes = pendingNotesRef.current;
    if (created?._id && notes.length > 0) await Promise.allSettled(notes.map((text) => addProductNote(created._id!, text)));
    // Clears dirty state so the unsaved-changes guard lets the redirect through.
    reset(values);
    toast({ title: status === "draft" ? "Draft saved" : "Product created", tone: "success" });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
    navigate(created?.slug ? `/products/${created.slug}/edit` : "/products");
  }

  const onCreate = (status: ProductStatus) => (values: ProductFormValues) => {
    pendingNotesRef.current = values.notes;
    saveMutation.mutate(productFormToFormData(values, "create", status), {
      onSuccess: (res) => void finishCreate(res.data, values, status),
    });
  };

  // Edit only: a new product's SKU is generated on save.
  const skuField = !product ? undefined : form.sku ? (
    <CopyField value={form.sku} />
  ) : (
    <Input value="" readOnly disabled placeholder="Not assigned" />
  );

  const stock = !product
    ? {
        description: "Opening quantity for your only stock location",
        content: (
          <>
            <Controller
              control={control}
              name="stock_entries"
              render={({ field }) => <CreateStockSection entries={field.value} onChange={field.onChange} />}
            />
            {errors.stock_entries?.message && <p className="text-xs text-danger">{errors.stock_entries.message}</p>}
          </>
        ),
      }
    : form.has_variants
      ? { description: "Stock is managed per variant", content: <p className="text-sm text-fg/55">Set stock on each variant.</p> }
      : { description: "Stock at your only stock location", content: <ProductStockCard productId={product._id} /> };

  const sections = (
    <ProductFormSections
      methods={methods}
      categoryOptions={categoryOptions}
      titleLimit={titleLimit}
      skuField={skuField}
      stock={stock}
      notes={
        product ? undefined : (
          <Controller
            control={control}
            name="notes"
            render={({ field }) => <CreateProductNotesSection notes={field.value} onChange={field.onChange} />}
          />
        )
      }
      storefrontDescription={product ? "Visible to customers online" : "Visible to customers online as soon as it's created"}
      onUploadingChange={setImagesUploading}
      autoFocusTitle={!product}
    />
  );

  const openingStock = form.stock_entries.reduce((sum: number, e: StockEntry) => sum + e.qty, 0);

  const layout = (main: React.ReactNode) => (
    <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="min-w-0 space-y-5 lg:col-span-2">{main}</div>
      <div className="space-y-5 lg:sticky lg:self-start" style={{ top: `calc(${headerHeight}px - var(--spacing-section) + 1.25rem)` }}>
        <ProductLivePreviewCard
          title={form.title}
          images={form.images}
          price={form.price}
          sku={form.sku || null}
          skuPending={!product}
          stockCount={product ? product.stock_count : openingStock}
        />
      </div>
    </div>
  );

  if (!product) {
    return (
      <div className="pb-24">
        <ProductCreateHeader
          ref={headerRef}
          onSaveDraft={() => void handleSubmit(onCreate("draft"))()}
          onCreate={() => void handleSubmit(onCreate("active"))()}
          saving={saveMutation.isPending}
          uploading={imagesUploading}
        />
        {layout(sections)}
      </div>
    );
  }

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <div className="pb-24">
        <ProductEditHeader
          ref={headerRef}
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
              <Badge variant="muted" className="px-1.5 py-0 text-2xs">{baseListings.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="notes">
              Internal notes
              <Badge variant="muted" className="px-1.5 py-0 text-2xs">{product.internal_notes?.length ?? 0}</Badge>
            </TabsTrigger>
          </TabsList>
        </ProductEditHeader>

        {layout(
          <>
            <TabsContent value="details" className="mt-0">
              {sections}
            </TabsContent>
            <TabsContent value="channels" className="mt-0">
              <ProductSalesChannelsSection product={product} syncingSince={syncingSince} focusChannel={focusChannel} />
            </TabsContent>
            <TabsContent value="notes" className="mt-0">
              <ProductNotesSection productId={product._id} slug={product.slug} notes={product.internal_notes} />
            </TabsContent>
          </>,
        )}

        <SendProductEmailModal product={product} open={sendEmailOpen} onOpenChange={setSendEmailOpen} />
      </div>
    </Tabs>
  );
}
