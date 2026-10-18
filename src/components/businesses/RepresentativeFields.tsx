import { useFieldArray, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { EMPTY_REPRESENTATIVE, type BusinessFormValues } from "@/lib/validation/business";

interface RepresentativeFieldsProps {
  control: Control<BusinessFormValues>;
  register: UseFormRegister<BusinessFormValues>;
  errors: FieldErrors<BusinessFormValues>;
}

// Rows of reps entered with a new business, each saved as its own customer.
export function RepresentativeFields({ control, register, errors }: RepresentativeFieldsProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "representatives" });

  return (
    <div className="space-y-3">
      {fields.map((field, index) => {
        const rowErrors = errors.representatives?.[index];
        return (
          <div key={field.id} className="space-y-3 rounded-md border border-border p-3">
            <FormField
              label={`Representative ${index + 1}`}
              required
              error={rowErrors?.name?.message}
              aside={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove representative ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-danger" />
                </Button>
              }
            >
              <Input {...register(`representatives.${index}.name`)} placeholder="e.g. John Smith" />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Email" error={rowErrors?.email?.message}>
                <Input type="email" {...register(`representatives.${index}.email`)} placeholder="accounts@example.com" />
              </FormField>
              <FormField label="Phone" error={rowErrors?.phone?.message}>
                <Input {...register(`representatives.${index}.phone`)} placeholder="0412 345 678" />
              </FormField>
            </div>
          </div>
        );
      })}
      <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => append(EMPTY_REPRESENTATIVE)}>
        <Plus className="h-3.5 w-3.5" />
        Add representative
      </Button>
    </div>
  );
}
