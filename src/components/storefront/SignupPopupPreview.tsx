import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Image } from "@/components/ui/Image";
import { Input } from "@/components/ui/Input";
import { cn } from "@/utils/cn";
import type { SignupPopup } from "@/types/storefront";

interface SignupPopupPreviewProps {
  popup: Pick<SignupPopup, "headline" | "body" | "button_label" | "image_url" | "collect_first_name">;
  // e.g. "10% OFF", shown as a badge when a discount is linked.
  offerLabel: string | null;
  className?: string;
}

/** Static mock of the storefront popup, drawn over a dimmed backdrop. */
export function SignupPopupPreview({ popup, offerLabel, className }: SignupPopupPreviewProps) {
  return (
    <div className={cn("flex justify-center rounded-lg bg-black/50 p-6", className)}>
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-bg shadow-(--shadow-soft)">
        <span className="absolute right-3 top-3 rounded-md p-1 text-fg/40">
          <X className="h-4 w-4" />
        </span>
        {popup.image_url ? (
          <div className="relative h-32 w-full">
            <Image src={popup.image_url} alt="" fill />
          </div>
        ) : null}
        <div className="space-y-3 p-5 text-center">
          {offerLabel ? (
            <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">{offerLabel}</span>
          ) : null}
          <h3 className="text-lg font-semibold text-fg">{popup.headline || "Your headline"}</h3>
          {popup.body ? <p className="text-sm text-fg/60">{popup.body}</p> : null}
          <div className="space-y-2 pt-1">
            {popup.collect_first_name ? <Input placeholder="First name" disabled /> : null}
            <Input placeholder="Email address" disabled />
            <Button type="button" variant="primary" className="w-full" tabIndex={-1}>
              {popup.button_label || "Sign up"}
            </Button>
          </div>
          <p className="text-2xs text-fg/40">No thanks</p>
        </div>
      </div>
    </div>
  );
}
