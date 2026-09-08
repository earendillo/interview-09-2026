import { findItem, listItems } from './items';

export interface ApiResponse {
  status: number;
  body: unknown;
}

const ITEM_BY_ID = /^\/api\/items\/([^/]+)$/;

export function route(method: string, pathname: string): ApiResponse {
  if (method !== 'GET') {
    return { status: 405, body: { error: 'Method Not Allowed' } };
  }

  if (pathname === '/api/items') {
    return { status: 200, body: listItems() };
  }

  const match = ITEM_BY_ID.exec(pathname);
  if (match) {
    const id = Number(match[1]);
    const item = Number.isInteger(id) ? findItem(id) : undefined;
    return item
      ? { status: 200, body: item }
      : { status: 404, body: { error: 'Item not found' } };
  }

  return { status: 404, body: { error: 'Not Found' } };
}
