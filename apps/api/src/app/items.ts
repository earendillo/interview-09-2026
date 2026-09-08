import type { Item } from '@interview/shared';

/**
 * How many items the API serves.
 *
 * Big enough that filtering and the derived calculation in the web app's
 * performance demo are actually observable, small enough to stay an in-memory
 * fixture. There is no database here on purpose.
 */
export const ITEM_COUNT = 500;

const items: readonly Item[] = Array.from(
  { length: ITEM_COUNT },
  (_, index) => ({ id: index + 1, name: `Item ${index + 1}` }),
);

export function listItems(): readonly Item[] {
  return items;
}

export function findItem(id: number): Item | undefined {
  return items.find((item) => item.id === id);
}
