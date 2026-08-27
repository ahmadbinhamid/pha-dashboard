import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Mail } from "lucide-react";
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
import { useToast } from "@/context";
import { sendProductEmail } from "@/lib/api/products";
import type { Product } from "@/types/product";
import { sendProductEmailFormSchema, type SendProductEmailFormValues } from "@/lib/validation/sendProductEmail";

interface SendProductEmailModalProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_FORM: SendProductEmailFormValues = { name: "", email: "" };

// Emails the product's title/SKU (plus every product image as an
// attachment) to a recipient the admin picks — triggered by the "Send
// Email" item in the Add to Cart split button's dropdown on the product
// edit page.
export function SendProductEmailModal({ product, open, onOpenChange }: SendProductEmailModalProps) {
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SendProductEmailFormValues>({
    resolver: zodResolver(sendProductEmailFormSchema),
    defaultValues: EMPTY_FORM,
  });

  const mutation = useMutation({
    mutationFn: (values: SendProductEmailFormValues) => sendProductEmail(product._id, values),
    onSuccess: (_res, values) => {
      toast({
        title: "Email sent",
        description: `Sent product details to ${values.email}.`,
        tone: "success",
      });
      reset(EMPTY_FORM);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Could not send email", description: err.message, tone: "danger" });
    },
  });

  const onSubmit = (values: SendProductEmailFormValues) => mutation.mutate(values);

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
            <ModalTitle>Send product by email</ModalTitle>
            <ModalDescription>
              Emails {product.title}'s title, SKU, and every product image (as attachments) to the recipient below.
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <FormField label="Recipient name" required error={errors.name?.message}>
              <Input {...register("name")} placeholder="e.g. John Smith" autoFocus />
            </FormField>
            <FormField label="Recipient email" required error={errors.email?.message}>
              <Input type="email" {...register("email")} placeholder="e.g. john@example.com" />
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
              <Mail className="h-4 w-4" />
              {mutation.isPending ? "Sending…" : "Send Email"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
