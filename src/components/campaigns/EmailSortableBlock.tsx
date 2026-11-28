import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, Copy, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BLOCK_LABEL } from "@/config/emailBuilder";
import { cn } from "@/utils/cn";
import type { DesignBlock } from "@/types/campaign";

interface EmailSortableBlockProps {
  block: DesignBlock;
  selected: boolean;
  disabled: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onMove: (delta: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  children: ReactNode;
}

export function EmailSortableBlock(props: EmailSortableBlockProps) {
  const { block, selected, disabled, isFirst, isLast, onSelect, onMove, onDuplicate, onDelete, children } = props;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled,
  });
  const p = block.props as { padding_y?: number; background?: string };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative", isDragging && "z-10 opacity-60")}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div
        className={cn(
          "cursor-pointer outline-2 -outline-offset-2 outline-transparent transition",
          selected ? "outline-accent" : "hover:outline-accent/40",
        )}
        style={{ padding: `${p.padding_y ?? 12}px 24px`, background: p.background || undefined }}
      >
        {children}
      </div>
      {!disabled ? (
        <div
          className={cn(
            "absolute -top-3 right-2 z-20 flex items-center gap-0.5 rounded-md border border-border bg-bg px-1 py-0.5 shadow-sm",
            selected ? "flex" : "hidden group-hover:flex",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="px-1 text-2xs font-medium text-fg/60">{BLOCK_LABEL[block.type]}</span>
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label="Drag to reorder"
            className="cursor-grab rounded p-1 text-fg/50 hover:bg-bg-2 hover:text-fg"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
            <Button aria-label="Move up" type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={isFirst} onClick={() => onMove(-1)}>
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button aria-label="Move down" type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={isLast} onClick={() => onMove(1)}>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button aria-label="Duplicate" type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={onDuplicate}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button aria-label="Delete" type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 text-danger" />
            </Button>
        </div>
      ) : null}
    </div>
  );
}
