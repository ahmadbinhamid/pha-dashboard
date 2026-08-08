import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Modal, ModalContent, ModalHeader, ModalFooter, ModalTitle, ModalDescription } from "@/components/ui/Modal";
import { useToast } from "@/context";
import { createDomain } from "@/lib/api/domains";

export function AddDomainModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hostname, setHostname] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createDomain,
    onSuccess: () => {
      toast({ title: "Domain added", description: "Add the DNS record shown to verify it.", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["domains"] });
      setHostname("");
      setError(null);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setError(err.message || "Could not add this domain");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = hostname.trim();
    if (!trimmed) {
      setError("Enter a domain");
      return;
    }
    setError(null);
    createMutation.mutate(trimmed);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setHostname("");
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <ModalContent>
        <form onSubmit={handleSubmit}>
          <ModalHeader>
            <ModalTitle>Add domain</ModalTitle>
            <ModalDescription>
              Enter a domain you own — you'll need to add a DNS record to verify it before it's used.
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <FormField label="Domain" required error={error ?? undefined}>
              <Input
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="e.g. shop.example.com"
                autoFocus
              />
            </FormField>
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="flex-1"
              disabled={createMutation.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" className="flex-1" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Adding…" : "Add domain"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
