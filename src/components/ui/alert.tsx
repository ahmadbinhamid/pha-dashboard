import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";

const alertVariants = cva(
  "relative flex w-full gap-3 rounded-xs border p-4 text-sm",
  {
    variants: {
      variant: {
        default: "border-border bg-bg-2 text-fg",
        info: "border-blue-500/25 bg-blue-500/8 text-blue-700 dark:text-blue-300",
        success: "border-ok/25 bg-ok/8 text-ok",
        warning: "border-warn/25 bg-warn/8 text-warn-fg",
        danger: "border-danger/25 bg-danger/8 text-danger",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

const ICONS = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: AlertCircle,
} as const;

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", title, children, ...props }, ref) => {
    const Icon = ICONS[variant ?? "default"];
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          {title && (
            <p className="mb-1 font-semibold leading-none tracking-tight">
              {title}
            </p>
          )}
          {children && (
            <div className="text-sm opacity-90">{children}</div>
          )}
        </div>
      </div>
    );
  },
);
Alert.displayName = "Alert";

export { Alert };
