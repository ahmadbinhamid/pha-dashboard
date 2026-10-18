import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Images, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { HeroSlideFormModal } from "@/components/storefront/HeroSlideFormModal";
import { HeroSlideRow } from "@/components/storefront/HeroSlideRow";
import { MAX_HERO_SLIDES } from "@/config/storefront";
import { useToast } from "@/context";
import { STOREFRONT_SETTINGS_QUERY_KEY, updateHeroSlides } from "@/lib/api/storefront";
import type { HeroSlideFormValues } from "@/lib/validation/storefront";
import type { HeroSlide } from "@/types/storefront";

// Index of the slide in the editor, "new" for an unsaved one.
type EditorTarget = number | "new" | null;

export function HeroSlidesPanel({ slides, canEdit }: { slides: HeroSlide[]; canEdit: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EditorTarget>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: updateHeroSlides,
    onSuccess: (res) => queryClient.setQueryData(STOREFRONT_SETTINGS_QUERY_KEY, res),
    onError: (err: Error) => toast({ title: "Couldn't save slides", description: err.message, tone: "danger" }),
  });

  function save(next: HeroSlide[], message: string, after?: () => void) {
    mutation.mutate(next, {
      onSuccess: () => {
        toast({ title: message, tone: "success" });
        after?.();
      },
    });
  }

  function submitSlide(values: HeroSlideFormValues) {
    if (editing === "new") {
      save([...slides, values], "Slide added", () => setEditing(null));
    } else if (editing !== null) {
      save(slides.map((s, i) => (i === editing ? { ...s, ...values } : s)), "Slide saved", () => setEditing(null));
    }
  }

  function move(index: number, delta: -1 | 1) {
    const next = [...slides];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    save(next, "Order updated");
  }

  const atLimit = slides.length >= MAX_HERO_SLIDES;
  const activeCount = slides.filter((s) => s.active).length;

  return (
    <Card>
      <CardHeader
        title="Hero carousel"
        description={`${activeCount} of ${slides.length} slides showing · up to ${MAX_HERO_SLIDES}`}
        right={
          canEdit ? (
            <Button size="sm" onClick={() => setEditing("new")} disabled={atLimit} title={atLimit ? "Slide limit reached" : undefined}>
              <Plus className="h-4 w-4" />
              Add slide
            </Button>
          ) : null
        }
      />
      {slides.length ? (
        <div className="divide-y divide-border">
          {slides.map((slide, i) => (
            <HeroSlideRow
              key={slide._id ?? i}
              slide={slide}
              index={i}
              total={slides.length}
              canEdit={canEdit}
              busy={mutation.isPending}
              onToggle={() =>
                save(
                  slides.map((s, j) => (j === i ? { ...s, active: !s.active } : s)),
                  slide.active ? "Slide hidden" : "Slide visible",
                )
              }
              onEdit={() => setEditing(i)}
              onMove={(delta) => move(i, delta)}
              onDelete={() => setDeleting(i)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Images}
          title="No hero slides yet"
          description="Add a slide to greet shoppers with a rotating banner on your home page."
          className="py-10"
        />
      )}

      <HeroSlideFormModal
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        slide={typeof editing === "number" ? slides[editing] : null}
        saving={mutation.isPending}
        onSubmit={submitSlide}
      />
      <ConfirmModal
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this slide?"
        description={deleting !== null ? `"${slides[deleting]?.title}" will be removed from the carousel.` : undefined}
        confirmLabel="Delete slide"
        tone="danger"
        confirming={mutation.isPending}
        onConfirm={() =>
          deleting !== null && save(slides.filter((_, i) => i !== deleting), "Slide deleted", () => setDeleting(null))
        }
      />
    </Card>
  );
}
