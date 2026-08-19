import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/context";
import { editableTextFormSchema, type EditableTextFormValues } from "@/lib/validation/editableText";

interface EditableOrderTextProps {
  orderId: string;
  label: string;
  value: string | null;
  placeholder?: string;
  mutationFn: (orderId: string, value: string) => Promise<unknown>;
  successMessage: string;
  errorMessage: string;
}

// Inline click-to-edit text field — same interaction as EditableOrderAmount,
// generalized for optional order-level string fields (e.g. reference_number).
export function EditableOrderText({
  orderId,
  label,
  value,
  placeholder,
  mutationFn,
  successMessage,
  errorMessage,
}: EditableOrderTextProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
  } = useForm<EditableTextFormValues>({
    resolver: zodResolver(editableTextFormSchema),
    defaultValues: { value: value ?? "" },
  });

  const mutation = useMutation({
    mutationFn: (next: string) => mutationFn(orderId, next),
    onSuccess: () => {
      toast({ title: successMessage, tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setEditing(false);
    },
    onError: (err: Error) => {
      toast({ title: errorMessage, description: err.message, tone: "danger" });
    },
  });

  const onSubmit = (values: EditableTextFormValues) => mutation.mutate(values.value.trim());

  if (editing) {
    return (
      <form className="flex items-center gap-0.5" onSubmit={handleSubmit(onSubmit)}>
        <Input
          autoFocus
          size="sm"
          className="w-40"
          placeholder={placeholder}
          disabled={mutation.isPending}
          {...register("value")}
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
            reset({ value: value ?? "" });
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
      className="group/text inline-flex items-center text-left text-fg/60 hover:text-accent"
      onClick={() => {
        reset({ value: value ?? "" });
        setEditing(true);
      }}
    >
      <span className="relative">
        {value || <span className="italic">{placeholder ?? "Add"}</span>}
        <Pencil className="absolute left-full top-1/2 ml-2.5 h-3 w-3 -translate-y-1/2 opacity-0 transition-opacity group-hover/text:opacity-100" />
      </span>
    </button>
  );
}
