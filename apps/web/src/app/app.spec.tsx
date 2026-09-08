import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './app';

// The item demo fetches on mount; this suite is only about the shell markup,
// so the HTTP boundary is stubbed rather than exercised.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('App', () => {
  it('renders the heading and the item list', () => {
    const { container } = render(<App />);

    expect(container.querySelector('h1')?.textContent).toBe('Web Application');
    // Scoped to the item list: the page also renders the rendering demo,
    // whose explanation is a list of its own.
    const list = container.querySelector('[data-testid="item-list"]');
    expect(
      [...(list?.querySelectorAll('li') ?? [])].map((li) => li.textContent),
    ).toEqual(['Item 1', 'Item 2']);
  });
});
