import { ChannelFieldInput } from "@/components/channels/ChannelFieldInput";
import { ChannelCategorySource } from "@/components/channels/ChannelCategorySource";
import { ChannelOverridesSection, type OverrideValues } from "@/components/channels/ChannelOverridesSection";
import { CHANNEL_FIELD_COMPONENTS } from "@/components/channels/channelFieldRegistry";
import type { ChannelFieldSources } from "@/hooks/useChannelFieldSources";
import type { ChannelFieldDescriptor, ChannelSummary } from "@/types/channel";
import type { MappedCategory } from "@/types/categoryMapping";
import type { ListingProductDefaults } from "@/types/marketplace";
import type { ChannelFormState } from "@/lib/marketplace/channelForms";

const GROUP_LABELS: Record<string, string> = {
  category: "Category",
  condition: "Condition",
  specifics: "Item specifics",
  fitment: "Vehicle fitment",
  policies: "Business policies",
  shipping: "Shipping",
  format: "Selling format",
  identifiers: "Product identifiers",
  advanced: "Listing settings",
};

// Types that need a full row rather than half of the two-column grid.
const FULL_WIDTH_TYPES: ChannelFieldDescriptor["type"][] = ["custom", "category", "textarea"];

interface Props {
  channel: ChannelSummary;
  form: ChannelFormState;
  onChange: (patch: Partial<ChannelFormState>) => void;
  errors: Record<string, string>;
  sources: ChannelFieldSources;
  mappedCategory: MappedCategory | null | undefined;
  productDefaults: ListingProductDefaults;
  supportsPhotos: boolean;
}

// Groups descriptors in schema order, keeping each group together.
function groupSchema(schema: ChannelFieldDescriptor[]) {
  const groups = new Map<string, ChannelFieldDescriptor[]>();
  for (const d of schema) {
    const key = d.group ?? "other";
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return [...groups.entries()];
}

// One channel's panel, rendered from its adapter's fieldSchema (server/.../adapters/*.fieldSchema.js).
export function ChannelFieldsPanel({ channel, form, onChange, errors, sources, mappedCategory, productDefaults, supportsPhotos }: Props) {
  const schema = channel.fieldSchema ?? [];
  const values = form as unknown as Record<string, unknown>;
  const categoryKey = schema.find((d) => d.type === "category")?.key;
  const effectiveCategoryId = (categoryKey && (values[categoryKey] as string)) || mappedCategory?.id || null;

  function renderField(d: ChannelFieldDescriptor) {
    const Custom = CHANNEL_FIELD_COMPONENTS[`${channel.key}.${d.key}`];
    const fallback = sources.fallbacks[d.key] ?? null;
    const field = Custom ? (
      <Custom
        descriptor={d}
        form={form}
        onChange={onChange}
        error={errors[d.key]}
        fallback={fallback}
        effectiveCategoryId={effectiveCategoryId}
      />
    ) : (
      <ChannelFieldInput
        descriptor={d}
        value={values[d.key]}
        onChange={(value) => onChange({ [d.key]: value } as Partial<ChannelFormState>)}
        error={errors[d.key]}
        options={d.optionsSource ? sources.options[d.optionsSource] : undefined}
        fallback={fallback}
      />
    );
    if (d.type !== "category") return field;
    return (
      <div className="space-y-1.5">
        {field}
        <ChannelCategorySource listingValue={values[d.key] as string} mapped={mappedCategory} required={d.required} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {schema.length === 0 && <p className="text-sm text-fg/55">{channel.name} needs nothing beyond the product itself.</p>}
      {groupSchema(schema).map(([group, fields]) => (
        <div key={group} className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-fg/45">{GROUP_LABELS[group] ?? group}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map((d) => (
              <div key={d.key} className={FULL_WIDTH_TYPES.includes(d.type) ? "sm:col-span-2" : undefined}>
                {renderField(d)}
              </div>
            ))}
          </div>
        </div>
      ))}

      <ChannelOverridesSection
        values={form as unknown as OverrideValues}
        onChange={(patch) => onChange(patch as Partial<ChannelFormState>)}
        productDefaults={productDefaults}
        supportsPhotos={supportsPhotos}
        titleMaxLength={channel.productConstraints?.title?.maxLength}
        errors={errors}
      />
    </div>
  );
}
