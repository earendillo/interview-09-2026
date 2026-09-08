import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './app';

// The session panel probes `/api/auth/me` on mount; this app-level test is
// about the shell of the page, so the call is stubbed out rather than asserted.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ code: 'no_session' }),
        clone() {
          return this;
        },
      } as unknown as Response),
    ),
  );
});

describe('App', () => {
  it('renders the heading', () => {
    const { container } = render(<App />);

    expect(container.querySelector('h1')?.textContent).toBe(
      'Dashboard Application',
    );
  });
});
