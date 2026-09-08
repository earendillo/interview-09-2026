import { useRef } from 'react';

/**
 * Counts how often the calling component has rendered.
 *
 * The counter lives in a ref, so incrementing it never schedules another
 * render (unlike state) and the value survives across renders (unlike a
 * plain local variable).
 *
 * Note for the live demo: `main.tsx` renders the app inside `<StrictMode>`,
 * and StrictMode double-invokes the render function in development. In the
 * browser these counters therefore step by 2 per update; in tests (no
 * StrictMode) and in a production build they step by 1. The absolute numbers
 * are not the point - the difference between the two columns is.
 */
export function useRenderCount(): number {
  const renders = useRef(0);
  renders.current += 1;
  return renders.current;
}
