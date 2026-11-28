import { FormField } from "@/components/ui/FormField";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { Slider } from "@/components/ui/Slider";
import { EmailColorField } from "@/components/campaigns/EmailColorField";
import { DESIGN_FONT_OPTIONS, DESIGN_LIMITS } from "@/config/emailBuilder";
import type { DesignFont, DesignSettings } from "@/types/campaign";

interface EmailDesignSettingsPanelProps {
  settings: DesignSettings;
  onChange: (settings: DesignSettings) => void;
}

export function EmailDesignSettingsPanel({ settings, onChange }: EmailDesignSettingsPanelProps) {
  const set = (patch: Partial<DesignSettings>) => onChange({ ...settings, ...patch });
  return (
    <div className="space-y-4">
      <p className="text-xs text-fg/55">Applies to the whole email. Select a block to style it on its own.</p>
      <FormField label="Font">
        <SingleSelect options={DESIGN_FONT_OPTIONS} value={settings.font_family} onChange={(v) => set({ font_family: v as DesignFont })} />
      </FormField>
      <FormField label="Email width">
        <Slider
          value={settings.content_width}
          onChange={(v) => set({ content_width: v })}
          min={DESIGN_LIMITS.minWidth}
          max={DESIGN_LIMITS.maxWidth}
          step={10}
          formatValue={(v) => `${v}px`}
          ariaLabel="Email width"
        />
      </FormField>
      <EmailColorField label="Page background" value={settings.background_color} onChange={(v) => set({ background_color: v })} />
      <EmailColorField label="Email background" value={settings.content_background} onChange={(v) => set({ content_background: v })} />
      <EmailColorField label="Text colour" value={settings.text_color} onChange={(v) => set({ text_color: v })} />
      <EmailColorField label="Link colour" value={settings.link_color} onChange={(v) => set({ link_color: v })} />
    </div>
  );
}
