import { useDraggable } from "@dnd-kit/core";
import { BLOCK_PALETTE, BUILDER_DRAG_PREFIX, type PaletteItem } from "@/config/emailBuilder";
import { cn } from "@/utils/cn";
import type { BlockType } from "@/types/campaign";

interface EmailBuilderPaletteProps {
  disabled: boolean;
  onAdd: (type: BlockType) => void;
}

function PaletteTile({ item, disabled, onAdd }: { item: PaletteItem; disabled: boolean; onAdd: (type: BlockType) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${BUILDER_DRAG_PREFIX}${item.type}`,
    data: { paletteType: item.type },
    disabled,
  });
  const Icon = item.icon;
  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={disabled}
      onClick={() => onAdd(item.type)}
      className={cn(
        "flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2 text-left transition hover:border-accent/50 hover:bg-bg-2 disabled:cursor-not-allowed disabled:opacity-50",
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
    </button>
  );
}

export function EmailBuilderPalette({ disabled, onAdd }: EmailBuilderPaletteProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-fg/55">Drag a block onto the email, or click to add it at the end.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-1">
        {BLOCK_PALETTE.map((item) => (
          <PaletteTile key={item.type} item={item} disabled={disabled} onAdd={onAdd} />
        ))}
      </div>
    </div>
  );
}
