import { useEffect, useState } from 'react';
import type { Item } from '@interview/shared';
import { fetchItems, getRequestCount } from './item-api';

export type ItemsStatus = 'loading' | 'ready' | 'error';

export interface ItemsState {
  /** The API result. Written once, never filtered or sorted in place. */
  items: readonly Item[];
  status: ItemsStatus;
  error: string | null;
  /**
   * How many HTTP requests this feature has made, snapshotted into state when
   * one settles.
   *
   * Reading the module counter during render instead would be a render that
   * depends on mutable state React knows nothing about: nothing subscribes to
   * it, so the displayed number would only ever update as a side effect of
   * some *other* state change happening to rerender the component. Putting it
   * in state is what makes "filtering makes no further request" an observable
   * claim rather than a coincidence.
   */
  requests: number;
}

/**
 * Loads `GET /api/items` once into local state.
 *
 * Deliberately local state and not Context or React Query: only this feature
 * reads the data, it is fetched once and never invalidated, and nothing else
 * in the app needs to share the cache. See docs/item-filter-demo.md for when
 * each of the three would be the right call.
 */
export function useItems(): ItemsState {
  const [state, setState] = useState<ItemsState>({
    items: [],
    status: 'loading',
    error: null,
    requests: 0,
  });

  useEffect(() => {
    const controller = new AbortController();

    fetchItems(controller.signal)
      .then((items) =>
        setState({
          items,
          status: 'ready',
          error: null,
          requests: getRequestCount(),
        }),
      )
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          items: [],
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          requests: getRequestCount(),
        });
      });

    // StrictMode mounts effects twice in development; aborting the first
    // request keeps the second one from racing it into state.
    return () => controller.abort();
  }, []);

  return state;
}
