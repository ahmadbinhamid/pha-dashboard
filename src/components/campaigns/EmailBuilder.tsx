import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Eye, LayoutTemplate, Paintbrush, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CampaignTemplatePickerModal } from "@/components/campaigns/CampaignTemplatePickerModal";
import { EmailBlockInspector } from "@/components/campaigns/EmailBlockInspector";
import { EmailBlockPreview } from "@/components/campaigns/EmailBlockPreview";
import { EmailBuilderPalette } from "@/components/campaigns/EmailBuilderPalette";
import { EmailDesignSettingsPanel } from "@/components/campaigns/EmailDesignSettingsPanel";
import { EmailPreviewModal } from "@/components/campaigns/EmailPreviewModal";
import { EmailSortableBlock } from "@/components/campaigns/EmailSortableBlock";
import { SaveTemplateModal } from "@/components/campaigns/SaveTemplateModal";
import { BLOCK_LABEL, DESIGN_FONT_OPTIONS, DESIGN_LIMITS } from "@/config/emailBuilder";
import { PERMISSIONS } from "@/config/permissions";
import { useMyAccess } from "@/hooks/useMyAccess";
import { cloneBlock, createBlock, findBlock, removeBlock, replaceBlock } from "@/lib/campaigns/emailDesign";
import { cn } from "@/utils/cn";
import type { BlockType, DesignBlock, EmailDesign, LeafBlock } from "@/types/campaign";

interface EmailBuilderProps {
  value: EmailDesign;
  onChange: (design: EmailDesign) => void;
  disabled: boolean;
  subject: string;
  preheader: string;
  templateName: string;
}

const CANVAS_ID = "email-canvas";

/** Id of the columns block holding `id`, or null when it is top level. */
function parentOf(design: EmailDesign, id: string) {
  const parent = design.blocks.find((b) => b.type === "columns" && b.props.columns.some((c) => c.blocks.some((x) => x.id === id)));
  return parent?.id ?? null;
}

