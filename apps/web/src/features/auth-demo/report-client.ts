import { apiFetch } from '@interview/auth';

/**
 * The guarded call this demo uses to show authorization as a separate decision
 * from authentication: `/api/reports/summary` needs `items:write`, so
 * anonymous gets 401, `bob` gets 403 and `alice` gets the report.
 *
 * It stays in the application rather than in `@interview/auth` because it is a
 * business endpoint, not part of the session: the library owns signing in,
 * signing out and asking who you are, and nothing else.
 */
export type ReportResult =
  | { ok: true; itemCount: number; requestedBy: string }
  | { ok: false; error: string };

async function json<T>(response: Response): Promise<Partial<T>> {
  try {
    return (await response.json()) as Partial<T>;
  } catch {
    return {};
  }
}

export async function loadReport(): Promise<ReportResult> {
  const response = await apiFetch('/api/reports/summary');
  const body = await json<{
    itemCount: number;
    requestedBy: string;
    required: string;
    code: string;
  }>(response);

  if (response.status === 403) {
    return {
      ok: false,
      error: `403 Forbidden - this account is missing ${body.required ?? 'a permission'}`,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `${response.status} - ${body.code ?? 'failed'}`,
    };
  }

  return {
    ok: true,
    itemCount: body.itemCount ?? 0,
    requestedBy: body.requestedBy ?? '',
  };
}
