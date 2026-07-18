import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { NativeSelect } from "@/components/ui/Select";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { BreadcrumbNav } from "@/components/ui/BreadcrumbNav";
import { FormField } from "@/components/ui/FormField";
import { ProductImages } from "@/components/media/ProductImages";
import { CreateStockSection } from "@/components/products/CreateStockSection";
import { ProductVehicleSection } from "@/components/products/ProductVehicleSection";
import { useToast } from "@/context";
import { createProduct } from "@/lib/api/products";
import { getCategories } from "@/lib/api/categories";
import type { ProductCreateFormState } from "@/types/product";
import { SectionLabel } from "@/components/products/SectionLabel";
import { Package2, Image, DollarSign, Boxes, Layers, Car, Tag, Plus } from "lucide-react";
import { CONDITIONS, AUTHENTICITY_OPTIONS } from "@/config/productOptions";

const INITIAL: ProductCreateFormState = {
  title: "",
  description: "",
  price: "",
  compare_price: "",
  cost_price: "",
  shipping_cost: "",
  is_taxable: false,
  barcode: "",
  stock_control: false,
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
};

function formToFD(form: ProductCreateFormState): FormData {
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
  fd.append("status", form.status);
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
  const [form, setForm] = useState<ProductCreateFormState>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: categoriesRes } = useQuery({
    queryKey: ["categories", "all"],
    queryFn: () => getCategories({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });
  const categoryOptions = (categoriesRes?.data?.items ?? []).map((c) => ({
    value: c._id,
    label: c.name,
  }));

  const clearError = (key: string) =>
    setErrors((p) => { const n = { ...p }; delete n[key]; return n; });

  const mutation = useMutation({
    mutationFn: (fd: FormData) => createProduct(fd),
    onSuccess: (res) => {
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

  const set = <K extends keyof ProductCreateFormState>(
    key: K,
    value: ProductCreateFormState[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.price || Number(form.price) <= 0) e.price = "Price is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate(formToFD(form));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 -mx-6 border-b border-border bg-bg/95 px-6 py-3 backdrop-blur-sm">
        <BreadcrumbNav
          items={[
            { label: "Products", href: "/products" },
            { label: "New Product" },
          ]}
        />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">New Product</h1>
            <p className="mt-0.5 text-sm text-fg/50">
              SKU is auto-generated on save. Variants can be added after creating.
            </p>
          </div>
          <Button
            type="submit"
            form="product-create-form"
            variant="primary"
            size="sm"
            disabled={mutation.isPending}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            {mutation.isPending ? "Creating…" : "Create Product"}
          </Button>
        </div>
      </div>

      <form
        id="product-create-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
      >
        <div className="space-y-5">

          {/* Basic Info */}
          <Card>
            <CardHeader title={<SectionLabel icon={Package2}>Basic Information</SectionLabel>} />
            <CardContent className="space-y-4">
              <FormField label="Title" required error={errors.title}>
                <Input
                  value={form.title}
                  onChange={(e) => { set("title", e.target.value); clearError("title"); }}
                  placeholder="Product title"
                  autoFocus
                />
              </FormField>

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

              <Switch
                checked={form.is_published_online}
                onCheckedChange={(v) => set("is_published_online", v)}
                label="Show on storefront"
                description="Make this product visible on the public storefront"
              />
            </CardContent>
          </Card>

          {/* Classification */}
          <Card>
            <CardHeader title={<SectionLabel icon={Tag}>Classification</SectionLabel>} />
            <CardContent className="space-y-4">
              <FormField label="Categories">
                <MultiSelect
                  options={categoryOptions}
                  value={form.categories}
                  onChange={(v) => set("categories", v)}
                  placeholder="Select categories…"
                  searchPlaceholder="Search categories…"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Condition">
                  <NativeSelect
                    value={form.condition}
                    onChange={(e) => set("condition", e.target.value as ProductCreateFormState["condition"])}
                  >
                    {CONDITIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </NativeSelect>
                </FormField>

                <FormField label="Authenticity">
                  <NativeSelect
                    value={form.authenticity}
                    onChange={(e) => set("authenticity", e.target.value as ProductCreateFormState["authenticity"])}
                  >
                    <option value="">Select authenticity…</option>
                    {AUTHENTICITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </NativeSelect>
                </FormField>
              </div>

              <FormField label="Manufacturer Part Number (MPN)">
                <Input
                  value={form.mpn}
                  onChange={(e) => set("mpn", e.target.value)}
                  placeholder='e.g. 45022-TBC-A01 or "Does Not Apply"'
                />
              </FormField>
            </CardContent>
          </Card>

          {/* Vehicle */}
          <Card>
            <CardHeader title={<SectionLabel icon={Car}>Vehicle</SectionLabel>} description="Set the compatible vehicle for this part" />
            <CardContent>
              <ProductVehicleSection
                values={{
                  vehicle_make: form.vehicle_make,
                  vehicle_model: form.vehicle_model,
                  vehicle_model_code: form.vehicle_model_code,
                  vehicle_year: form.vehicle_year,
                  vehicle_year_to: form.vehicle_year_to,
                }}
                onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
              />
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader title={<SectionLabel icon={DollarSign}>Pricing</SectionLabel>} />
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Price (A$)" required error={errors.price}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => { set("price", e.target.value); clearError("price"); }}
                    placeholder="0.00"
                  />
                </FormField>
                <FormField label="Cost price (A$)">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.cost_price}
                    onChange={(e) => set("cost_price", e.target.value)}
                    placeholder="0.00"
                  />
                </FormField>
              </div>
              <FormField label="Shipping cost (A$)">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.shipping_cost}
                  onChange={(e) => set("shipping_cost", e.target.value)}
                  placeholder="0.00"
                />
              </FormField>
            </CardContent>
          </Card>

          {/* Inventory */}
          <Card>
            <CardHeader title={<SectionLabel icon={Boxes}>Inventory</SectionLabel>} />
            <CardContent className="space-y-4">
              <Switch
                checked={form.stock_control}
                onCheckedChange={(v) => {
                  set("stock_control", v);
                  if (!v) set("stock_entries", []);
                }}
                label="Track stock"
                description="Manage inventory levels and get low-stock alerts"
              />
            </CardContent>
          </Card>

          {/* Set Stock — shown only when stock tracking is on */}
          {form.stock_control && (
            <Card>
              <CardHeader
                title={<SectionLabel icon={Layers}>Set Stock</SectionLabel>}
                description="Set initial stock levels per location"
              />
              <CardContent>
                <CreateStockSection
                  entries={form.stock_entries}
                  onChange={(entries) => set("stock_entries", entries)}
                />
              </CardContent>
            </Card>
          )}

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
                  Tip: You can add images after creating the product too.
                </p>
              )}
            </CardContent>
          </Card>

        </div>
      </form>
    </div>
  );
}
