import { PERMISSIONS } from '@interview/auth';
import type { Session } from './auth/session';
import type { ApiRequest, ApiResponse } from './http';
import { ITEM_COUNT, findItem, listItems } from './items';

const ITEM_BY_ID = /^\/api\/items\/([^/]+)$/;

/**
 * The API's routing table.
 *
 * The session is injected rather than constructed here so that a test can hand
 * it a fake clock and its own token store, and so the auth routes stay in one
 * module instead of leaking across this one.
 */
export function createRouter(
  session: Session,
): (request: ApiRequest) => ApiResponse {
  return (request) => {
    // /api/auth/* first: those routes own their own method handling.
    const authResponse = session.handle(request);
    if (authResponse) {
      return authResponse;
    }

    if (request.pathname.startsWith('/api/auth/')) {
      return { status: 405, body: { error: 'Method Not Allowed' } };
    }

    if (request.method !== 'GET') {
      return { status: 405, body: { error: 'Method Not Allowed' } };
    }

    // A guarded resource, to show that authorization is a separate decision
    // from authentication: anonymous gets 401, `bob` gets 403, `alice` gets it.
    if (request.pathname === '/api/reports/summary') {
      const result = session.authorize(request, PERMISSIONS.itemsWrite);
      return result.ok
        ? {
            status: 200,
            body: { itemCount: ITEM_COUNT, requestedBy: result.user.username },
          }
        : result.response;
    }

    // Left public on purpose: the existing performance demo reads it without a
    // session, and keeping it that way shows the guard is opt-in per route.
    if (request.pathname === '/api/items') {
      return { status: 200, body: listItems() };
    }

    const match = ITEM_BY_ID.exec(request.pathname);
    if (match) {
      const id = Number(match[1]);
      const item = Number.isInteger(id) ? findItem(id) : undefined;
      return item
        ? { status: 200, body: item }
        : { status: 404, body: { error: 'Item not found' } };
    }

    return { status: 404, body: { error: 'Not Found' } };
  };
}
