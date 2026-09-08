import type { Item } from '@interview/shared';

/**
 * Derives the visible list from the API result.
 *
 * `Array.prototype.filter` returns a new array and never touches the input, so
 * the fetched result stays the source of truth: `items` in, `visibleItems`
 * out, original untouched. Clearing the filter simply derives the whole list
 * again - there is nothing to restore.
 */
export function filterItems(
  items: readonly Item[],
  filter: string,
): readonly Item[] {
  const needle = filter.trim().toLowerCase();
  if (needle === '') return items;

  return items.filter((item) => item.name.toLowerCase().includes(needle));
}
