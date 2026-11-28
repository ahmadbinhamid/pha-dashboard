import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { FormField } from "@/components/ui/FormField";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import { useToast } from "@/context";
import { CONTACTS_QUERY_KEY, bulkUpdateContactLists, getContactLists } from "@/lib/api/campaigns";
import { pluralize } from "@/utils/format";

interface ContactBulkListModalProps {
  mode: "add" | "remove" | null;
  ids: string[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

export function ContactBulkListModal({ mode, ids, onOpenChange, onDone }: ContactBulkListModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [list, setList] = useState("");
  const { data } = useQuery({ queryKey: [...CONTACTS_QUERY_KEY, "lists"], queryFn: getContactLists, enabled: !!mode });
  const names = (data?.data ?? []).map((l) => l.name);
  const adding = mode === "add";

  useEffect(() => {
    if (mode) setList("");
  }, [mode]);

  const mutation = useMutation({
    mutationFn: () => bulkUpdateContactLists({ ids, ...(adding ? { add: list.trim() } : { remove: list }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
      toast({ title: adding ? `Added to "${list.trim()}"` : `Removed from "${list}"`, tone: "success" });
      onDone();
    },
    onError: (err: Error) => toast({ title: "Couldn't update lists", description: err.message, tone: "danger" }),
  });

  return (
    <Modal open={!!mode} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>{adding ? "Add to list" : "Remove from list"}</ModalTitle>
          <ModalDescription>{pluralize(ids.length, "selected contact")}</ModalDescription>
        </ModalHeader>
        <FormField label="List" hint={adding ? "Pick a list or type a new name" : undefined}>
          <Combobox
            options={names}
            value={list}
            onChange={setList}
            allowCustom={adding}
            placeholder={adding ? "e.g. VIP customers" : "Pick a list"}
            searchPlaceholder="Search lists…"
          />
        </FormField>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="primary" disabled={!list.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
            {adding ? "Add" : "Remove"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
