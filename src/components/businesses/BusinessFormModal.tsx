import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/Modal";
import { RepresentativeFields } from "@/components/businesses/RepresentativeFields";
import { useToast } from "@/context";
import { BUSINESSES_QUERY_KEY, createBusiness, updateBusiness } from "@/lib/api/businesses";
import { businessFormSchema, EMPTY_REPRESENTATIVE, type BusinessFormValues } from "@/lib/validation/business";
import type { Business, BusinessDetail } from "@/types/business";

interface BusinessFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // null => create mode, which also takes the first reps
  business: Business | null;
  onCreated?: (business: BusinessDetail) => void;
}

// Reps are edited one by one on the business page once it exists.
export function BusinessFormModal({ open, onOpenChange, business, onCreated }: BusinessFormModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!business;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BusinessFormValues>({
    resolver: zodResolver(businessFormSchema),
    defaultValues: { name: "", representatives: [EMPTY_REPRESENTATIVE] },
  });

  useEffect(() => {
    if (open) reset({ name: business?.name ?? "", representatives: business ? [] : [EMPTY_REPRESENTATIVE] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, business]);

  const onSaved = () => {
    void queryClient.invalidateQueries({ queryKey: BUSINESSES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ["customers"] });
    void queryClient.invalidateQueries({ queryKey: ["customer"] });
    onOpenChange(false);
  };

  const createMutation = useMutation({
    mutationFn: createBusiness,
    onSuccess: (res) => {
      toast({ title: "Business created", tone: "success" });
      onSaved();
      if (res.data) onCreated?.(res.data);
    },
    onError: (err: Error) => toast({ title: "Create failed", description: err.message, tone: "danger" }),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateBusiness(id, name),
    onSuccess: () => {
      toast({ title: "Business updated", tone: "success" });
      onSaved();
    },
    onError: (err: Error) => toast({ title: "Update failed", description: err.message, tone: "danger" }),
  });

  const isSaving = createMutation.isPending || renameMutation.isPending;

  const onSubmit = (values: BusinessFormValues) => {
    const name = values.name.trim();
    if (business) {
      renameMutation.mutate({ id: business._id, name });
      return;
    }
    createMutation.mutate({
      name,
      representatives: values.representatives.map((rep) => ({
        name: rep.name.trim(),
        email: rep.email.trim() || null,
        phone: rep.phone.trim() || null,
      })),
    });
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-xl">
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[80vh] space-y-5 overflow-y-auto pr-1">
          <ModalHeader>
            <ModalTitle>{isEdit ? "Rename business" : "New business"}</ModalTitle>
            <ModalDescription>
              {isEdit
                ? "Past invoices keep the name they were issued under."
                : "Each representative becomes a separate customer. They may share an email."}
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <FormField label="Business name" required error={errors.name?.message}>
              <Input {...register("name")} placeholder="e.g. ABC Motors" autoFocus />
            </FormField>

            {!isEdit && (
              <div className="space-y-3 border-t border-dashed border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-fg/45">Representatives</p>
                <RepresentativeFields control={control} register={register} errors={errors} />
              </div>
            )}
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="flex-1"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" className="flex-1" disabled={isSaving}>
              {isSaving ? "Saving…" : isEdit ? "Save changes" : "Create business"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