export function EmailBuilder({ value: design, onChange, disabled, subject, preheader, templateName }: EmailBuilderProps) {
  const { can } = useMyAccess();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragLabel, setDragLabel] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const { setNodeRef: setCanvasRef, isOver } = useDroppable({ id: CANVAS_ID, disabled });

  const selected = selectedId ? findBlock(design, selectedId) : null;
  const full = design.blocks.length >= DESIGN_LIMITS.maxBlocks;
  const font = DESIGN_FONT_OPTIONS.find((f) => f.value === design.settings.font_family)?.stack;
  const setBlocks = (blocks: DesignBlock[]) => onChange({ ...design, blocks });

  function insertBlock(type: BlockType, index = design.blocks.length) {
    if (full) return;
    const block = createBlock(type);
    const blocks = [...design.blocks];
    blocks.splice(index, 0, block);
    setBlocks(blocks);
    setSelectedId(block.id);
  }

  function onDragStart(e: DragStartEvent) {
    const paletteType = e.active.data.current?.paletteType as BlockType | undefined;
    const block = paletteType ? null : design.blocks.find((b) => b.id === e.active.id);
    setDragLabel(paletteType ? BLOCK_LABEL[paletteType] : block ? BLOCK_LABEL[block.type] : null);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setDragLabel(null);
    if (!over) return;
    const paletteType = active.data.current?.paletteType as BlockType | undefined;
    const overIndex = design.blocks.findIndex((b) => b.id === over.id);
    if (paletteType) {
      insertBlock(paletteType, overIndex >= 0 ? overIndex : design.blocks.length);
      return;
    }
    const from = design.blocks.findIndex((b) => b.id === active.id);
    if (from >= 0 && overIndex >= 0 && from !== overIndex) setBlocks(arrayMove(design.blocks, from, overIndex));
  }

  const renderChild = (child: LeafBlock) => (
    <div
      className={cn(
        "cursor-pointer rounded outline-2 -outline-offset-2 outline-transparent",
        selectedId === child.id ? "outline-accent" : "hover:outline-accent/40",
      )}
      style={{ padding: `${child.props.padding_y ?? 8}px 0` }}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedId(child.id);
      }}
    >
      <EmailBlockPreview block={child} />
    </div>
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragLabel(null)}>
      <div className="grid items-start gap-4 xl:grid-cols-12">
        <Card className="p-3 xl:sticky xl:top-4 xl:col-span-2">
          <EmailBuilderPalette disabled={disabled || full} onAdd={(type) => insertBlock(type)} />
        </Card>

        <div className="min-w-0 space-y-3 xl:col-span-7">
          <div className="flex flex-wrap items-center gap-2">
            {!disabled ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => setTemplatesOpen(true)}>
                <LayoutTemplate className="h-4 w-4" />
                Templates
              </Button>
            ) : null}
            <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedId(null)}>
              <Paintbrush className="h-4 w-4" />
              Email style
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setPreviewOpen(true)} disabled={!design.blocks.length}>
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            {can(PERMISSIONS.campaigns.create) ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setSaveOpen(true)} disabled={!design.blocks.length}>
                <Save className="h-4 w-4" />
                Save as template
              </Button>
            ) : null}
          </div>

          <div
            className="overflow-x-auto rounded-xl border border-border p-4 sm:p-6"
            style={{ background: design.settings.background_color }}
            onClick={() => setSelectedId(null)}
          >
            <div
              ref={setCanvasRef}
              className={cn("mx-auto min-h-72 rounded-lg shadow-sm transition", isOver && "outline-2 outline-offset-4 outline-dashed outline-accent")}
              style={{
                maxWidth: design.settings.content_width,
                background: design.settings.content_background,
                color: design.settings.text_color,
                fontFamily: font,
              }}
            >
              {design.blocks.length ? (
                <SortableContext items={design.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  <div className="py-2">
                    {design.blocks.map((block, i) => (
                      <EmailSortableBlock
                        key={block.id}
                        block={block}
                        selected={selectedId === block.id}
                        disabled={disabled}
                        isFirst={i === 0}
                        isLast={i === design.blocks.length - 1}
                        onSelect={() => setSelectedId(block.id)}
                        onMove={(delta) => setBlocks(arrayMove(design.blocks, i, i + delta))}
                        onDuplicate={() => {
                          const blocks = [...design.blocks];
                          blocks.splice(i + 1, 0, cloneBlock(block));
                          setBlocks(blocks);
                        }}
                        onDelete={() => {
                          onChange(removeBlock(design, block.id));
                          setSelectedId(null);
                        }}
                      >
                        <EmailBlockPreview block={block} renderChild={renderChild} />
                      </EmailSortableBlock>
                    ))}
                  </div>
                </SortableContext>
              ) : (
                <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-fg/55">
                  <p>Drag blocks here from the left, or start from a ready-made layout.</p>
                  {!disabled ? (
                    <Button type="button" variant="primary" size="sm" onClick={() => setTemplatesOpen(true)}>
                      <LayoutTemplate className="h-4 w-4" />
                      Choose a template
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
            <p className="mx-auto mt-3 text-center text-2xs text-fg/45" style={{ maxWidth: design.settings.content_width }}>
              Your store details and an unsubscribe link are added below this automatically.
            </p>
          </div>
        </div>

        <Card className="p-4 xl:sticky xl:top-4 xl:col-span-3">
          <fieldset disabled={disabled} className="min-w-0">
            {selected ? (
              <EmailBlockInspector
                key={selected.id}
                block={selected}
                parentId={parentOf(design, selected.id)}
                onSelect={setSelectedId}
                onChange={(next) => onChange(replaceBlock(design, next.id, next))}
              />
            ) : (
              <>
                <h3 className="mb-3 text-sm font-semibold text-fg">Email style</h3>
                <EmailDesignSettingsPanel settings={design.settings} onChange={(settings) => onChange({ ...design, settings })} />
              </>
            )}
          </fieldset>
        </Card>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragLabel ? (
          <div className="rounded-lg border border-accent bg-bg px-3 py-2 text-sm font-medium text-fg shadow-lg">{dragLabel}</div>
        ) : null}
      </DragOverlay>

      <CampaignTemplatePickerModal
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onPick={(next) => {
          onChange(next);
          setSelectedId(null);
        }}
      />
      <EmailPreviewModal open={previewOpen} onOpenChange={setPreviewOpen} design={design} subject={subject} preheader={preheader} />
      <SaveTemplateModal open={saveOpen} onOpenChange={setSaveOpen} design={design} defaultName={templateName} />
    </DndContext>
  );
}
