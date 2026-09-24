import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { SingleSelect } from "@/components/ui/SingleSelect";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/Modal";
import { useToast } from "@/context";
import { recordOrderPayment } from "@/lib/api/orders";
import { PAYMENT_METHOD_LABEL } from "@/config/paymentMethods";
import { formatCurrencyFromCents } from "@/utils/format";
import { recordPaymentFormSchema, type RecordPaymentFormValues } from "@/lib/validation/recordPayment";

interface RecordPaymentModalProps {
  orderId: string;
  balanceDueCents: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAYMENT_METHOD_OPTIONS = (["cash", "online_transfer", "efpos"] as const).map((value) => ({
  value,
  label: PAYMENT_METHOD_LABEL[value],
}));

const EMPTY_FORM: RecordPaymentFormValues = { payment_method: "cash", amount: "" };

// Staff-entered follow-up payment against an order's outstanding balance.
export function RecordPaymentModal({ orderId, balanceDueCents, open, onOpenChange }: RecordPaymentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const schema = useMemo(() => recordPaymentFormSchema(balanceDueCents), [balanceDueCents]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RecordPaymentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    if (!open) reset(EMPTY_FORM);
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: RecordPaymentFormValues) =>
      recordOrderPayment(orderId, { payment_method: values.payment_method, amount: Number(values.amount) }),
    onSuccess: () => {
      toast({ title: "Payment recorded", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      reset(EMPTY_FORM);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't record payment", description: err.message, tone: "danger" });
    },
  });

  const onSubmit = (values: RecordPaymentFormValues) => mutation.mutate(values);

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) reset(EMPTY_FORM);
        onOpenChange(next);
      }}
    >
      <ModalContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>
            <ModalTitle>Record Payment</ModalTitle>
            <ModalDescription>
              Log a cash or bank-transfer payment collected for this order — balance due is currently{" "}
              {formatCurrencyFromCents(balanceDueCents)}.
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <FormField label="Payment Method">
              <Controller
                control={control}
                name="payment_method"
                render={({ field }) => (
                  <SingleSelect
                    options={PAYMENT_METHOD_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                  />
                )}
              />
            </FormField>
            <FormField label="Amount" required error={errors.amount?.message}>
              <Input
                type="number"
                min={0}
                max={balanceDueCents / 100}
                step="0.01"
                placeholder="0.00"
                autoFocus
                {...register("amount")}
              />
            </FormField>
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="flex-1"
              disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" className="flex-1 gap-2" disabled={mutation.isPending}>
              <Wallet className="h-4 w-4" />
              {mutation.isPending ? "Saving…" : "Record Payment"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
