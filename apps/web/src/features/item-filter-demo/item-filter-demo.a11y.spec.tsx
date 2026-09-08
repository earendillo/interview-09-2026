import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'jest-axe';
import type { Item } from '@interview/shared';
import { ItemFilterDemo } from './item-filter-demo';
import { resetRequestCount } from './item-api';

/**
 * ACCESSIBILITY REGRESSION — the whole feature, rendered for real, with only
 * `fetch` mocked (same boundary as the integration spec).
 *
 * Scope, stated honestly: axe-core is a static rule engine. It catches the
 * machine-checkable subset - missing names, bad roles, broken label
 * associations - and it is blind to whether focus went somewhere sensible,
 * whether the live region says something useful, or whether the whole flow
 * makes sense with a screen reader. A green run here means "no obvious
 * violations of the rules we ran", not "accessible". The keyboard and focus
 * behaviour is covered by the explicit assertions in `filter-field.spec.tsx`
 * and by the E2E journey in `apps/web-e2e`.
 */

const API_ITEMS: Item[] = Array.from({ length: 30 }, (_, index) => ({
  id: index + 1,
  name: `Item ${index + 1}`,
}));

const fetchMock = vi.fn();

/**
 * Only WCAG 2.0/2.1 A and AA rules. axe's "best-practice" set also flags
 * choices this playground makes on purpose - `<section>` demo blocks that are
 * not landmarks - and a check that is always red is a check nobody reads.
 */
const check = (element: HTMLElement) =>
  axe(element, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    },
  });

beforeEach(() => {
  resetRequestCount();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => API_ITEMS.map((item) => ({ ...item })),
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ItemFilterDemo accessibility', () => {
  it('has no WCAG A/AA violations once the items are loaded', async () => {
    const { container } = render(<ItemFilterDemo />);
    await waitFor(() =>
      expect(screen.getByTestId('items-status').textContent).toBe('ready'),
    );

    expect(await check(container)).toHaveNoViolations();
  });

  it('has no WCAG A/AA violations with a filter applied and a row selected', async () => {
    // The state the bug lived in: the clear button only exists while the
    // filter is non-empty, so an "initial render only" check never saw it.
    const { container } = render(<ItemFilterDemo />);
    await waitFor(() =>
      expect(screen.getByTestId('items-status').textContent).toBe('ready'),
    );

    fireEvent.change(screen.getByTestId('after-filter'), {
      target: { value: 'Item 1' },
    });
    fireEvent.click(
      screen.getByTestId('after-rows').querySelector('button') as HTMLElement,
    );

    expect(screen.getByTestId('after-clear')).toBeInTheDocument();
    expect(await check(container)).toHaveNoViolations();
  });

  it('conveys row selection to assistive technology, not by colour alone', async () => {
    // axe cannot see this one: a row styled as selected is valid markup
    // whether or not it says so. It needs an explicit assertion.
    render(<ItemFilterDemo />);
    await waitFor(() =>
      expect(screen.getByTestId('items-status').textContent).toBe('ready'),
    );

    const row = screen
      .getByTestId('after-rows')
      .querySelector('button') as HTMLElement;
    expect(row).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(row);

    expect(row).toHaveAttribute('aria-pressed', 'true');
  });

  it('announces a failed load instead of silently emptying the page', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    render(<ItemFilterDemo />);

    expect(await screen.findByRole('alert')).toHaveTextContent('500');
  });
});
