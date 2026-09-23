import { useNavigate } from "react-router-dom";
import { ArrowRight, Blocks } from "lucide-react";

// A blank strip (the old behavior) reads as a bug, not "nothing connected yet" — this is the one place on the Products/Listings pages that says so and points at where to fix it.
export function NoChannelsConnectedCard() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate("/settings/integrations")}
      className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-left transition-colors hover:border-accent/40 hover:bg-muted/40"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
        <Blocks className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">No sales channels connected</span>
        <span className="block text-xs text-fg/50">Connect eBay or Google Shopping to start listing products.</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-fg/30" />
    </button>
  );
}
