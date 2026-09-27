import { Controller, type UseFormReturn } from "react-hook-form";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { Switch } from "@/components/ui/Switch";
import { SHIPPING_METHOD_OPTIONS } from "@/config/shipping";
import { CalculatedShippingNotice } from "@/components/products/CalculatedShippingNotice";
import { missingPackageFields } from "@/lib/products/packageDimensions";
import type { ProductFormValues } from "@/lib/validation/product";

// Storefront shipping: a flat rate per unit, or a Transdirect quote.
export function ProductShippingSection({ methods }: { methods: UseFormReturn<ProductFormValues> }) {
  const {
    control,
    register,
    watch,
    formState: { errors },
  } = methods;
  const method = watch("shipping_method");
  const pkg = watch("package");
  const missingPackage = missingPackageFields(pkg);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Shipping method">
          <Controller
            control={control}
            name="shipping_method"
            render={({ field }) => <SingleSelect options={SHIPPING_METHOD_OPTIONS} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
          />
        </FormField>
        {method === "standard" && (
          <FormField label="Flat rate per unit (A$)" error={errors.shipping_cost?.message} hint="Same charge whatever the customer's postcode.">
            <Input type="number" min="0" step="0.01" {...register("shipping_cost")} placeholder="0.00" />
          </FormField>
        )}
      </div>

      {method === "calculated" && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Controller
              control={control}
              name="tailgate_pickup"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  label="Tailgate pickup"
                  description="No forklift where it's collected. Needed over 25 kg."
                />
              )}
            />
            <Controller
              control={control}
              name="tailgate_delivery"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  label="Tailgate delivery"
                  description="Courier brings a lift for the customer. Needed over 25 kg."
                />
              )}
            />
          </div>
          <CalculatedShippingNotice missingPackage={missingPackage} />
        </>
      )}
    </div>
  );
}
