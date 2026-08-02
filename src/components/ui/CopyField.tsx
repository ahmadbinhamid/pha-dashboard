import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Input } from "@/components/ui/Input";

// Read-only value with a copy-to-clipboard button — used for things like a
// webhook URL that a user needs to paste elsewhere, not edit here.
export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative">
      <Input value={value} readOnly className="pr-10 font-mono text-xs" onFocus={(e) => e.target.select()} />
      <button
        type="button"
        onClick={handleCopy}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-fg/45 hover:text-fg/70"
        aria-label="Copy to clipboard"
      >
        {copied ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
