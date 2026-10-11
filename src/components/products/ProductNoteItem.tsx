import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  ActionsMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/ActionsMenu";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

interface ProductNoteItemProps {
  text: string;
  meta?: React.ReactNode;
  canManage?: boolean;
  saving?: boolean;
  // A rejected promise keeps the editor open so the draft isn't lost.
  onSave: (text: string) => Promise<unknown> | void;
  onDelete: () => void;
}

// One internal note with inline edit; shared by the create and edit flows.
export function ProductNoteItem({ text, meta, canManage = true, saving = false, onSave, onDelete }: ProductNoteItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  const startEdit = () => {
    setDraft(text);
    setEditing(true);
  };

  const handleSave = async () => {
    const next = draft.trim();
    if (next === text) return setEditing(false);
    try {
      await onSave(next);
      setEditing(false);
    } catch {
      // The caller's mutation already surfaces the error.
    }
  };

  if (editing) {
    return (
      <div className="space-y-2 rounded-xs border border-border bg-bg-2/40 p-3">
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} size="sm" autoFocus />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!draft.trim() || saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-xs border border-border bg-bg-2/40 p-3">
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap break-words text-sm text-fg/80">{text}</p>
        {meta && <p className="mt-1.5 text-3xs text-fg/40">{meta}</p>}
      </div>
      {canManage && (
        <DropdownMenu>
          <ActionsMenuTrigger className="shrink-0" />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={startEdit}>
              <Pencil className="h-3.5 w-3.5 text-fg/50" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
