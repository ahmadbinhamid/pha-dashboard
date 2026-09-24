import { ChannelFieldInput } from "@/components/channels/ChannelFieldInput";
import { ChannelCategorySource } from "@/components/channels/ChannelCategorySource";
import { ChannelOverridesSection, type OverrideValues } from "@/components/channels/ChannelOverridesSection";
import { CHANNEL_FIELD_COMPONENTS } from "@/components/channels/channelFieldRegistry";
import type { ChannelFieldSources } from "@/hooks/useChannelFieldSources";
import type { ChannelFieldDescriptor, ChannelSummary } from "@/types/channel";
import type { MappedCategory } from "@/types/categoryMapping";
import type { ListingProductDefaults } from "@/types/marketplace";
import type { Product } from "@/types/product";
import type { ChannelFormState } from "@/lib/marketplace/channelForms";
import { InheritedChannelField } from "@/components/channels/InheritedChannelField";
import { clearedValue, hasOverride, productValueLabel } from "@/lib/marketplace/inheritedFields";

const GROUP_LABELS: Record<string, string> = {
  category: "Listing",
  condition: "Condition",
  specifics: "Item specifics",
  fitment: "Fitment",
  policies: "Policies",
  shipping: "Package",
  format: "Selling format",
  identifiers: "Identifiers",
  advanced: "Listing settings",
};

// Types that span the full grid row.
const FULL_WIDTH_TYPES: ChannelFieldDescriptor["type"][] = ["custom", "category", "textarea"];

export const OVERRIDES_SECTION = { key: "overrides", label: "Advanced" };

/** DOM id of a panel section, for the drawer's section nav. */
export function channelSectionId(channelKey: string, sectionKey: string) {
  return `channel-${channelKey}-${sectionKey}`;
}

// Groups descriptors, preserving schema order.
function groupSchema(schema: ChannelFieldDescriptor[]) {
  const groups = new Map<string, ChannelFieldDescriptor[]>();
  for (const d of schema) {
    const key = d.group ?? "other";
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return [...groups.entries()];
}

/** Section list, in order, for navigation. */
export function channelFieldSections(schema: ChannelFieldDescriptor[]) {
  return [...groupSchema(schema).map(([key]) => ({ key, label: GROUP_LABELS[key] ?? key })), OVERRIDES_SECTION];
}

interface Props {
  channel: ChannelSummary;
  product: Product;
  form: ChannelFormState;
  onChange: (patch: Partial<ChannelFormState>) => void;
  errors: Record<string, string>;
  sources: ChannelFieldSources;
  mappedCategory: MappedCategory | null | undefined;
  productDefaults: ListingProductDefaults;
  supportsPhotos: boolean;
}

// One channel's settings, rendered from its adapter's fieldSchema.
export function ChannelFieldsPanel({
  channel,
  product,
  form,
  onChange,
  errors,
  sources,
  mappedCategory,
  productDefaults,
  supportsPhotos,
}: Props) {
  const schema = channel.fieldSchema ?? [];
  const values = form as unknown as Record<string, unknown>;
  const categoryKey = schema.find((d) => d.type === "category")?.key;
  const effectiveCategoryId = (categoryKey && (values[categoryKey] as string)) || mappedCategory?.id || null;

  function renderField(d: ChannelFieldDescriptor) {
    const Custom = CHANNEL_FIELD_COMPONENTS[`${channel.key}.${d.key}`];
    const fallback = sources.fallbacks[d.key] ?? null;
    const inherited = !!d.inheritsFrom;
    const field = Custom ? (
      <Custom
        descriptor={d}
        form={form}
        onChange={onChange}
        error={errors[d.key]}
        fallback={fallback}
        effectiveCategoryId={effectiveCategoryId}
        product={product}
      />
    ) : (
      <ChannelFieldInput
        descriptor={d}
        value={values[d.key]}
        onChange={(value) => onChange({ [d.key]: value } as Partial<ChannelFormState>)}
        error={errors[d.key]}
        options={d.optionsSource ? sources.options[d.optionsSource] : undefined}
        fallback={fallback}
        fallbackPrefix={sources.fallbackPrefixes[d.key]}
        bare={inherited}
      />
    );
    if (d.inheritsFrom) {
      return (
        <InheritedChannelField
          label={d.label}
          channelName={channel.name}
          productValue={productValueLabel(d.inheritsFrom, product)}
          overridden={hasOverride(values[d.key])}
          onReset={() => onChange({ [d.key]: clearedValue(values[d.key]) } as Partial<ChannelFormState>)}
          error={errors[d.key]}
        >
          {field}
        </InheritedChannelField>
      );
    }
    if (d.type !== "category") return field;
    return (
      <div className="space-y-1.5">
        {field}
        <ChannelCategorySource listingValue={values[d.key] as string} mapped={mappedCategory} required={d.required} />
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {schema.length === 0 && <p className="p-5 text-sm text-fg/55">{channel.name} needs nothing beyond the product itself.</p>}
      {groupSchema(schema).map(([group, fields]) => (
        <section key={group} id={channelSectionId(channel.key, group)} className="scroll-mt-4 space-y-4 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-fg/55">{GROUP_LABELS[group] ?? group}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map((d) => (
              <div key={d.key} className={FULL_WIDTH_TYPES.includes(d.type) ? "sm:col-span-2" : undefined}>
                {renderField(d)}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section id={channelSectionId(channel.key, OVERRIDES_SECTION.key)} className="scroll-mt-4 p-5">
        <ChannelOverridesSection
          values={form as unknown as OverrideValues}
          onChange={(patch) => onChange(patch as Partial<ChannelFormState>)}
          productDefaults={productDefaults}
          supportsPhotos={supportsPhotos}
          titleMaxLength={channel.productConstraints?.title?.maxLength}
          errors={errors}
        />
      </section>
    </div>
  );
}
