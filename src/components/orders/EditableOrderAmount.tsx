import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/context";
import { formatCurrencyFromCents } from "@/utils/format";
import { editableAmountFormSchema, type EditableAmountFormValues } from "@/lib/validation/editableAmount";

interface EditableOrderAmountProps {
  orderId: string;
  label: string;
  amountCents: number;
  // Renders with a leading "-" when non-zero (e.g. Discount) — purely
  // cosmetic, the underlying value stored/submitted is always non-negative.
  negative?: boolean;
  mutationFn: (orderId: string, dollars: number) => Promise<unknown>;
  successMessage: string;
  errorMessage: string;
}

// Inline click-to-edit amount — same interaction as OrderItemsTable's
// EditableUnitPrice, generalized for the order-level Discount/Shipping rows.
export function EditableOrderAmount({
  orderId,
  label,
  amountCents,
  negative,
  mutationFn,
  successMessage,
  errorMessage,
}: EditableOrderAmountProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
  } = useForm<EditableAmountFormValues>({
    resolver: zodResolver(editableAmountFormSchema),
    defaultValues: { amount: String(amountCents / 100) },
  });

  const mutation = useMutation({
    mutationFn: (dollars: number) => mutationFn(orderId, dollars),
    onSuccess: () => {
      toast({ title: successMessage, tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      setEditing(false);
    },
    onError: (err: Error) => {
      toast({ title: errorMessage, description: err.message, tone: "danger" });
    },
  });

  const onSubmit = (values: EditableAmountFormValues) => mutation.mutate(Number(values.amount));

  if (editing) {
    return (
      <form className="flex items-center justify-end gap-0.5" onSubmit={handleSubmit(onSubmit)}>
        <Input
          autoFocus
          type="number"
          step="0.01"
          min="0"
          size="sm"
          className="w-24 text-right"
          disabled={mutation.isPending}
          {...register("amount")}
        />
        <Button
          type="submit"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={mutation.isPending}
          aria-label={`Save ${label}`}
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={mutation.isPending}
          onClick={() => {
            reset({ amount: String(amountCents / 100) });
            setEditing(false);
          }}
          aria-label="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </form>
    );
  }

  return (
    <button
      type="button"
      className="group/amount inline-flex items-center text-fg/60 hover:text-accent"
      onClick={() => {
        reset({ amount: String(amountCents / 100) });
        setEditing(true);
      }}
    >
      {/* The pencil is absolutely positioned (not a gap-ed flex sibling) so
          it never reserves layout space — otherwise this value would sit
          slightly left of every other plain-text row in the same column,
          even while the pencil itself is invisible at opacity-0. */}
      <span className="relative">
        {negative && amountCents > 0 ? "-" : ""}
        {formatCurrencyFromCents(amountCents)}
        <Pencil className="absolute left-full top-1/2 ml-2.5 h-3 w-3 -translate-y-1/2 opacity-0 transition-opacity group-hover/amount:opacity-100" />
      </span>
    </button>
  );
}
