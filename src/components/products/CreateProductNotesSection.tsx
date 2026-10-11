import { useState } from "react";
import { ProductNoteItem } from "@/components/products/ProductNoteItem";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

interface CreateProductNotesSectionProps {
  notes: string[];
  onChange: (notes: string[]) => void;
}

// No productId yet, so notes live in form state and post after create.
export function CreateProductNotesSection({ notes, onChange }: CreateProductNotesSectionProps) {
  const [text, setText] = useState("");

  const handleAdd = () => {
    if (!text.trim()) return;
    onChange([...notes, text.trim()]);
    setText("");
  };

  const handleRemove = (idx: number) => onChange(notes.filter((_, i) => i !== idx));
  const handleUpdate = (idx: number, next: string) => onChange(notes.map((n, i) => (i === idx ? next : n)));

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
            <ProductNoteItem
              key={idx}
              text={note}
              onSave={(next) => handleUpdate(idx, next)}
              onDelete={() => handleRemove(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
