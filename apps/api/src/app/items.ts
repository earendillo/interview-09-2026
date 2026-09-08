import type { Item } from '@interview/shared';

const items: readonly Item[] = [
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' },
  { id: 3, name: 'Item 3' },
];

export function listItems(): readonly Item[] {
  return items;
}

export function findItem(id: number): Item | undefined {
  return items.find((item) => item.id === id);
}
