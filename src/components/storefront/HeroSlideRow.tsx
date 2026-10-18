import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Image } from "@/components/ui/Image";
import {
  ActionsMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/ActionsMenu";
import type { HeroSlide } from "@/types/storefront";

interface HeroSlideRowProps {
  slide: HeroSlide;
  index: number;
  total: number;
  canEdit: boolean;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
}

export function HeroSlideRow({ slide, index, total, canEdit, busy, onToggle, onEdit, onMove, onDelete }: HeroSlideRowProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <span className="w-4 shrink-0 text-center text-xs font-medium text-fg/40 tabular-nums">{index + 1}</span>
      <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-bg-2">
        <Image src={slide.image_url} alt="" fill />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-compact font-medium text-fg">{slide.title}</p>
          {slide.badge ? (
            <Badge variant="outline" className="hidden shrink-0 text-3xs sm:inline-flex">
              {slide.badge}
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-xs text-fg/55">{slide.subtitle || "No subtitle"}</p>
      </div>
      <Badge variant={slide.active ? "ok" : "muted"} className="shrink-0">
        {slide.active ? "Active" : "Hidden"}
      </Badge>
      {canEdit ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={busy}
            onClick={onToggle}
            title={slide.active ? "Hide slide" : "Show slide"}
            aria-label={slide.active ? "Hide slide" : "Show slide"}
          >
            {slide.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <DropdownMenu>
            <ActionsMenuTrigger />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil className="h-3.5 w-3.5 text-fg/50" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onMove(-1)} disabled={busy || index === 0}>
                <ArrowUp className="h-3.5 w-3.5 text-fg/50" />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onMove(1)} disabled={busy || index === total - 1}>
                <ArrowDown className="h-3.5 w-3.5 text-fg/50" />
                Move down
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : null}
    </div>
  );
}
