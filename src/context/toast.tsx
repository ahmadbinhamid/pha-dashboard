import { createContext, useCallback, useContext, useMemo, useState } from "react";
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

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { ...t, id }].slice(-3));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 2800);
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-[92vw] max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-xl border p-3 shadow-card backdrop-blur supports-[backdrop-filter]:bg-bg/85",
              toneClass(t.tone),
            )}
          >
            <div className="text-sm font-semibold">{t.title}</div>
            {t.description ? <div className="mt-1 text-sm text-fg/70">{t.description}</div> : null}
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
