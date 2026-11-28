import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { REDIRECT_TYPE_OPTIONS } from "@/config/seo";
import { useToast } from "@/context";
import { SEO_QUERY_KEY, createRedirect, updateRedirect } from "@/lib/api/seo";
import { redirectFormSchema, type RedirectFormValues } from "@/lib/validation/seo";
import type { Redirect, RedirectType } from "@/types/seo";

interface RedirectFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Null adds a new redirect.
  redirect: Redirect | null;
}

const toFormValues = (r: Redirect | null): RedirectFormValues => ({
  from_path: r?.from_path ?? "",
  to_path: r?.to_path ?? "",
  type: r ? (String(r.type) as RedirectFormValues["type"]) : "301",
});

export function RedirectFormModal({ open, onOpenChange, redirect }: RedirectFormModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<RedirectFormValues>({
    resolver: zodResolver(redirectFormSchema),
    defaultValues: toFormValues(redirect),
  });

  useEffect(() => {
    if (open) reset(toFormValues(redirect));
  }, [open, redirect, reset]);

  const mutation = useMutation({
    mutationFn: (v: RedirectFormValues) => {
      const payload = { from_path: v.from_path, to_path: v.to_path, type: Number(v.type) as RedirectType };
      return redirect ? updateRedirect(redirect._id, payload) : createRedirect(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SEO_QUERY_KEY });
      toast({ title: redirect ? "Redirect saved" : "Redirect added", tone: "success" });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ title: "Couldn't save the redirect", description: err.message, tone: "danger" }),
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>{redirect ? "Edit redirect" : "Add redirect"}</ModalTitle>
          <ModalDescription>Send visitors and Google from an old address to a new one, e.g. after renaming a product.</ModalDescription>
        </ModalHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <FormField label="Old address" required hint="A path like /old-brake-pads, or paste the full old URL" error={errors.from_path?.message}>
            <Input {...register("from_path")} placeholder="/old-brake-pads" autoFocus />
          </FormField>
          <FormField label="Send to" required hint="A store page like /product/new-brake-pads, or https://…" error={errors.to_path?.message}>
            <Input {...register("to_path")} placeholder="/product/new-brake-pads" />
          </FormField>
          <FormField label="Type">
            <Controller
              control={control}
              name="type"
              render={({ field }) => <SingleSelect options={REDIRECT_TYPE_OPTIONS} value={field.value} onChange={field.onChange} />}
            />
          </FormField>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={mutation.isPending}>
              {redirect ? "Save" : "Add redirect"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
