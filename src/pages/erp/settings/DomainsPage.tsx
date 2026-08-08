import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/Table";
import { Modal, ModalContent, ModalHeader, ModalFooter, ModalTitle, ModalDescription } from "@/components/ui/Modal";
import { useToast } from "@/context";
import { getDomains, deleteDomain } from "@/lib/api/domains";
import { AddDomainModal } from "@/components/domains/AddDomainModal";
import { DomainRow } from "@/components/domains/DomainRow";
import type { Domain } from "@/types/domain";
import { Plus, Link2, AlertTriangle, Trash2 } from "lucide-react";

export default function DomainsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Domain | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["domains"],
    queryFn: getDomains,
  });

  const domains: Domain[] = data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDomain(id),
    onSuccess: () => {
      toast({ title: "Domain removed", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["domains"] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't remove domain", description: err.message, tone: "danger" });
      setDeleteTarget(null);
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Domains"
        description="Verify a domain you own to use it for your storefront and, later, for accepting payments on it directly."
      >
        <Button variant="primary" size="md" className="gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Domain
        </Button>
      </PageHeader>

      <Card>
        {isLoading ? (
          <LoadingSkeleton />
        ) : domains.length === 0 ? (
          <EmptyState onNew={() => setAddOpen(true)} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((domain) => (
                  <DomainRow key={domain._id} domain={domain} onRequestDelete={setDeleteTarget} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <AddDomainModal open={addOpen} onOpenChange={setAddOpen} />

      {/* Delete confirm modal */}
      <Modal open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        {deleteTarget && (
          <ModalContent className="max-w-sm">
            <ModalHeader>
              <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-danger/10">
                <AlertTriangle className="h-5 w-5 text-danger" />
              </div>
              <ModalTitle>Remove domain?</ModalTitle>
              <ModalDescription>
                <span className="font-medium text-fg">{deleteTarget.hostname}</span>{" "}
                will no longer be trusted for this account. This can't be undone.
              </ModalDescription>
            </ModalHeader>
            <ModalFooter>
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="flex-1"
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="md"
                className="flex-1 gap-2"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget._id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleteMutation.isPending ? "Removing…" : "Remove"}
              </Button>
            </ModalFooter>
          </ModalContent>
        )}
      </Modal>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-border">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <div className="h-4 w-48 animate-pulse rounded-xs bg-bg-2" />
          <div className="h-4 w-24 animate-pulse rounded-xs bg-bg-2" />
          <div className="ml-auto h-4 w-10 animate-pulse rounded-xs bg-bg-2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-xs border border-border bg-bg-2">
        <Link2 className="h-8 w-8 text-fg/30" />
      </div>
      <div>
        <p className="font-medium text-fg">No domains yet</p>
        <p className="mt-1 text-sm text-fg/50">Add a domain you own and verify it to start using it.</p>
      </div>
      <Button variant="primary" size="sm" className="mt-1 gap-1.5" onClick={onNew}>
        <Plus className="h-3.5 w-3.5" />
        Add Domain
      </Button>
    </div>
  );
}
