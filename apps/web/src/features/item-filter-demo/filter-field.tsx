import { useId, useRef } from 'react';
import styles from './item-filter-demo.module.scss';

export interface FilterFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** How many items the current filter matches. */
  matchCount: number;
  /** How many items there are in total. */
  totalCount: number;
  /** Prefix for the test ids, so both panels can be queried separately. */
  testId: string;
}

/**
 * The filter input, its clear button and the live region that announces the
 * result. Shared by both panels so the two columns stay pixel-identical and
 * the only difference between them remains the memoisation.
 *
 * This is also the accessibility example of the phase - see
 * docs/testing-and-accessibility.md. Three things here are deliberate:
 *
 * 1. `aria-label` on the clear button. Its visible content is a decorative
 *    "×" glyph marked `aria-hidden`, so without the label the button has no
 *    accessible name at all and a screen reader announces only "button".
 * 2. `inputRef.current?.focus()` in the clear handler. Clearing the filter
 *    unmounts the button that was just activated; without moving focus
 *    deliberately it falls back to `<body>` and a keyboard user has to tab
 *    from the top of the page again.
 * 3. `role="status"`. Filtering rewrites the list with no navigation and no
 *    focus change, so a screen-reader user gets no feedback at all unless the
 *    count is in a polite live region.
 */
export function FilterField({
  value,
  onChange,
  matchCount,
  totalCount,
  testId,
}: FilterFieldProps) {
  // `useId` rather than a hand-written id: both panels render this component,
  // and two identical `id` attributes would point both labels at one input.
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={inputId}>
        Filter
      </label>

      <div className={styles.fieldRow}>
        <input
          id={inputId}
          ref={inputRef}
          className={styles.input}
          value={value}
          placeholder="e.g. 12"
          data-testid={`${testId}-filter`}
          onChange={(event) => onChange(event.target.value)}
        />

        {value !== '' && (
          <button
            type="button"
            className={styles.clear}
            aria-label="Clear filter"
            data-testid={`${testId}-clear`}
            onClick={handleClear}
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>

      <p className={styles.live} role="status" data-testid={`${testId}-live`}>
        {value === ''
          ? `Showing all ${totalCount} items`
          : `${matchCount} of ${totalCount} items match “${value}”`}
      </p>
    </div>
  );
}
