/**
 * The request/response shapes the routers work with.
 *
 * Deliberately not `IncomingMessage`/`ServerResponse`: keeping the routing
 * logic a pure function of plain data is what lets the whole login, expiry,
 * refresh and logout flow be tested without starting a server or a browser.
 * `server.ts` is the only place that touches node:http.
 */

export interface ApiRequest {
  method: string;
  pathname: string;
  /** The raw `Cookie` header, if the client sent one. */
  cookie?: string;
  /** Parsed JSON body, if the request had one. */
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
  /** `Set-Cookie` values to write onto the response. */
  cookies?: string[];
}
