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

export function OrderStepper({ steps, current }: OrderStepperProps) {
  return (
    <div className="flex items-center">
      {steps.map((step, i) => {
        const stepNumber = i + 1;
        const isComplete = stepNumber < current;
        const isCurrent = stepNumber === current;
        return (
          <div key={step.label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition",
                  isComplete && "bg-[hsl(var(--ok))] text-white",
                  isCurrent && "bg-accent text-accent-fg ring-4 ring-accent/20",
                  !isComplete && !isCurrent && "bg-bg-2 text-fg/40 ring-1 ring-inset ring-border",
                )}
              >
                {isComplete ? <Check className="h-3.5 w-3.5" /> : stepNumber}
              </div>
              <span
                className={cn(
                  "whitespace-nowrap text-xs font-medium",
                  isCurrent ? "text-fg" : isComplete ? "text-fg/70" : "text-fg/40",
                )}
              >
                {step.label}
              </span>
            </div>
            {stepNumber < steps.length && (
              <div className={cn("mx-3 h-px flex-1", isComplete ? "bg-[hsl(var(--ok))]" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
