import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { describeDiscount, discountConditions, discountHeadline, discountOrderLabel, discountSchedule } from "@/lib/discounts/discountDisplay";
import { orderRangeFromForm } from "@/lib/discounts/discountForm";
import type { DiscountFormValues } from "@/lib/validation/discount";

interface DiscountSummaryCardProps {
  values: DiscountFormValues;
  // Save/cancel buttons, rendered under the summary.
  actions: React.ReactNode;
}

/** Live plain-English recap of the form, beside it on wide screens. */
export function DiscountSummaryCard({ values, actions }: DiscountSummaryCardProps) {
  const isAutomatic = values.method === "automatic";
  const range = orderRangeFromForm(values);
  const orders = { min_order_number: range.min, max_order_number: range.max };
  const sentence = describeDiscount({ ...values, ...orders, is_automatic: isAutomatic, code: values.code.toUpperCase() });
  const rows = [
    { label: "How it applies", value: isAutomatic ? "Automatically, no code" : values.code ? `Code ${values.code.toUpperCase()} typed at checkout` : "Code not set yet" },
    { label: "Which orders", value: discountOrderLabel(orders) },
    { label: "Conditions", value: discountConditions(values) },
    { label: "Schedule", value: discountSchedule(values) },
    {
      label: "Limits",
      value: [
        values.limit_usage && values.usage_limit ? `${values.usage_limit} uses` : "Unlimited",
        !isAutomatic || values.once_per_customer ? "once per email" : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
  ];
  return (
    <Card>
      <CardHeader title="Summary" description={values.active ? "Saved as active" : "Saved as paused"} />
      <CardContent className="space-y-4">
        <div>
          <p className="text-xl font-semibold text-fg">{discountHeadline(values)}</p>
          <p className="text-sm text-fg/55">{values.name || "Untitled discount"}</p>
        </div>
        <p className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-fg">{sentence}</p>
        <dl className="space-y-2.5 border-t border-border pt-4">
          {rows.map((r) => (
            <div key={r.label}>
              <dt className="text-xs font-medium uppercase tracking-wider text-fg/45">{r.label}</dt>
              <dd className="mt-0.5 text-sm text-fg">{r.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-2 border-t border-border pt-4">{actions}</div>
      </CardContent>
    </Card>
  );
}
