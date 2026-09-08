import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@interview/shared';
import { ItemFilterDemo } from './item-filter-demo';
import { resetRequestCount } from './item-api';

/**
 * INTEGRATION - the whole feature, from the fetch to the rendered rows.
 *
 * The only mock is `fetch`. It is a genuine external boundary: it would make
 * a real network call, the test has to control the payload to assert on
 * derived counts, and its call count is itself part of what is under test
 * ("filtering makes no further request"). Everything below it is the real
 * thing - `useItems`, both panels, `filterItems`, `expensiveScore`,
 * `FilterField` and the `memo`ised list all run unmodified. No React
 * component is stubbed: replacing a panel with a fake would delete exactly
 * the wiring these tests exist to cover.
 *
 * The assertions are about behaviour the feature promises - how often the
 * derived calculation ran, how many requests were made, what the filter
 * produced - not about markup details.
 *
 * Note: no `<StrictMode>` here, so render counters step by 1 per update. In
 * the browser they step by 2 and the fetch effect runs twice.
 */

const API_ITEMS: Item[] = Array.from({ length: 60 }, (_, index) => ({
  id: index + 1,
  name: `Item ${index + 1}`,
}));

const fetchMock = vi.fn();

const value = (testId: string) => screen.getByTestId(testId).textContent;
const count = (testId: string) => Number(value(testId));

const clickTimes = (testId: string, times: number) => {
  for (let i = 0; i < times; i += 1) {
    fireEvent.click(screen.getByTestId(testId));
  }
};

const type = (testId: string, text: string) =>
  fireEvent.change(screen.getByTestId(testId), { target: { value: text } });

/** Renders the demo and waits for the mocked request to resolve. */
const renderLoaded = async () => {
  render(<ItemFilterDemo />);
  await waitFor(() => expect(value('items-status')).toBe('ready'));
};

beforeEach(() => {
  resetRequestCount();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => API_ITEMS.map((item) => ({ ...item })),
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loading the API result', () => {
  it('fetches GET /api/items once and stores the result', async () => {
    await renderLoaded();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/items');
    expect(count('items-count')).toBe(API_ITEMS.length);
    expect(count('before-total')).toBe(API_ITEMS.length);
    expect(count('after-total')).toBe(API_ITEMS.length);
  });

  it('reports an error instead of rendering the panels when the request fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    render(<ItemFilterDemo />);

    await waitFor(() => expect(value('items-status')).toBe('error'));
    expect(screen.getByTestId('items-error').textContent).toContain('500');
    expect(screen.queryByTestId('before-visible')).toBeNull();
  });
});

describe('filtering', () => {
  it('does not mutate or replace the fetched result', async () => {
    const original = API_ITEMS.map((item) => ({ ...item }));
    await renderLoaded();

    type('after-filter', '12');

    // `items loaded` reads the fetched array, `visible items` the derived one.
    expect(count('items-count')).toBe(original.length);
    expect(count('after-total')).toBe(original.length);
    expect(count('after-visible')).toBeLessThan(original.length);
  });

  it('produces the expected visible items', async () => {
    await renderLoaded();

    type('after-filter', '12');

    // Items 12 only, out of 1..60.
    expect(count('after-visible')).toBe(1);
    expect(screen.getByTestId('after-rows').textContent).toBe('Item 12');

    type('after-filter', 'item 1');
    // 1, 10-19: 11 of them.
    expect(count('after-visible')).toBe(11);
  });

  it('restores the full dataset when the filter is cleared', async () => {
    await renderLoaded();

    type('after-filter', '12');
    expect(count('after-visible')).toBe(1);

    type('after-filter', '');

    expect(count('after-visible')).toBe(API_ITEMS.length);
  });

  it('clears the filter from the clear button and restores the full list', async () => {
    await renderLoaded();

    // The user flow, driven the way a user drives it: the button does not
    // exist until there is something to clear.
    expect(screen.queryByTestId('after-clear')).toBeNull();

    type('after-filter', '12');
    expect(count('after-visible')).toBe(1);

    fireEvent.click(screen.getByTestId('after-clear'));

    expect(count('after-visible')).toBe(API_ITEMS.length);
    expect(screen.queryByTestId('after-clear')).toBeNull();
    // Focus survived the update that removed the button the user activated.
    expect(screen.getByTestId('after-filter')).toHaveFocus();
  });

  it('announces the match count in a live region as the filter changes', async () => {
    await renderLoaded();

    type('after-filter', '12');

    expect(screen.getByTestId('after-live').textContent).toBe(
      `1 of ${API_ITEMS.length} items match “12”`,
    );
  });

  it('makes no further HTTP request when the filter changes', async () => {
    await renderLoaded();

    type('after-filter', '1');
    type('after-filter', '12');
    type('after-filter', '');
    clickTimes('after-unrelated-button', 3);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(count('request-count')).toBe(1);
  });
});

describe('the bottleneck', () => {
  it('redoes the filter and the expensive calculation on an unrelated state update', async () => {
    await renderLoaded();

    const scoreRuns = count('before-score-runs');
    clickTimes('before-unrelated-button', 3);

    expect(value('before-unrelated')).toBe('3');
    expect(count('before-renders')).toBe(4); // initial + 3 updates
    expect(count('before-filter-runs')).toBe(4);
    expect(count('before-score-runs')).toBe(scoreRuns + 3);
  });

  it('rerenders the memoised list too, because onSelect is a new function', async () => {
    await renderLoaded();

    clickTimes('before-unrelated-button', 3);

    expect(count('before-list-renders')).toBe(4);
  });
});

describe('the optimized panel', () => {
  it('does not redo the calculation on an unrelated state update', async () => {
    await renderLoaded();

    const scoreRuns = count('after-score-runs');
    const score = value('after-score');
    clickTimes('after-unrelated-button', 3);

    expect(value('after-unrelated')).toBe('3');
    expect(count('after-renders')).toBe(4); // the panel still rerenders
    expect(count('after-filter-runs')).toBe(1);
    expect(count('after-score-runs')).toBe(scoreRuns);
    expect(value('after-score')).toBe(score);
  });

  it('does not rerender the memoised list on an unrelated state update', async () => {
    await renderLoaded();

    clickTimes('after-unrelated-button', 3);

    expect(count('after-list-renders')).toBe(1);
  });

  it('recomputes exactly once when the filter actually changes', async () => {
    await renderLoaded();

    const scoreRuns = count('after-score-runs');
    type('after-filter', '12');

    expect(count('after-score-runs')).toBe(scoreRuns + 1);
    expect(count('after-visible')).toBe(1);
  });

  it('produces the same result as the unoptimized panel', async () => {
    await renderLoaded();

    type('before-filter', '12');
    type('after-filter', '12');

    expect(value('after-score')).toBe(value('before-score'));
    expect(value('after-visible')).toBe(value('before-visible'));
  });

  it('still rerenders the list when a prop genuinely changes', async () => {
    await renderLoaded();

    clickTimes('after-unrelated-button', 2);
    expect(count('after-list-renders')).toBe(1);

    const row = screen
      .getByTestId('after-rows')
      .querySelector('button') as HTMLButtonElement;
    fireEvent.click(row);

    expect(count('after-list-renders')).toBe(2);
  });
});
