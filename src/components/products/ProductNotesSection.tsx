import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { ProductFormGroup } from "@/components/products/ProductFormGroup";
import { ProductNoteItem } from "@/components/products/ProductNoteItem";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Textarea } from "@/components/ui/Textarea";
import { PERMISSIONS } from "@/config/permissions";
import { useToast } from "@/context";
import { useMyAccess } from "@/hooks/useMyAccess";
import { addProductNote, deleteProductNote, updateProductNote } from "@/lib/api/products";
import type { ProductInternalNote } from "@/types/product";

interface ProductNotesSectionProps {
  productId: string;
  slug: string;
  notes: ProductInternalNote[];
}

function noteMeta(note: ProductInternalNote) {
  const created = new Date(note.created_at).toLocaleString();
  return note.updated_at ? `${created} · edited` : created;
}

// Internal staff notes, never shown to customers (mirrors OrderNotesSection).
export function ProductNotesSection({ productId, slug, notes }: ProductNotesSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { can } = useMyAccess();
  const canManage = can(PERMISSIONS.products.update);
  const [text, setText] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ProductInternalNote | null>(null);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["product", slug] });
  const onError = (title: string) => (err: Error) => toast({ title, description: err.message, tone: "danger" });

  const addMutation = useMutation({
    mutationFn: () => addProductNote(productId, text.trim()),
    onSuccess: () => {
      setText("");
      refresh();
    },
    onError: onError("Couldn't save note"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ noteId, text }: { noteId: string; text: string }) => updateProductNote(productId, noteId, text),
    onSuccess: refresh,
    onError: onError("Couldn't update note"),
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => deleteProductNote(productId, noteId),
    onSuccess: () => {
      setPendingDelete(null);
      refresh();
    },
    onError: onError("Couldn't delete note"),
  });

  return (
    <Card>
      <ProductFormGroup title="Internal notes" aside="Staff only, never shown to customers">
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a note about this product…"
            size="sm"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!text.trim() || addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              {addMutation.isPending ? "Saving…" : "Save note"}
            </Button>
          </div>
        </div>

        {notes.length === 0 ? (
          <p className="py-4 text-center text-sm text-fg/45">No notes yet.</p>
        ) : (
          <div className="space-y-3">
            {[...notes]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((note) => (
                <ProductNoteItem
                  key={note._id}
                  text={note.text}
                  meta={noteMeta(note)}
                  canManage={canManage}
                  saving={updateMutation.isPending && updateMutation.variables?.noteId === note._id}
                  onSave={(next) => updateMutation.mutateAsync({ noteId: note._id, text: next })}
                  onDelete={() => setPendingDelete(note)}
                />
              ))}
          </div>
        )}
      </ProductFormGroup>

      <ConfirmModal
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this note?"
        description="The note will be removed for all staff. This can't be undone."
        confirmLabel="Delete note"
        tone="danger"
        confirming={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete._id)}
      />
    </Card>
  );
}
