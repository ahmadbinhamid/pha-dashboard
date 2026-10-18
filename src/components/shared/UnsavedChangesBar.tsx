import { Button } from "@/components/ui/Button";

interface UnsavedChangesBarProps {
  visible: boolean;
  saving: boolean;
  // The <form> the Save button submits, so the bar can sit outside it.
  formId: string;
  onDiscard: () => void;
  saveLabel?: string;
}

/** Sticky save/discard bar that appears only while a form has edits. */
export function UnsavedChangesBar({ visible, saving, formId, onDiscard, saveLabel = "Save changes" }: UnsavedChangesBarProps) {
  if (!visible) return null;
  return (
    <div className="sticky bottom-4 z-20 flex animate-fade-in items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-card sm:px-5">
      <span className="flex items-center gap-2 text-sm text-fg">
        <span className="h-2 w-2 rounded-full bg-warn" />
        Unsaved changes
      </span>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onDiscard} disabled={saving}>
          Discard
        </Button>
        <Button type="submit" form={formId} size="sm" disabled={saving}>
          {saving ? "Saving…" : saveLabel}
        </Button>
      </div>
    </div>
  );
}
