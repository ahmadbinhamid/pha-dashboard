import type { RefObject } from "react";
import { useElementSize } from "@/hooks/useElementSize";

/** Live pixel height of an element (0 until mounted). */
export function useElementHeight(ref: RefObject<HTMLElement | null>) {
  return useElementSize(ref).height;
}
