import { useEffect, useState, type RefObject } from "react";

/** Live pixel height of an element (0 until mounted), via ResizeObserver. */
export function useElementHeight(ref: RefObject<HTMLElement | null>) {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}
