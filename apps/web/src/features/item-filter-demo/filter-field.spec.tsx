import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'jest-axe';
import { FilterField } from './filter-field';

/**
 * UNIT — one component in isolation.
 *
 * What is real: `FilterField` itself, its DOM and its focus handling.
 * What is faked: nothing but the parent. `onChange` is a `vi.fn()` because
 * the component is controlled - its only collaborator is the state owner, and
 * a spy is both the cheapest and the most precise stand-in for it. There is
 * no HTTP, no timer and no child component to mock here.
 *
 * What these tests protect: the accessibility contract of the control, which
 * is the part a refactor silently breaks. See
 * docs/testing-and-accessibility.md.
 */

const renderField = (value: string) => {
  const onChange = vi.fn();
  const view = render(
    <FilterField
      testId="demo"
      value={value}
      onChange={onChange}
      matchCount={value === '' ? 3 : 1}
      totalCount={3}
    />,
  );
  return { onChange, ...view };
};

/** A parent that actually owns the state, for the focus test below. */
function ControlledFilterField({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <FilterField
      testId="demo"
      value={value}
      onChange={setValue}
      matchCount={value === '' ? 3 : 1}
      totalCount={3}
    />
  );
}

describe('the filter input', () => {
  it('has an accessible name from its visible label', () => {
    renderField('');

    // Queried the way a screen reader resolves it, not by test id.
    expect(screen.getByRole('textbox', { name: 'Filter' })).toBe(
      screen.getByTestId('demo-filter'),
    );
  });

  it('reports every keystroke to the owner of the state', () => {
    const { onChange } = renderField('');

    fireEvent.change(screen.getByTestId('demo-filter'), {
      target: { value: '12' },
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith('12');
  });
});

describe('the clear button', () => {
  it('is not rendered while the filter is empty', () => {
    renderField('');

    expect(screen.queryByRole('button', { name: 'Clear filter' })).toBeNull();
  });

  it('has an accessible name even though its content is a decorative glyph', () => {
    renderField('12');

    // The bug this replaced: the "×" is `aria-hidden`, so without the
    // `aria-label` the button is announced as an unnamed "button". Asserting
    // the *name* rather than the presence of an attribute keeps the test
    // honest if the label ever moves to `aria-labelledby` or visible text.
    expect(screen.getByTestId('demo-clear')).toHaveAccessibleName(
      'Clear filter',
    );
  });

  it('clears the filter', () => {
    const { onChange } = renderField('12');

    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('');
  });

  it('moves focus back to the input, because clearing unmounts the button', () => {
    // The regression test for the second half of the accessibility bug: the
    // activated element disappears from the DOM as a result of activating it.
    // Without the explicit `focus()` in the handler, focus falls back to
    // `<body>` and a keyboard user restarts from the top of the document.
    render(<ControlledFilterField initial="12" />);
    const button = screen.getByRole('button', { name: 'Clear filter' });
    button.focus();
    expect(button).toHaveFocus();

    fireEvent.click(button);

    expect(screen.queryByRole('button', { name: 'Clear filter' })).toBeNull();
    expect(screen.getByTestId('demo-filter')).toHaveFocus();
  });
});

describe('the result announcement', () => {
  it('is a polite live region, so filtering is not a silent DOM swap', () => {
    renderField('');

    // `role="status"` implies `aria-live="polite"`; querying by role asserts
    // the behaviour rather than the attribute that happens to produce it.
    expect(screen.getByRole('status')).toHaveTextContent('Showing all 3 items');
  });

  it('reports the match count for a non-empty filter', () => {
    renderField('12');

    expect(screen.getByRole('status')).toHaveTextContent(
      '1 of 3 items match “12”',
    );
  });
});

describe('automated accessibility check', () => {
  // Scoped to WCAG 2.0/2.1 A and AA. axe's "best-practice" rules also fire on
  // things this page does deliberately (a demo section that is not a
  // landmark), and a check nobody can keep green stops being read.
  const check = (element: HTMLElement) =>
    axe(element, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      },
    });

  it('finds no violations in the filled-in state', async () => {
    const { container } = renderField('12');

    expect(await check(container)).toHaveNoViolations();
  });

  it('finds no violations in the empty state', async () => {
    const { container } = renderField('');

    expect(await check(container)).toHaveNoViolations();
  });

  it('would have caught the original bug', async () => {
    // The pre-fix markup, kept only as a fixture. Without it the assertions
    // above prove nothing: a check that has never failed is not a check.
    const { container } = render(
      <button type="button" onClick={() => undefined}>
        <span aria-hidden="true">×</span>
      </button>,
    );

    const results = await check(container);

    expect(results.violations.map((violation) => violation.id)).toContain(
      'button-name',
    );
  });
});
