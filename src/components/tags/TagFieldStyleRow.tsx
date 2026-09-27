import { ArrowDown, ArrowUp, Bold } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { Switch } from "@/components/ui/Switch";
import { TAG_FIELD_LABEL, TAG_FONT_PT } from "@/config/productTag";
import { cn } from "@/utils/cn";
import type { TagFieldStyle } from "@/types/tags";

const SIZE_OPTIONS = Array.from({ length: (TAG_FONT_PT.max - TAG_FONT_PT.min) / TAG_FONT_PT.step + 1 }, (_, i) => {
  const size = TAG_FONT_PT.min + i * TAG_FONT_PT.step;
  return { value: String(size), label: `${size} pt` };
});

interface TagFieldStyleRowProps {
  field: TagFieldStyle;
  onChange: (patch: Partial<TagFieldStyle>) => void;
  // Omitted for footer fields, which don't reorder.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  hint?: string;
}

// One tag field: show/hide, size, bold and (body fields) its order.
export function TagFieldStyleRow({ field, onChange, onMoveUp, onMoveDown, hint }: TagFieldStyleRowProps) {
  const reorderable = !!(onMoveUp || onMoveDown);

  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-xl border border-border px-3 py-2.5", !field.visible && "bg-bg-2/60")}>
      {reorderable && (
        <div className="flex flex-col">
          <Button type="button" variant="ghost" size="icon" className="h-5 w-6 text-fg/50" disabled={!onMoveUp} onClick={onMoveUp} aria-label={`Move ${TAG_FIELD_LABEL[field.key]} up`}>
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-5 w-6 text-fg/50" disabled={!onMoveDown} onClick={onMoveDown} aria-label={`Move ${TAG_FIELD_LABEL[field.key]} down`}>
            <ArrowDown className="h-3 w-3" />
          </Button>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", field.visible ? "text-fg" : "text-fg/50")}>{TAG_FIELD_LABEL[field.key]}</p>
        {hint && <p className="text-xs text-fg/50">{hint}</p>}
      </div>
      <SingleSelect
        size="sm"
        options={SIZE_OPTIONS}
        value={String(field.size_pt)}
        onChange={(v) => onChange({ size_pt: Number(v) })}
        disabled={!field.visible}
        aria-label={`${TAG_FIELD_LABEL[field.key]} size`}
        className="min-w-24"
      />
      <Button
        type="button"
        variant={field.bold ? "secondary" : "ghost"}
        size="icon"
        className={cn("h-9 w-9", field.bold ? "text-fg" : "text-fg/40")}
        disabled={!field.visible}
        aria-pressed={field.bold}
        aria-label={`${TAG_FIELD_LABEL[field.key]} bold`}
        onClick={() => onChange({ bold: !field.bold })}
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Switch
        checked={field.visible}
        onCheckedChange={(visible) => onChange({ visible })}
        className="border-0 bg-transparent p-0"
      />
    </div>
  );
}
