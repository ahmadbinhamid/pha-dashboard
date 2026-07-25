import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormSection } from "@/components/products/FormSection";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/context";
import { addProductNote } from "@/lib/api/products";
import type { ProductInternalNote } from "@/types/product";

interface ProductNotesSectionProps {
  productId: string;
  slug: string;
  notes: ProductInternalNote[];
  number: number;
}

// Internal staff comment thread — distinct from the customer-facing
// description. Notes accumulate over time and are never shown to customers.
// Mirrors OrderNotesSection.tsx exactly.
export function ProductNotesSection({ productId, slug, notes, number }: ProductNotesSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");

  const mutation = useMutation({
    mutationFn: () => addProductNote(productId, text.trim()),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["product", slug] });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't save note", description: err.message, tone: "danger" });
    },
  });

  return (
    <FormSection number={number} title="Internal notes" description="Staff only — never shown to customers">
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
            disabled={!text.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Saving…" : "Save Note"}
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
              <div key={note._id} className="rounded-xs border border-border bg-bg-2/40 p-3">
                <p className="text-sm text-fg/80">{note.text}</p>
                <p className="mt-1.5 text-[10px] text-fg/40">{new Date(note.created_at).toLocaleString()}</p>
              </div>
            ))}
        </div>
      )}
    </FormSection>
  );
}
