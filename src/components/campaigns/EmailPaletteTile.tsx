import { useDraggable } from "@dnd-kit/core";
import { Button } from "@/components/ui/Button";
import { BUILDER_DRAG_PREFIX } from "@/config/emailBuilder";
import { cn } from "@/utils/cn";
import type { BlockType, PaletteItem } from "@/types/campaign";

interface EmailPaletteTileProps {
  item: PaletteItem;
  disabled: boolean;
  onAdd: (type: BlockType) => void;
}

/** A block in the builder palette: drag it onto the email, or click to add. */
export function EmailPaletteTile({ item, disabled, onAdd }: EmailPaletteTileProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${BUILDER_DRAG_PREFIX}${item.type}`,
    data: { paletteType: item.type },
    disabled,
  });
  const Icon = item.icon;
  return (
    <Button
      ref={setNodeRef}
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={() => onAdd(item.type)}
      className={cn(
        "h-auto w-full cursor-grab justify-start gap-2.5 rounded-lg bg-card px-2.5 py-2 text-left font-normal hover:border-accent/50",
        isDragging && "opacity-40",
      )}
      {...attributes}
      {...listeners}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{item.label}</span>
        <span className="block truncate text-2xs text-fg/50">{item.hint}</span>
      </span>
    </Button>
  );
}
