import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";

type ToastTone = "default" | "success" | "warning" | "danger";
type Toast = { id: string; title: string; description?: string; tone: ToastTone };

type ToastApi = {
  toast: (t: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

function toneClass(tone: ToastTone) {
  switch (tone) {
    case "success":
      return "border-[hsl(var(--ok))]/25 bg-[hsl(var(--ok))]/10";
    case "warning":
      return "border-[hsl(var(--warn))]/25 bg-[hsl(var(--warn))]/10";
    case "danger":
      return "border-[hsl(var(--danger))]/25 bg-[hsl(var(--danger))]/10";
    default:
      return "border-border bg-bg";
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((prev) => [...prev, { ...t, id }].slice(-3));
      window.setTimeout(() => dismiss(id), 2800);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-4 left-1/2 z-[60] flex w-[92vw] max-w-sm -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-2 rounded-xl border p-3 shadow-card backdrop-blur supports-[backdrop-filter]:bg-bg/85",
              toneClass(t.tone),
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{t.title}</div>
              {t.description ? <div className="mt-1 text-sm text-fg/70">{t.description}</div> : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="shrink-0 rounded-md p-0.5 text-fg/40 transition-colors hover:bg-bg-2 hover:text-fg"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
