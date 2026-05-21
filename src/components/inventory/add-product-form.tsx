
import { useEffect, useId, useRef, useState } from "react";
import Link from "@/components/ui/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/context";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Switch } from "@/components/ui/switch";
import { Image } from "@/components/ui/image";

const DRAFT_KEY = "pha-inventory-add-product-draft";
const LEGACY_DRAFT_KEY = "parts-hub-add-product-draft";

type VehicleRow = {
  id: string;
  make: string;
  model: string;
  year: string;
  engine: string;
};

type ImageItem = {
  id: string;
  file: File;
  url: string;
};

function newVehicle(): VehicleRow {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    make: "",
    model: "",
    year: "",
    engine: "",
  };
}

const EBAY_CATEGORIES = [
  "33615 — Automotive Brakes & Brake Parts",
  "33559 — Automotive Filters",
  "33567 — Automotive Lighting & Lamps",
  "33563 — Automotive Suspension & Steering",
  "33564 — Automotive Engine Components",
  "33555 — Automotive Wheels, Tyres & Parts",
  "33550 — Automotive Exterior Parts",
  "33560 — Automotive Interior Parts",
];

const INVENTORY_CATEGORIES = [
  "Brakes",
  "Service",
  "Engine",
  "Ignition",
  "Suspension",
  "Electrical",
  "Interior",
  "Body",
] as const;

const FORM_STEPS = [
  { id: "add-section-basics", label: "Basics" },
  { id: "add-section-fitment", label: "Fitment" },
  { id: "add-section-pricing", label: "Pricing" },
  { id: "add-section-images", label: "Images" },
  { id: "add-section-ebay", label: "eBay" },
] as const;

function generateSku(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `PHA-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  }
  return `PHA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

type DraftPayload = {
  productName: string;
  sku: string;
  category: string;
  brand: string;
  oem: string;
  condition: string;
  description: string;
  vehicles: VehicleRow[];
  costPrice: string;
  sellingPrice: string;
  quantity: string;
  /** @deprecated removed from UI; ignored on save */
  warehouse?: string;
  ebayCategory: string;
  ebayTitle: string;
  syncEbay: boolean;
};

function readDraftRaw(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DRAFT_KEY) ?? localStorage.getItem(LEGACY_DRAFT_KEY);
}

