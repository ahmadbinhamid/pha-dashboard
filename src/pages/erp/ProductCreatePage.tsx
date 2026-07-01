import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { CreateStockSection } from "@/components/products/create-stock-section";
import { useToast } from "@/context";
import { createProduct } from "@/lib/api/products";
import type { ProductCreateFormState, ProductStatus } from "@/types/product";
import { SectionLabel } from "@/components/products/section-label";
import { Package2, Image, DollarSign, Boxes, Layers, Plus } from "lucide-react";

const INITIAL: ProductCreateFormState = {
  title: "",
  description: "",
  price: "",
  compare_price: "",
  cost_price: "",
  is_taxable: false,
  vat_rate: "",
  barcode: "",
  stock_control: false,
  stock_entries: [],
  type: "physical",
  status: "active",
  is_published_online: false,
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
  fd.append("is_taxable", String(form.is_taxable));
  if (form.vat_rate) fd.append("vat_rate", form.vat_rate);
  fd.append("barcode", form.barcode);
  fd.append("stock_control", String(form.stock_control));
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
        className="grid grid-cols-1 gap-5 lg:grid-cols-3"
      >
        {/* ── Main Column ── */}
        <div className="space-y-5 lg:col-span-2">

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

        {/* ── Sidebar ── */}
        <div className="space-y-5">

          {/* Status */}
          <Card>
            <CardHeader title="Status" />
            <CardContent className="space-y-4">
              <FormField label="Product Status">
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
              </FormField>

              <Switch
                checked={form.is_published_online}
                onCheckedChange={(v) => set("is_published_online", v)}
                label="Published Online"
                description="Visible on your storefront"
              />
            </CardContent>
          </Card>

        </div>
      </form>
    </div>
  );
}
