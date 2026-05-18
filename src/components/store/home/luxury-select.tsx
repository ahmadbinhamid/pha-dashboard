"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import { Icons } from "@/components/ui/icons";

type Option = { value: string; label: string };

export function LuxurySelect({
  options,
  value,
  onChange,
  placeholder,
  className,
}: {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        disabled={options.length === 0}
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-surface/90 px-4 text-left text-sm text-fg shadow-sm backdrop-blur-sm transition hover:border-accent/40 hover:bg-surface-elevated/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-45"
      >
        <span className={cn("truncate", !selected && "text-fg/45")}>{selected?.label ?? placeholder}</span>
        <Icons.ChevronDown className={cn("shrink-0 text-fg/45 transition", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-white/10 bg-surface-elevated py-1 shadow-xl ring-1 ring-black/40"
            role="listbox"
          >
            {options.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === o.value}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full px-4 py-2.5 text-left text-sm transition hover:bg-white/5",
                    value === o.value && "bg-accent/15 text-accent",
                  )}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
