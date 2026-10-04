import { Button } from "@/components/ui/Button";
import { FitmentRowsEditor } from "@/components/shared/FitmentRowsEditor";
import { fitmentToForm, isNamedFitment } from "@/lib/products/fitments";
import type { EbayListingFormState } from "@/types/marketplace";
import type { Product } from "@/types/product";

interface Props {
  form: EbayListingFormState;
  onChange: (patch: Partial<EbayListingFormState>) => void;
  product: Pick<Product, "additional_fitments">;
}

export function EbayVehicleFitmentSection({ form, onChange, product }: Props) {
  // The default vehicle lives in Technical Specifications, not this table.
  const productRows = (product.additional_fitments ?? []).map(fitmentToForm).filter(isNamedFitment);

  return (
    <FitmentRowsEditor
      rows={form.fitment}
      onChange={(fitment) => onChange({ fitment })}
      hint="Add all compatible vehicles. eBay uses this to display your listing in fitment search results."
      emptyActions={
        productRows.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange({ fitment: productRows })}>
            Copy from product
          </Button>
        )
      }
    />
  );
}
