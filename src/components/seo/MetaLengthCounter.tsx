import { cn } from "@/utils/cn";

interface MetaLengthCounterProps {
  length: number;
  ideal: number;
  // Below this a description reads thin in results.
  min?: number;
}

/** "52 / 60", amber past what Google shows and when too short. */
export function MetaLengthCounter({ length, ideal, min = 0 }: MetaLengthCounterProps) {
  const over = length > ideal;
  const short = length > 0 && length < min;
  return (
    <span className={cn("text-xs tabular-nums", over || short ? "text-warn" : "text-fg/50")}>
      {length} / {ideal}
      {over ? " · may be cut off" : short ? " · a bit short" : ""}
    </span>
  );
}
