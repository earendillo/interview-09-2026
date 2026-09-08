import type { Item } from '@interview/shared';

/**
 * A deliberately expensive derived calculation over the visible items,
 * standing in for the real thing (formatting, grouping, charting, a diff).
 *
 * It is pure and depends only on its input, which is exactly what makes it a
 * fair candidate for `useMemo`. `WORK_PER_ITEM` is tuned so a full 500-item
 * pass is measurable (single-digit milliseconds) without freezing the tab.
 */
export const WORK_PER_ITEM = 20_000;

export function expensiveScore(items: readonly Item[]): number {
  let total = 0;

  for (const item of items) {
    for (let i = 0; i < WORK_PER_ITEM; i += 1) {
      total += Math.sqrt(item.id + i);
    }
  }

  return Math.round(total);
}
