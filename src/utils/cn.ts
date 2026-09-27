import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Theme font sizes (globals.css), or twMerge reads text-compact as a colour.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["compact", "2xs", "3xs", "4xs"] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
