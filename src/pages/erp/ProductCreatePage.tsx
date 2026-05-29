import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { TagInput } from "@/components/ui/tag-input";
import { MultiSelect } from "@/components/ui/multi-select";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
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
import { Package2, Image, DollarSign, Plus } from "lucide-react";
import { cn } from "@/utils/cn";

const INITIAL: ProductCreateFormState = {
  title: "",
  description: "",
  price: "",
  compare_price: "",
  cost_price: "",
  is_taxable: false,
  vat_rate: "",
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
  const [form, setForm] = useState<ProductCreateFormState>(INITIAL);

  const { data: catData, isLoading: catLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });
  const categories: Category[] = catData?.data ?? [];

  const categoryOptions = categories.map((c) => ({
    value: c._id,
    label: c.name,
  }));

  const mutation = useMutation({
    mutationFn: (fd: FormData) => createProduct(fd),
    onSuccess: (res) => {
      toast({ title: "Product created", tone: "success" });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast({ title: "Name is required", tone: "danger" });
      return;
    }
    mutation.mutate(formToFD(form));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <BreadcrumbNav
          items={[
            { label: "Products", href: "/products" },
            { label: "New Product" },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
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
              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg/65">
                  Name <span className="text-danger">*</span>
                </label>
                <Input
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Product name"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg/65">
                  Description
                </label>
                <RichTextEditor
                  value={form.description}
                  onChange={(html) => set("description", html)}
                  placeholder="Describe your product…"
                  minHeight="140px"
                />
              </div>
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
                {(
                  [
                    { key: "price", label: "Price (£)" },
                    { key: "compare_price", label: "Compare at (£)" },
                    { key: "cost_price", label: "Cost price (£)" },
                  ] as const
                ).map(({ key, label }) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-xs font-medium text-fg/65">
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

              <Switch
                checked={form.is_taxable}
                onCheckedChange={(v) => set("is_taxable", v)}
                label="Taxable"
                description="Charge tax on this product"
              />

              {form.is_taxable && (
                <div className="w-32">
                  <label className="mb-1.5 block text-xs font-medium text-fg/65">
                    VAT Rate (%)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.vat_rate}
                    onChange={(e) => set("vat_rate", e.target.value)}
                    placeholder="20"
                  />
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
              <div>
                <p className="mb-2 text-xs font-medium text-fg/65">
                  Product Type
                </p>
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
              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg/65">
                  Categories
                </label>
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
              </div>

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
            </CardContent>
          </Card>

        </div>
      </form>
    </div>
  );
}
