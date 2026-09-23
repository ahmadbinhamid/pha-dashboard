import { Check } from "lucide-react";
import { cn } from "@/utils/cn";

export interface StepDefinition {
  label: string;
}

interface OrderStepperProps {
  steps: StepDefinition[];
  // 1-indexed current step.
  current: number;
}

// Progress through the order wizard. Below `md`, the rail is replaced by "Step 2 of 4 · ..." since four labelled circles don't fit a phone without truncating to initials.
export function OrderStepper({ steps, current }: OrderStepperProps) {
  const activeLabel = steps[current - 1]?.label;

  return (
    <>
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-fg">{activeLabel}</span>
          <span className="shrink-0 text-xs font-medium text-fg/45">
            Step {current} of {steps.length}
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${(current / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="hidden items-center md:flex">
        {steps.map((step, i) => {
          const stepNumber = i + 1;
          const isComplete = stepNumber < current;
          const isCurrent = stepNumber === current;
          return (
            <div key={step.label} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                    isComplete && "bg-ok text-ok-fg",
                    isCurrent && "bg-accent text-accent-fg",
                    !isComplete && !isCurrent && "bg-muted text-fg/40",
                  )}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" /> : stepNumber}
                </span>
                {/* Labels sit beside their number, not under it — the stacked version made the rail twice as tall for no gain. */}
                <span
                  className={cn(
                    "whitespace-nowrap text-xs font-semibold transition-colors",
                    isCurrent ? "text-fg" : isComplete ? "text-fg/70" : "text-fg/40",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {stepNumber < steps.length && (
                <div className={cn("mx-3 h-px flex-1", isComplete ? "bg-ok" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
