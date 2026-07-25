import { Button } from "@/components/ui/Button";

interface ProductFormActionsCardProps {
  heading: string;
  buttonLabel: string;
  pendingLabel: string;
  pending: boolean;
  disabled?: boolean;
  caption?: string;
  formId?: string;
  onClick?: () => void;
}

// Sticky sidebar call-to-action — mirrors the main submit button in the page
// header so the primary action stays reachable while scrolling a long form.
export function ProductFormActionsCard({
  heading,
  buttonLabel,
  pendingLabel,
  pending,
  disabled,
  caption,
  formId,
  onClick,
}: ProductFormActionsCardProps) {
  return (
    <div className="rounded-md bg-card p-4 shadow-card ring-1 ring-inset ring-border">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-fg/40">{heading}</p>
      <Button
        type={formId ? "submit" : "button"}
        form={formId}
        onClick={onClick}
        variant="primary"
        size="lg"
        disabled={pending || disabled}
        className="mt-3 w-full ring-2 ring-accent/20 ring-offset-2 ring-offset-card"
      >
        {pending ? pendingLabel : buttonLabel}
      </Button>
      {caption && <p className="mt-2 text-center text-xs text-fg/40">{caption}</p>}
    </div>
  );
}
