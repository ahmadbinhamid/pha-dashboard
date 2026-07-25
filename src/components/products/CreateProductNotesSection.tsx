import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

interface CreateProductNotesSectionProps {
  notes: string[];
  onChange: (notes: string[]) => void;
}

// Draft-only note thread for the create flow — there's no productId to post
// against yet (ProductNotesSection/addProductNote needs one), so these are
// held in form state and posted for real right after the product is created.
export function CreateProductNotesSection({ notes, onChange }: CreateProductNotesSectionProps) {
  const [text, setText] = useState("");

  const handleAdd = () => {
    if (!text.trim()) return;
    onChange([...notes, text.trim()]);
    setText("");
  };

  const handleRemove = (idx: number) => onChange(notes.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Supplier lead time, shelf position, fitment quirks…"
        size="sm"
      />
      <div className="flex justify-end">
        <Button type="button" variant="secondary" size="sm" disabled={!text.trim()} onClick={handleAdd}>
          Add note
        </Button>
      </div>

      {notes.length > 0 && (
        <div className="space-y-2">
          {notes.map((note, idx) => (
            <div
              key={idx}
              className="flex items-start justify-between gap-3 rounded-xs border border-border bg-bg-2/40 p-3"
            >
              <p className="text-sm text-fg/80">{note}</p>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="shrink-0 text-xs text-fg/40 transition hover:text-danger"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
