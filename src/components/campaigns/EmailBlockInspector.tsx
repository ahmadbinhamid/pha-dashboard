import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { Slider } from "@/components/ui/Slider";
import { Switch } from "@/components/ui/Switch";
import { ImageUploadButton } from "@/components/media/ImageUploadButton";
import { EmailColorField } from "@/components/campaigns/EmailColorField";
import { EmailColumnsEditor } from "@/components/campaigns/EmailColumnsEditor";
import { EmailProductPicker } from "@/components/campaigns/EmailProductPicker";
import { EmailSocialLinksEditor } from "@/components/campaigns/EmailSocialLinksEditor";
import { ALIGN_OPTIONS, BLOCK_LABEL, HEADING_LEVEL_OPTIONS, PRODUCT_COLUMN_OPTIONS } from "@/config/emailBuilder";
import type { BlockAlign, DesignBlock } from "@/types/campaign";

interface EmailBlockInspectorProps {
  block: DesignBlock;
  onChange: (block: DesignBlock) => void;
  onSelect: (id: string | null) => void;
  // Set when the block lives inside a column, to offer a way back.
  parentId: string | null;
}

const LINK_HINT = "A full https:// link, or a page on your store like /shop";
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export function EmailBlockInspector({ block, onChange, onSelect, parentId }: EmailBlockInspectorProps) {
  // One setter for every block type; the union keeps props in step with type.
  const set = (patch: Record<string, unknown>) => onChange({ ...block, props: { ...block.props, ...patch } } as DesignBlock);
  const p: { padding_y?: number; background?: string } = block.props;
  const alignField = (value: BlockAlign) => (
    <FormField label="Alignment">
      <SegmentedControl options={ALIGN_OPTIONS} value={value} onChange={(v) => set({ align: v })} ariaLabel="Alignment" size="sm" />
    </FormField>
  );

  function fields() {
    switch (block.type) {
      case "heading":
        return (
          <>
            <FormField label="Text" hint="Merge tags like {{first_name}} work here">
              <Input value={block.props.text} onChange={(e) => set({ text: e.target.value })} />
            </FormField>
            <FormField label="Size">
              <SingleSelect options={HEADING_LEVEL_OPTIONS} value={String(block.props.level)} onChange={(v) => set({ level: Number(v), font_size: undefined })} />
            </FormField>
            {alignField(block.props.align)}
            <EmailColorField label="Colour" value={block.props.color} onChange={(v) => set({ color: v })} clearable />
          </>
        );
      case "text":
        return (
          <>
            <FormField label="Text">
              <RichTextEditor value={block.props.html} onChange={(html) => set({ html })} minHeight="160px" />
            </FormField>
            <FormField label="Font size">
              <Slider value={block.props.font_size ?? 15} onChange={(v) => set({ font_size: v })} min={11} max={28} formatValue={(v) => `${v}px`} ariaLabel="Font size" />
            </FormField>
            {alignField(block.props.align)}
            <EmailColorField label="Colour" value={block.props.color} onChange={(v) => set({ color: v })} clearable />
          </>
        );
      case "button":
        return (
          <>
            <FormField label="Label">
              <Input value={block.props.label} onChange={(e) => set({ label: e.target.value })} />
            </FormField>
            <FormField label="Link" hint={LINK_HINT}>
              <Input value={block.props.url} onChange={(e) => set({ url: e.target.value })} placeholder="/shop" />
            </FormField>
            {alignField(block.props.align)}
            <EmailColorField label="Button colour" value={block.props.bg_color} onChange={(v) => set({ bg_color: v })} />
            <EmailColorField label="Text colour" value={block.props.text_color} onChange={(v) => set({ text_color: v })} />
            <FormField label="Corner rounding">
              <Slider value={block.props.radius} onChange={(v) => set({ radius: v })} min={0} max={40} formatValue={(v) => `${v}px`} ariaLabel="Corner rounding" />
            </FormField>
            <Switch checked={block.props.full_width} onCheckedChange={(v) => set({ full_width: v })} label="Full width" />
          </>
        );
      case "image":
        return (
          <>
            <FormField label="Image" hint="Upload one, or paste an https:// link">
              <div className="space-y-2">
                {block.props.src ? <img src={block.props.src} alt="" className="max-h-32 w-full rounded-md object-contain bg-bg-2" /> : null}
                <ImageUploadButton onUploaded={(url) => set({ src: url })} maxBytes={IMAGE_MAX_BYTES} size="sm" label={block.props.src ? "Replace" : "Upload image"} />
                <Input size="sm" value={block.props.src} onChange={(e) => set({ src: e.target.value })} placeholder="https://…" />
              </div>
            </FormField>
            <FormField label="Description" hint="Shown when images are blocked, and to screen readers">
              <Input value={block.props.alt} onChange={(e) => set({ alt: e.target.value })} />
            </FormField>
            <FormField label="Link (optional)" hint={LINK_HINT}>
              <Input value={block.props.link_url} onChange={(e) => set({ link_url: e.target.value })} />
            </FormField>
            <FormField label="Width">
              <Slider value={block.props.width} onChange={(v) => set({ width: v })} min={10} max={100} step={5} formatValue={(v) => `${v}%`} ariaLabel="Width" />
            </FormField>
            {alignField(block.props.align)}
            <FormField label="Corner rounding">
              <Slider value={block.props.radius} onChange={(v) => set({ radius: v })} min={0} max={40} formatValue={(v) => `${v}px`} ariaLabel="Corner rounding" />
            </FormField>
          </>
        );
      case "logo":
        return (
          <>
            <p className="text-xs text-fg/55">Uses the logo from Settings → Store. No logo set? Your store name shows instead.</p>
            <FormField label="Width">
              <Slider value={block.props.width} onChange={(v) => set({ width: v })} min={40} max={400} step={10} formatValue={(v) => `${v}px`} ariaLabel="Logo width" />
            </FormField>
            {alignField(block.props.align)}
          </>
        );
      case "divider":
        return (
          <>
            <EmailColorField label="Colour" value={block.props.color} onChange={(v) => set({ color: v })} />
            <FormField label="Thickness">
              <Slider value={block.props.thickness} onChange={(v) => set({ thickness: v })} min={1} max={8} formatValue={(v) => `${v}px`} ariaLabel="Thickness" />
            </FormField>
          </>
        );
      case "spacer":
        return (
          <FormField label="Height">
            <Slider value={block.props.height} onChange={(v) => set({ height: v })} min={4} max={160} step={4} formatValue={(v) => `${v}px`} ariaLabel="Height" />
          </FormField>
        );
      case "products":
        return (
          <>
            <FormField label="Products">
              <EmailProductPicker items={block.props.items} onChange={(items) => set({ items })} />
            </FormField>
            <FormField label="Layout">
              <SingleSelect options={PRODUCT_COLUMN_OPTIONS} value={String(block.props.columns)} onChange={(v) => set({ columns: Number(v) })} />
            </FormField>
            <Switch checked={block.props.show_price} onCheckedChange={(v) => set({ show_price: v })} label="Show prices" />
            <FormField label="Link text" hint="Leave blank to hide the link">
              <Input value={block.props.button_label} onChange={(e) => set({ button_label: e.target.value })} />
            </FormField>
            <EmailColorField label="Link colour" value={block.props.accent_color} onChange={(v) => set({ accent_color: v })} />
          </>
        );
      case "social":
        return (
          <>
            <EmailSocialLinksEditor links={block.props.links} onChange={(links) => set({ links })} />
            {alignField(block.props.align)}
            <EmailColorField label="Colour" value={block.props.color} onChange={(v) => set({ color: v })} clearable />
          </>
        );
      case "columns":
        return (
          <>
            <EmailColumnsEditor props={block.props} onChange={(props) => onChange({ ...block, props })} onSelectChild={onSelect} />
            <FormField label="Gap between columns">
              <Slider value={block.props.gap} onChange={(v) => set({ gap: v })} min={0} max={48} step={4} formatValue={(v) => `${v}px`} ariaLabel="Gap" />
            </FormField>
          </>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">{BLOCK_LABEL[block.type]}</h3>
        {parentId ? (
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => onSelect(parentId)}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Columns
          </Button>
        ) : null}
      </div>
      {fields()}
      <Disclosure title="Spacing and background">
        <div className="space-y-4">
          <FormField label="Space above and below">
            <Slider value={p.padding_y ?? (parentId ? 8 : 12)} onChange={(v) => set({ padding_y: v })} min={0} max={80} step={2} formatValue={(v) => `${v}px`} ariaLabel="Vertical spacing" />
          </FormField>
          {!parentId ? (
            <EmailColorField label="Row background" value={p.background} onChange={(v) => set({ background: v })} clearable fallback="#ffffff" />
          ) : null}
        </div>
      </Disclosure>
    </div>
  );
}