export function AddProductForm() {
  const { toast } = useToast();
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState(() => generateSku());
  const [category, setCategory] = useState<string>(INVENTORY_CATEGORIES[0]);
  const [brand, setBrand] = useState("");
  const [oem, setOem] = useState("");
  const [condition, setCondition] = useState("new");
  const [description, setDescription] = useState("");

  const [vehicles, setVehicles] = useState<VehicleRow[]>(() => [newVehicle()]);

  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [quantity, setQuantity] = useState("");

  const [images, setImages] = useState<ImageItem[]>([]);

  const [ebayCategory, setEbayCategory] = useState(EBAY_CATEGORIES[0] ?? "");
  const [ebayTitle, setEbayTitle] = useState("");
  const [syncEbay, setSyncEbay] = useState(false);

  const imagesRef = useRef<ImageItem[]>([]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((i) => URL.revokeObjectURL(i.url));
    };
  }, []);

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) {
      toast({ tone: "warning", title: "No images added", description: "Please choose image files (JPG, PNG, WebP)." });
      return;
    }
    setImages((prev) => {
      const next = list.map((file) => ({
        id: crypto.randomUUID?.() ?? `${Date.now()}-${file.name}`,
        file,
        url: URL.createObjectURL(file),
      }));
      return [...prev, ...next];
    });
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((i) => i.id !== id);
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const buildDraftPayload = (): DraftPayload => ({
    productName,
    sku,
    category,
    brand,
    oem,
    condition,
    description,
    vehicles,
    costPrice,
    sellingPrice,
    quantity,
    ebayCategory,
    ebayTitle,
    syncEbay,
  });

  const saveDraft = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(buildDraftPayload()));
      try {
        localStorage.removeItem(LEGACY_DRAFT_KEY);
      } catch {}
      toast({
        tone: "success",
        title: "Draft saved",
        description: "You can continue later from this browser. Images are not stored in the draft.",
      });
    } catch {
      toast({ tone: "danger", title: "Could not save", description: "Check browser storage settings." });
    }
  };

  const loadDraft = () => {
    try {
      const raw = readDraftRaw();
      if (!raw) {
        toast({ tone: "default", title: "No draft found", description: "Save a draft first." });
        return;
      }
      const d = JSON.parse(raw) as DraftPayload;
      setProductName(d.productName ?? "");
      setCategory(
        d.category && INVENTORY_CATEGORIES.includes(d.category as (typeof INVENTORY_CATEGORIES)[number])
          ? d.category
          : INVENTORY_CATEGORIES[0],
      );
      setBrand(d.brand ?? "");
      setOem(d.oem ?? "");
      setCondition(d.condition === "used" ? "used" : "new");
      setDescription(d.description ?? "");
      setVehicles(d.vehicles?.length ? d.vehicles : [newVehicle()]);
      setCostPrice(d.costPrice ?? "");
      setSellingPrice(d.sellingPrice ?? "");
      setQuantity(d.quantity ?? "");
      setSku(d.sku?.trim() ? d.sku : generateSku());
      setEbayCategory(d.ebayCategory || EBAY_CATEGORIES[0] || "");
      setEbayTitle(d.ebayTitle ?? "");
      setSyncEbay(Boolean(d.syncEbay));
      toast({ tone: "success", title: "Draft loaded", description: "Review and add images if needed." });
    } catch {
      toast({ tone: "danger", title: "Invalid draft", description: "Clear storage or save a new draft." });
    }
  };

  const publishProduct = () => {
    if (!productName.trim()) {
      toast({
        tone: "warning",
        title: "Almost there",
        description: "Add a product name before publishing.",
      });
      return;
    }
    toast({
      tone: "success",
      title: syncEbay ? "Queued for eBay Motors" : "Product published",
      description: syncEbay
        ? "Listing will sync when connected to eBay (demo)."
        : "Saved to catalogue (demo — connect API for production).",
    });
    setSku(generateSku());
  };

  const addVehicle = () => setVehicles((v) => [...v, newVehicle()]);
  const removeVehicle = (id: string) => setVehicles((v) => (v.length <= 1 ? v : v.filter((row) => row.id !== id)));
  const updateVehicle = (id: string, patch: Partial<VehicleRow>) => {
    setVehicles((v) => v.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const scrollToSection = (id: (typeof FORM_STEPS)[number]["id"]) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-medium text-fg/60">
            <Link href="/inventory" className="text-accent hover:underline">
              Inventory
            </Link>
            <span className="px-1.5 text-fg/40">/</span>
            <span className="text-fg/75">Add product</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-fg">Add product</h1>
          <p className="mt-1 max-w-xl text-sm text-fg/70">
            Structured flow: core details, fitment, pricing, photos, then eBay. Drafts save in this browser only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={loadDraft}>
            Load draft
          </Button>
        </div>
      </div>

      <div
        className="mt-6 flex gap-1 overflow-x-auto rounded-xl border border-border/80 bg-card/80 p-1 shadow-sm ring-1 ring-inset ring-border/40 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="navigation"
        aria-label="Form sections"
      >
        {FORM_STEPS.map((step) => (
          <Button
            key={step.id}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => scrollToSection(step.id)}
            className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-fg/60 hover:bg-bg-2 hover:text-fg"
          >
            {step.label}
          </Button>
        ))}
      </div>

      <form
        id={formId}
        className="mt-8 space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          publishProduct();
        }}
      >
        <section
          id="add-section-basics"
          className="scroll-mt-28 rounded-2xl border border-border bg-card p-5 shadow-sm ring-1 ring-inset ring-border/60 sm:p-6"
        >
          <div className="flex items-start gap-3 border-b border-border pb-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20">
              <Icons.Box className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-fg">Basic product details</h2>
              <p className="mt-0.5 text-sm text-fg/60">Core catalogue information buyers and staff will see.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <FormField label="Product name" htmlFor={`${formId}-name`}>
              <Input
                id={`${formId}-name`}
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. OEM front brake pad set"
                required
              />
            </FormField>
            <FormField label="SKU" hint="Generated automatically. Saved with your product and draft.">
              <div
                className="flex h-10 items-center rounded-lg border border-border bg-bg-2 px-3 font-mono text-sm font-medium text-fg"
                aria-live="polite"
              >
                {sku}
              </div>
            </FormField>
            <FormField label="Inventory category" htmlFor={`${formId}-cat`} hint="Used in ERP reports and filters.">
              <Select id={`${formId}-cat`} value={category} onChange={(e) => setCategory(e.target.value)}>
                {INVENTORY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Brand" htmlFor={`${formId}-brand`}>
              <Input id={`${formId}-brand`} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Mercedes-Benz" />
            </FormField>
            <FormField label="OEM part number" htmlFor={`${formId}-oem`}>
              <Input id={`${formId}-oem`} value={oem} onChange={(e) => setOem(e.target.value)} placeholder="A0004211010" />
            </FormField>
            <FormField label="Condition" htmlFor={`${formId}-cond`}>
              <Select id={`${formId}-cond`} value={condition} onChange={(e) => setCondition(e.target.value)}>
                <option value="new">New</option>
                <option value="used">Used</option>
              </Select>
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Description" htmlFor={`${formId}-desc`} hint="Fitment notes, warranty, shipping — keep it clear for customers.">
                <Textarea
                  id={`${formId}-desc`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the part, inclusions, and any important notes…"
                  rows={4}
                />
              </FormField>
            </div>
          </div>
        </section>

        <section
          id="add-section-fitment"
          className="scroll-mt-28 rounded-2xl border border-border bg-card p-5 shadow-sm ring-1 ring-inset ring-border/60 sm:p-6"
        >
          <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-ok/10 text-ok ring-1 ring-ok/20">
                <Icons.Cart className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-fg">Vehicle compatibility</h2>
                <p className="mt-0.5 text-sm text-fg/60">Add every vehicle this part fits. More rows help eBay and search.</p>
              </div>
            </div>
            <Button type="button" variant="secondary" size="sm" className="shrink-0 gap-2 self-start sm:self-auto" onClick={addVehicle}>
              <Icons.Plus className="h-4 w-4" />
              Add vehicle
            </Button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl ring-1 ring-border">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="bg-bg-2 text-left text-xs font-semibold uppercase tracking-wide text-fg/55">
                  <th className="px-3 py-3 pl-4">Make</th>
                  <th className="px-3 py-3">Model</th>
                  <th className="w-28 px-3 py-3">Year</th>
                  <th className="px-3 py-3">Engine</th>
                  <th className="w-14 px-2 py-3 pr-4 text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {vehicles.map((row) => (
                  <tr key={row.id} className="align-middle">
                    <td className="p-2 pl-3">
                      <Input
                        aria-label="Make"
                        value={row.make}
                        onChange={(e) => updateVehicle(row.id, { make: e.target.value })}
                        placeholder="Toyota"
                        className="h-9"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        aria-label="Model"
                        value={row.model}
                        onChange={(e) => updateVehicle(row.id, { model: e.target.value })}
                        placeholder="Camry"
                        className="h-9"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        aria-label="Year"
                        value={row.year}
                        onChange={(e) => updateVehicle(row.id, { year: e.target.value })}
                        placeholder="2018–2023"
                        className="h-9"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        aria-label="Engine"
                        value={row.engine}
                        onChange={(e) => updateVehicle(row.id, { engine: e.target.value })}
                        placeholder="2.5L Hybrid"
                        className="h-9"
                      />
                    </td>
                    <td className="p-2 pr-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVehicle(row.id)}
                        disabled={vehicles.length <= 1}
                        className="h-9 w-9 rounded-lg p-0 text-fg/45 hover:bg-danger/10 hover:text-danger disabled:pointer-events-none disabled:opacity-30"
                        aria-label="Remove vehicle row"
                      >
                        <Icons.Trash className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-fg/55">Tip: one row per distinct fitment (e.g. different engine codes).</p>
        </section>

        <section
          id="add-section-pricing"
          className="scroll-mt-28 rounded-2xl border border-border bg-card p-5 shadow-sm ring-1 ring-inset ring-border/60 sm:p-6"
        >
          <div className="flex items-start gap-3 border-b border-border pb-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-warn/10 text-warn ring-1 ring-warn/25">
              <Icons.Tag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-fg">Pricing &amp; stock</h2>
              <p className="mt-0.5 text-sm text-fg/60">All amounts in AUD unless your org uses another currency in Settings.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <FormField label="Cost price (AUD)" htmlFor={`${formId}-cost`}>
              <Input
                id={`${formId}-cost`}
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
              />
            </FormField>
            <FormField label="Selling price (AUD, inc. GST if applicable)" htmlFor={`${formId}-sell`}>
              <Input
                id={`${formId}-sell`}
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="0.00"
              />
            </FormField>
            <FormField label="Quantity on hand" htmlFor={`${formId}-qty`}>
              <Input
                id={`${formId}-qty`}
                type="number"
                min={0}
                step="1"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
              />
            </FormField>
          </div>
        </section>

        <section
          id="add-section-images"
          className="scroll-mt-28 rounded-2xl border border-border bg-card p-5 shadow-sm ring-1 ring-inset ring-border/60 sm:p-6"
        >
          <div className="flex items-start gap-3 border-b border-border pb-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20">
              <Icons.Image className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-fg">Product images</h2>
              <p className="mt-0.5 text-sm text-fg/60">Drag files in or browse. First image is typically used as the main photo.</p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDrop={onDrop}
            className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-bg-2/50 px-4 py-12 text-center transition hover:border-accent/50 hover:bg-accent/5"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="grid h-12 w-12 place-items-center rounded-full bg-card text-fg/50 shadow-sm ring-1 ring-border">
              <Icons.Plus className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-fg">Drop images here or click to upload</p>
            <p className="mt-1 text-xs text-fg/55">PNG, JPG or WebP · multiple files OK</p>
          </div>

          {images.length > 0 ? (
            <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {images.map((img, index) => (
                <li
                  key={img.id}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-bg-2 shadow-sm"
                >
                  <Image src={img.url} alt="" fill />
                  <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    {index === 0 ? "Main" : `Photo ${index + 1}`}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(img.id);
                    }}
                    className="absolute right-2 top-2 h-8 w-8 rounded-lg bg-card/95 p-0 text-fg/70 opacity-0 shadow ring-1 ring-border hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                    aria-label="Remove image"
                  >
                    <Icons.Trash className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section
          id="add-section-ebay"
          className="scroll-mt-28 rounded-2xl border border-border bg-card p-5 shadow-sm ring-1 ring-inset ring-border/60 sm:p-6"
        >
          <div className="flex items-start gap-3 border-b border-border pb-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20">
              <Icons.Tag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-fg">eBay Motors</h2>
              <p className="mt-0.5 text-sm text-fg/60">Map to an eBay category and tune the listing title for search.</p>
            </div>
          </div>
          <div className="mt-6 space-y-5">
            <FormField label="eBay category" htmlFor={`${formId}-ebay-cat`} hint="Choose the closest Motors category for your part.">
              <Select id={`${formId}-ebay-cat`} value={ebayCategory} onChange={(e) => setEbayCategory(e.target.value)}>
                {EBAY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="eBay listing title" htmlFor={`${formId}-ebay-title`} hint="Front-load year, make, model, and part type (eBay best practice).">
              <Input
                id={`${formId}-ebay-title`}
                value={ebayTitle}
                onChange={(e) => setEbayTitle(e.target.value)}
                placeholder="OEM Front Brake Pads for Mercedes W205 C-Class 2015–2021"
                maxLength={80}
              />
              <p className="text-right text-xs text-fg/45">{ebayTitle.length}/80</p>
            </FormField>
            <Switch
              id={`${formId}-sync`}
              checked={syncEbay}
              onCheckedChange={setSyncEbay}
              label="Sync to eBay"
              description="When on, we will create or update the live listing after you publish (requires eBay connection)."
            />
          </div>
        </section>

        <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-border border-l-[3px] border-l-[hsl(var(--accent))] bg-card/95 p-4 shadow-lg shadow-black/10 backdrop-blur sm:flex-row sm:items-center sm:justify-end">
          <p className="mr-auto hidden text-xs text-fg/55 sm:block">
            Drafts exclude images. Category: <span className="font-semibold text-fg/75">{category}</span>.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" className="min-h-10 w-full sm:w-auto" onClick={saveDraft}>
              Save draft
            </Button>
            <Button type="submit" className="min-h-10 w-full gap-2 sm:w-auto">
              Publish product
              <Icons.ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
