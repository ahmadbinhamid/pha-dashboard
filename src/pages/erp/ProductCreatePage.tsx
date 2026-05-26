import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { ProductImages } from "@/components/media/product-images";
import { useToast } from "@/context";
import { createProduct, getCategories } from "@/lib/api/products";
import type { Category, ProductCreateFormState } from "@/types/product";
import { ArrowLeft } from "lucide-react";

const INITIAL: ProductCreateFormState = {
  title: "",
  description: "",
  price: "",
  compare_price: "",
  cost_price: "",
  is_taxable: false,
  vat_rate: "",
  type: "1",
  status: "0",
  is_published_online: false,
  categories: [],
  tags: "",
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
  return fd;
}

export default function ProductCreatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<ProductCreateFormState>(INITIAL);

  const { data: catData } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });
  const categories: Category[] = catData?.data ?? [];

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
      toast({ title: "Title is required", tone: "danger" });
      return;
    }
    mutation.mutate(formToFD(form));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
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
          <h1 className="text-xl font-semibold tracking-tight">New Product</h1>
          <p className="mt-0.5 text-sm text-fg/60">Create a new product</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
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
              <label className="flex items-center gap-2 text-sm text-fg/80">
                <input
                  type="checkbox"
                  checked={form.is_taxable}
                  onChange={(e) => set("is_taxable", e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-accent"
                />
                Taxable
              </label>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Categories & Tags" />
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg/70">
                  Categories
                </label>
                <div className="max-h-48 space-y-1.5 overflow-y-auto">
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
                  placeholder="spare part, engine, toyota"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={mutation.isPending}
              className="w-full"
            >
              {mutation.isPending ? "Creating..." : "Create Product"}
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
    </div>
  );
}
