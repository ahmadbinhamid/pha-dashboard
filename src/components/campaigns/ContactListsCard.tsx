import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Tags, Trash2 } from "lucide-react";
import {
  ActionsMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/ActionsMenu";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import { PERMISSIONS } from "@/config/permissions";
import { useToast } from "@/context";
import { useMyAccess } from "@/hooks/useMyAccess";
import { CONTACTS_QUERY_KEY, deleteContactList, getContactLists, renameContactList } from "@/lib/api/campaigns";
import { cn } from "@/utils/cn";

interface ContactListsCardProps {
  active: string | null;
  onSelect: (list: string | null) => void;
}

export function ContactListsCard({ active, onSelect }: ContactListsCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { can } = useMyAccess();
  const canManage = can(PERMISSIONS.campaigns.update);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: [...CONTACTS_QUERY_KEY, "lists"], queryFn: getContactLists });
  const lists = data?.data ?? [];

  const done = (title: string) => {
    void queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
    toast({ title, tone: "success" });
  };
  const fail = (title: string) => (err: Error) => toast({ title, description: err.message, tone: "danger" });

  const renameMutation = useMutation({
    mutationFn: () => renameContactList(renaming!, newName.trim()),
    onSuccess: (res) => {
      if (active === renaming) onSelect(res.data.name);
      setRenaming(null);
      done("List renamed");
    },
    onError: fail("Couldn't rename the list"),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteContactList(deleting!),
    onSuccess: () => {
      if (active === deleting) onSelect(null);
      setDeleting(null);
      done("List removed");
    },
    onError: fail("Couldn't remove the list"),
  });

  return (
    <Card>
      <CardHeader
        title="Lists"
        description="Group contacts to target them in a campaign. Imports and the website popup create lists too."
      />
      <CardContent>
        {lists.length ? (
          <div className="flex flex-wrap gap-2">
            {lists.map((l) => (
              <div
                key={l.name}
                className={cn(
                  "flex items-center gap-1 rounded-full border py-0.5 pl-3 pr-1 text-sm transition",
                  active === l.name ? "border-accent bg-accent/10 text-fg" : "border-border text-fg/80 hover:bg-bg-2",
                )}
              >
                <button type="button" className="flex items-center gap-1.5" onClick={() => onSelect(active === l.name ? null : l.name)}>
                  <Tags className="h-3.5 w-3.5 text-fg/45" />
                  {l.name}
                  <span className="text-xs text-fg/50">{l.subscribed}/{l.total}</span>
                </button>
                {canManage ? (
                  <DropdownMenu>
                    <ActionsMenuTrigger className="h-6 w-6" />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => {
                          setRenaming(l.name);
                          setNewName(l.name);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 text-fg/50" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onSelect={() => setDeleting(l.name)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove list
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-fg/55">No lists yet. Tick contacts below and choose "Add to list", or import a spreadsheet into a list.</p>
        )}
        {lists.length ? <p className="mt-3 text-xs text-fg/50">Numbers are subscribed / total. Click a list to filter the table.</p> : null}
      </CardContent>

      <Modal open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Rename list</ModalTitle>
          </ModalHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              renameMutation.mutate();
            }}
          >
            <FormField label="Name" hint="Using an existing name merges the two lists">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus maxLength={60} />
            </FormField>
            <ModalFooter>
              <Button type="button" variant="secondary" onClick={() => setRenaming(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={!newName.trim() || renameMutation.isPending}>
                Rename
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
      <ConfirmModal
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Remove the "${deleting}" list?`}
        description="The contacts stay; they just leave this list. Campaigns targeting it will reach nobody from it."
        confirmLabel="Remove list"
        tone="danger"
        confirming={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </Card>
  );
}
