import { describe, expect, it } from 'vitest';
import type { Item } from '@interview/shared';
import { ITEM_COUNT } from './items';
import { route } from './router';

describe('route', () => {
  it('returns all items', () => {
    const { status, body } = route('GET', '/api/items');

    expect(status).toBe(200);
    expect(body).toHaveLength(ITEM_COUNT);
    expect((body as Item[])[0]).toEqual({ id: 1, name: 'Item 1' });
    expect((body as Item[])[ITEM_COUNT - 1]).toEqual({
      id: ITEM_COUNT,
      name: `Item ${ITEM_COUNT}`,
    });
  });

  it('returns a single item by id', () => {
    expect(route('GET', '/api/items/1')).toEqual({
      status: 200,
      body: { id: 1, name: 'Item 1' },
    });
  });

  it('returns 404 for an unknown item', () => {
    expect(route('GET', '/api/items/999').status).toBe(404);
  });

  it('returns 404 for an unknown path', () => {
    expect(route('GET', '/api/unknown').status).toBe(404);
  });

  it('returns 405 for a non-GET method', () => {
    expect(route('POST', '/api/items').status).toBe(405);
  });
});
