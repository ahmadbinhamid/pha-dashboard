import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { TagFieldStyleRow } from "@/components/tags/TagFieldStyleRow";
import { TagPreview } from "@/components/tags/TagPreview";
import {
  DEFAULT_TAG_STYLE,
  PRODUCT_TAG_SIZE_MM,
  TAG_ALIGN_OPTIONS,
  TAG_BODY_FIELDS,
  TAG_FONT_OPTIONS,
  TAG_LINE_SPACING_OPTIONS,
  TAG_MARGIN_MM,
  TAG_QR_POSITION_OPTIONS,
} from "@/config/productTag";
import { useToast } from "@/context";
import { TAG_QUERY_KEYS, updateTagStyle } from "@/lib/api/tags";
import type { TagContent, TagFieldKey, TagFieldStyle, TagStyle } from "@/types/tags";

const MARGIN_OPTIONS = Array.from({ length: (TAG_MARGIN_MM.max - TAG_MARGIN_MM.min) / TAG_MARGIN_MM.step + 1 }, (_, i) => {
  const mm = TAG_MARGIN_MM.min + i * TAG_MARGIN_MM.step;
  return { value: String(mm), label: `${mm} mm` };
});
const FIELD_HINT: Partial<Record<TagFieldKey, string>> = {
  title: "Always printed in full, shrinks from this size if needed.",
  note: "Latest internal note, up to two lines.",
  bay: "Printed as a black chip.",
};

interface TagStyleEditorProps {
  style: TagStyle;
  // Real content to preview with, e.g. the first queued product.
  sample: TagContent;
}

// Tenant-wide tag look: layout, then each field's size, weight and order.
export function TagStyleEditor({ style, sample }: TagStyleEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(style);
  useEffect(() => setDraft(style), [style]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(style);
  const set = <K extends keyof TagStyle>(key: K, value: TagStyle[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const body = draft.fields.filter((f) => TAG_BODY_FIELDS.includes(f.key));
  const footer = draft.fields.filter((f) => !TAG_BODY_FIELDS.includes(f.key));
  const patchField = (key: TagFieldKey, patch: Partial<TagFieldStyle>) =>
    setDraft((d) => ({ ...d, fields: d.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)) }));
  // Swaps a body field with its neighbour; footer fields keep their place.
  const move = (index: number, by: -1 | 1) =>
    setDraft((d) => {
      const next = [...body];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return { ...d, fields: [...next, ...footer] };
    });

  const saveMutation = useMutation({
    mutationFn: () => updateTagStyle(draft),
    onSuccess: (res) => {
      queryClient.setQueryData(TAG_QUERY_KEYS.style, res);
      toast({ title: "Tag style saved", tone: "success" });
    },
    onError: (err: Error) => toast({ title: "Couldn't save the tag style", description: err.message, tone: "danger" }),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader
          title="Tag style"
          description={`Applies to every tag. Size stays ${PRODUCT_TAG_SIZE_MM.width} × ${PRODUCT_TAG_SIZE_MM.height} mm for your printer.`}
          right={
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={saveMutation.isPending} onClick={() => setDraft(DEFAULT_TAG_STYLE)}>
                Reset
              </Button>
              <Button type="button" variant="primary" size="sm" disabled={!dirty || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                {saveMutation.isPending ? "Saving…" : "Save style"}
              </Button>
            </div>
          }
        />
        <CardContent className="space-y-6">
          <section className="space-y-3">
            <p className="text-2xs font-semibold uppercase tracking-wider text-fg/55">Layout</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <FormField label="Font">
                <SingleSelect options={TAG_FONT_OPTIONS} value={draft.font} onChange={(v) => set("font", v as TagStyle["font"])} />
              </FormField>
              <FormField label="QR code">
                <SingleSelect options={TAG_QR_POSITION_OPTIONS} value={draft.qr_position} onChange={(v) => set("qr_position", v as TagStyle["qr_position"])} />
              </FormField>
              <FormField label="Alignment">
                <SingleSelect options={TAG_ALIGN_OPTIONS} value={draft.align} onChange={(v) => set("align", v as TagStyle["align"])} />
              </FormField>
              <FormField label="Line spacing">
                <SingleSelect options={TAG_LINE_SPACING_OPTIONS} value={draft.line_spacing} onChange={(v) => set("line_spacing", v as TagStyle["line_spacing"])} />
              </FormField>
              <FormField label="Margins">
                <SingleSelect options={MARGIN_OPTIONS} value={String(draft.margin_mm)} onChange={(v) => set("margin_mm", Number(v))} />
              </FormField>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-2xs font-semibold uppercase tracking-wider text-fg/55">Body · top to bottom</p>
            {body.map((f, i) => (
              <TagFieldStyleRow
                key={f.key}
                field={f}
                hint={FIELD_HINT[f.key]}
                onChange={(patch) => patchField(f.key, patch)}
                onMoveUp={i > 0 ? () => move(i, -1) : undefined}
                onMoveDown={i < body.length - 1 ? () => move(i, 1) : undefined}
              />
            ))}
          </section>

          <section className="space-y-2">
            <p className="text-2xs font-semibold uppercase tracking-wider text-fg/55">Footer</p>
            {footer.map((f) => (
              <TagFieldStyleRow key={f.key} field={f} hint={FIELD_HINT[f.key]} onChange={(patch) => patchField(f.key, patch)} />
            ))}
          </section>
        </CardContent>
      </Card>

      <Card className="h-fit lg:sticky lg:top-6 lg:col-span-2">
        <CardHeader title="Preview" description="Updates as you edit, the print matches it." />
        <CardContent>
          <div className="flex justify-center rounded-xl bg-bg-2 px-3 py-6">
            <TagPreview content={sample} style={draft} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
