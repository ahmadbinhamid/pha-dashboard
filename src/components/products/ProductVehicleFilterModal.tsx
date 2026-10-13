import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import { ProductVehicleSearchPanel } from "@/components/products/ProductVehicleSearchPanel";
import { EMPTY_VEHICLE_SEARCH } from "@/config/fitment";
import { isVehicleSearchEmpty } from "@/lib/products/vehicleSearch";
import type { ProductVehicleSearch } from "@/types/product";

interface ProductVehicleFilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: ProductVehicleSearch;
  onApply: (value: ProductVehicleSearch) => void;
}

// Edits a draft; the list refetches once on Apply, Cancel discards it.
export function ProductVehicleFilterModal({ open, onOpenChange, value, onApply }: ProductVehicleFilterModalProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  function apply() {
    onApply(draft);
    onOpenChange(false);
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-xl">
        <ModalHeader>
          <ModalTitle>Filter by vehicle</ModalTitle>
          <ModalDescription>Show parts that fit any of the selected makes, models, codes and years.</ModalDescription>
        </ModalHeader>

        <ProductVehicleSearchPanel value={draft} onChange={setDraft} />

        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            size="md"
            className="sm:mr-auto"
            disabled={isVehicleSearchEmpty(draft)}
            onClick={() => setDraft(EMPTY_VEHICLE_SEARCH)}
          >
            Clear all
          </Button>
          <Button type="button" variant="secondary" size="md" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="primary" size="md" onClick={apply}>
            Apply filters
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
