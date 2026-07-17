import { useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { Modal } from "@/components/ui/Modal";
import { NAV_ITEMS } from "@/config/nav";
import { Search } from "lucide-react";
import { cn } from "@/utils/cn";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () =>
      NAV_ITEMS.filter((item) =>
        item.label.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Focus after the dialog's own mount/animation frame.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function go(index: number) {
    const item = results[index];
    if (!item) return;
    onOpenChange(false);
    navigate(item.href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(activeIndex);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-[12%] z-50 w-full max-w-lg -translate-x-1/2",
            "overflow-hidden rounded-xs border border-border bg-bg shadow-2xl",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
          onKeyDown={handleKeyDown}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-fg/40" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages…"
              className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg/40"
            />
            <kbd className="hidden shrink-0 rounded-xs border border-border bg-bg-2 px-1.5 py-0.5 text-[10px] font-medium text-fg/50 sm:inline">
              Esc
            </kbd>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-fg/40">
              Navigate
            </div>
            {results.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-fg/45">No matching pages</p>
            ) : (
              results.map((item, i) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => go(i)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xs px-2.5 py-2 text-left text-sm transition",
                    i === activeIndex ? "bg-bg-2 text-fg" : "text-fg/80",
                  )}
                >
                  <span className="text-fg/50">{item.icon({ className: "h-4 w-4" })}</span>
                  {item.label}
                </button>
              ))
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Modal>
  );
}
