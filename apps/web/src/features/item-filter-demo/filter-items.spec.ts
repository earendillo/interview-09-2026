import { describe, expect, it } from 'vitest';
import type { Item } from '@interview/shared';
import { filterItems } from './filter-items';

/**
 * UNIT — pure logic, no React, no DOM, nothing mocked.
 *
 * `filterItems` is a pure function of `(items, filter)`, so there is no
 * dependency to fake: the test *is* the contract. What it protects:
 *
 *  - the fetched array is never mutated (the whole feature assumes the API
 *    result stays the source of truth and clearing the filter re-derives it);
 *  - matching is case- and whitespace-insensitive;
 *  - an empty filter returns the *same array reference*, not a copy - the
 *    memoisation in `optimized-panel.tsx` and the `memo`ised list downstream
 *    both compare by identity, so a defensive `items.slice()` here would
 *    silently un-optimise the panel this playground exists to demonstrate.
 */

const items: Item[] = [
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' },
  { id: 12, name: 'Item 12' },
];

describe('filterItems', () => {
  it('returns only the matching items', () => {
    expect(filterItems(items, '12')).toEqual([{ id: 12, name: 'Item 12' }]);
  });

  it('returns a new array and leaves the input untouched', () => {
    const snapshot = JSON.stringify(items);

    const visible = filterItems(items, '2');

    expect(visible).not.toBe(items);
    expect(JSON.stringify(items)).toBe(snapshot);
  });

  it('matches case-insensitively', () => {
    // Fails if the implementation drops either `.toLowerCase()` call - the
    // realistic version of this bug only lowercases the needle, so a dataset
    // with capitalised names stops matching lowercase input.
    expect(filterItems(items, 'ITEM')).toHaveLength(3);
    expect(filterItems(items, 'item 12')).toHaveLength(1);
  });

  it('ignores surrounding whitespace', () => {
    expect(filterItems(items, '  12  ')).toHaveLength(1);
  });

  it('returns the original array reference when the filter is blank', () => {
    // Identity, not equality: `toEqual` would still pass with a copy, and the
    // copy is exactly the bug that breaks the memoised panel.
    expect(filterItems(items, '')).toBe(items);
    expect(filterItems(items, '   ')).toBe(items);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterItems(items, 'nope')).toEqual([]);
  });
});
