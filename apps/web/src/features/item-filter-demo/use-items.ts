import { useEffect, useState } from 'react';
import type { Item } from '@interview/shared';
import { fetchItems } from './item-api';

export type ItemsStatus = 'loading' | 'ready' | 'error';

export interface ItemsState {
  /** The API result. Written once, never filtered or sorted in place. */
  items: readonly Item[];
  status: ItemsStatus;
  error: string | null;
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
  });

  useEffect(() => {
    const controller = new AbortController();

    fetchItems(controller.signal)
      .then((items) => setState({ items, status: 'ready', error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          items: [],
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      });

    // StrictMode mounts effects twice in development; aborting the first
    // request keeps the second one from racing it into state.
    return () => controller.abort();
  }, []);

  return state;
}
