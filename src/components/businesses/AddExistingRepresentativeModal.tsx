import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { InlineNotice } from "@/components/ui/InlineNotice";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/Modal";
import { CustomerSearchCombobox } from "@/components/pos/CustomerSearchCombobox";
import { useToast } from "@/context";
import { BUSINESSES_QUERY_KEY } from "@/lib/api/businesses";
import { updateCustomer } from "@/lib/api/customers";
import type { Business } from "@/types/business";
import type { Customer } from "@/types/customer";

interface AddExistingRepresentativeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  business: Business;
  // Search came up empty: hand off to the new-customer form with the text.
  onCreateNew: (searchText: string) => void;
}

// Links a customer already on file, moving them if another business has them.
export function AddExistingRepresentativeModal({
  open,
  onOpenChange,
  business,
  onCreateNew,
}: AddExistingRepresentativeModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Customer | null>(null);

  useEffect(() => {
    if (open) setSelected(null);
  }, [open]);

  const alreadyHere = selected?.business_id === business._id;
  const otherBusiness = selected?.business && !alreadyHere ? selected.business.name : null;

  const linkMutation = useMutation({
    mutationFn: (customer: Customer) => updateCustomer(customer._id, { business_name: business.name }),
    onSuccess: (_res, customer) => {
      toast({ title: `${customer.name} added to ${business.name}`, tone: "success" });
      void queryClient.invalidateQueries({ queryKey: BUSINESSES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      void queryClient.invalidateQueries({ queryKey: ["customers-search"] });
      void queryClient.invalidateQueries({ queryKey: ["customer"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ title: "Add failed", description: err.message, tone: "danger" }),
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>Add existing customer</ModalTitle>
          <ModalDescription>
            Link a customer already on file to {business.name}. Their past invoices are unchanged.
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-3">
          <FormField label="Customer">
            <CustomerSearchCombobox
              value={selected}
              onSelect={setSelected}
              onCreateNew={(text) => {
                onOpenChange(false);
                onCreateNew(text);
              }}
            />
          </FormField>
          {alreadyHere && <InlineNotice variant="ok">{selected?.name} is already a representative here.</InlineNotice>}
          {otherBusiness && (
            <InlineNotice variant="warn">
              {selected?.name} is currently under {otherBusiness} and will be moved to {business.name}.
            </InlineNotice>
          )}
        </div>

        <ModalFooter>
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="flex-1"
            disabled={linkMutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            className="flex-1"
            disabled={!selected || alreadyHere || linkMutation.isPending}
            onClick={() => selected && linkMutation.mutate(selected)}
          >
            {linkMutation.isPending ? "Adding…" : otherBusiness ? "Move here" : "Add to business"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
