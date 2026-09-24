import { Controller, type UseFormReturn } from "react-hook-form";
import { Badge } from "@/components/ui/Badge";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { Switch } from "@/components/ui/Switch";
import { ProductImages } from "@/components/media/ProductImages";
import { FormSection } from "@/components/products/FormSection";
import { ProductVehicleSection } from "@/components/products/ProductVehicleSection";
import { CONDITIONS, AUTHENTICITY_OPTIONS } from "@/config/productOptions";
import type { ProductFormValues } from "@/lib/validation/product";
import { cn } from "@/utils/cn";

interface ProductFormSectionsProps {
  methods: UseFormReturn<ProductFormValues>;
  categoryOptions: { value: string; label: string }[];
  // Tightest title limit any channel imposes (eBay: 80); Infinity when none.
  titleLimit: number;
  // Mode-specific slots: SKU (edit only), stock block and notes (create only).
  skuField?: React.ReactNode;
  stock: { description: string; content: React.ReactNode };
  notes?: React.ReactNode;
  storefrontDescription: string;
  onUploadingChange: (uploading: boolean) => void;
  autoFocusTitle?: boolean;
}

// Numbered product sections, identical on create and edit.
export function ProductFormSections({
  methods,
  categoryOptions,
  titleLimit,
  skuField,
  stock,
  notes,
  storefrontDescription,
  onUploadingChange,
  autoFocusTitle,
}: ProductFormSectionsProps) {
  const {
    register,
    control,
    setValue,
    watch,
    formState: { errors },
  } = methods;
  const form = watch();

  return (
    <div className="space-y-5">
      <FormSection number={1} title="Basic Info">
        <FormField
          label="Product title"
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
          <Input {...register("title")} placeholder="e.g. Front brake pad set, ceramic" autoFocus={autoFocusTitle} />
        </FormField>

        <div className={cn("grid grid-cols-1 gap-3", skuField ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          {skuField && <FormField label="SKU">{skuField}</FormField>}
          <FormField label="Barcode">
            <Input {...register("barcode")} placeholder="Scan or type EAN / UPC" maxLength={13} />
          </FormField>
          <FormField label="Manufacturer part number">
            <Input {...register("mpn")} placeholder="e.g. 45022-TBC-A01" />
          </FormField>
        </div>

        <Controller
          control={control}
          name="is_published_online"
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={field.onChange} label="Show on storefront" description={storefrontDescription} />
          )}
        />
      </FormSection>

      <FormSection number={2} title="Pricing" tag={<span className="text-xs text-fg/40">All amounts in A$</span>}>
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
      </FormSection>

      <FormSection number={3} title="Classification & fitment">
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
            <Controller
              control={control}
              name="condition"
              render={({ field }) => <SingleSelect options={CONDITIONS} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
            />
          </FormField>
          <FormField label="Authenticity">
            <Controller
              control={control}
              name="authenticity"
              render={({ field }) => (
                <SingleSelect
                  options={AUTHENTICITY_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="Select authenticity…"
                />
              )}
            />
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
                setValue(key as keyof ProductFormValues, value as never, { shouldValidate: true, shouldDirty: true });
              }
            }}
            yearRangeError={errors.vehicle_year_to?.message}
          />
        </div>
      </FormSection>

      <FormSection number={4} title="Stock" description={stock.description}>
        {stock.content}
      </FormSection>

      <FormSection
        number={5}
        title="Media"
        tag={<Badge variant="outline">{form.images.length} {form.images.length === 1 ? "Image" : "Images"}</Badge>}
      >
        <Controller
          control={control}
          name="images"
          render={({ field }) => <ProductImages images={field.value} onChange={field.onChange} onUploadingChange={onUploadingChange} />}
        />
      </FormSection>

      {notes && (
        <FormSection number={6} title="Internal notes">
          {notes}
        </FormSection>
      )}
    </div>
  );
}
