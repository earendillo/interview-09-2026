import type { Item } from '@interview/shared';

/**
 * The one HTTP call this feature makes. It is a plain `fetch` against the
 * existing API - relative, so the Vite dev proxy (see `vite.config.mts`)
 * forwards it to http://localhost:3333 and no CORS or base-URL config is
 * needed in the client.
 */
export const ITEMS_URL = '/api/items';

/** Incremented on every request, so the demo can show that filtering makes none. */
let requestCount = 0;

export function getRequestCount(): number {
  return requestCount;
}

/** Test helper: the counter is module state, so it has to be resettable. */
export function resetRequestCount(): void {
  requestCount = 0;
}

export async function fetchItems(signal?: AbortSignal): Promise<Item[]> {
  requestCount += 1;

  const response = await fetch(ITEMS_URL, { signal });
  if (!response.ok) {
    throw new Error(`GET ${ITEMS_URL} failed with ${response.status}`);
  }

  return (await response.json()) as Item[];
}
