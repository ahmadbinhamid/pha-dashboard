import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/context";
import { createProduct, getCategories } from "@/lib/api/products";
import type {
  Category,
  ProductCreateFormState,
  ProductType,
  ProductStatus,
} from "@/types/product";
import { Skeleton } from "@/components/ui/skeleton";
import { Package2, Image, DollarSign, Plus, ShoppingBag } from "lucide-react";
import { cn } from "@/utils/cn";

const INITIAL: ProductCreateFormState = {
  title: "",
  description: "",
  price: "",
  compare_price: "",
  cost_price: "",
  is_taxable: false,
  vat_rate: "",
  sku: "",
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
  if (form.sku) fd.append("sku", form.sku.trim());
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

export default function ProductCreatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductCreateFormState>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (key: string) =>
    setErrors((p) => { const n = { ...p }; delete n[key]; return n; });

  const { data: catData, isLoading: catLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });
  const categories: Category[] = catData?.data ?? [];
  const categoryOptions = categories.map((c) => ({ value: c._id, label: c.name }));

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
    if (!form.title.trim()) e.title = "Name is required";
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
              Inventory, variants and stock can be set after creating
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
              <FormField label="Name" required error={errors.title}>
                <Input
                  value={form.title}
                  onChange={(e) => { set("title", e.target.value); clearError("title"); }}
                  placeholder="Product name"
                  autoFocus
                />
              </FormField>
              <FormField label="SKU" hint="Leave blank — auto-generated if synced to eBay">
                <Input
                  value={form.sku}
                  onChange={(e) => set("sku", e.target.value)}
                  placeholder="e.g. PART-001"
                  maxLength={64}
                />
              </FormField>
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
                  Tip: You can add images after creating the product too.
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
                <FormField label="Compare at (£)">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.compare_price}
                    onChange={(e) => set("compare_price", e.target.value)}
                    placeholder="0.00"
                  />
                </FormField>
                <FormField label="Cost price (£)">
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

              <Switch
                checked={form.is_taxable}
                onCheckedChange={(v) => set("is_taxable", v)}
                label="Taxable"
                description="Charge tax on this product"
              />

              {form.is_taxable && (
                <div className="w-32">
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

        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-5">

          {/* Status */}
          <Card>
            <CardHeader title="Status" />
            <CardContent className="space-y-4">
              <FormField label="Product Type">
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
              </FormField>

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

          {/* Organisation */}
          <Card>
            <CardHeader title="Organisation" />
            <CardContent className="space-y-4">
              <FormField label="Categories">
                {catLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <MultiSelect
                    options={categoryOptions}
                    value={form.categories}
                    onChange={(v) => set("categories", v)}
                    placeholder="Select categories…"
                  />
                )}
              </FormField>

              <FormField label="Tags" hint="Press Enter or comma to add">
                <TagInput
                  value={form.tags}
                  onChange={(tags) => set("tags", tags)}
                  placeholder="Add tags…"
                />
              </FormField>
            </CardContent>
          </Card>

          {/* eBay tip */}
          <Card>
            <CardHeader
              title={
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-xs bg-accent/10">
                    <ShoppingBag className="h-3.5 w-3.5 text-accent" />
                  </div>
                  <span>eBay Listing</span>
                </div>
              }
            />
            <CardContent>
              <p className="text-xs text-fg/55">
                After creating, open the product editor to set the eBay Category
                and Condition — then hit <strong>Sync to eBay</strong>.
              </p>
              <ul className="mt-3 space-y-1.5 text-[11px] text-fg/50">
                <li className="flex items-start gap-1.5">
                  <span className="mt-px text-danger">*</span>
                  <span><strong>Title</strong> — required</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-px text-danger">*</span>
                  <span><strong>Price</strong> — required</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-px text-danger">*</span>
                  <span><strong>At least 1 image</strong> — required to publish</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-px text-fg/30">·</span>
                  <span>SKU — recommended (auto-generated if blank)</span>
                </li>
              </ul>
            </CardContent>
          </Card>

        </div>
      </form>
    </div>
  );
}
