import { cn } from "@/utils/cn";

export function LoginCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-fg/75">
      <span
        className={cn(
          "grid h-4 w-4 place-items-center rounded border border-border bg-bg shadow-sm",
          checked ? "border-accent bg-accent text-accent-fg" : "",
        )}
        aria-hidden="true"
      >
        {checked ? (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
            <path
              d="M20 6 9 17l-5-5"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
