import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@interview/ui';
import { expensiveScore } from './expensive-score';
import { filterItems } from './filter-items';
import { MemoItemList } from './item-list';
import { Stat } from './stat';
import type { PanelProps } from './unoptimized-panel';
import { useRenderCount } from '../react-rendering-demo/use-render-count';
import styles from './item-filter-demo.module.scss';

/**
 * The "after" panel. Same UI, same memoised child, three targeted changes:
 *
 * 1. `visibleItems` is memoised on `[items, filter]` - the only two things it
 *    depends on. Cheap on its own, but it also has to stay referentially
 *    stable, otherwise the score below and the memoised child both see a new
 *    array on every render.
 * 2. the expensive score is memoised on `[visibleItems]`.
 * 3. `handleSelect` is wrapped in `useCallback`, so the memoised list keeps
 *    seeing the same function reference.
 *
 * Note what is *not* memoised: `items.length`, the filter string, the panel's
 * JSX. Memoising those would cost a dependency array and buy nothing.
 */
export function OptimizedPanel({ items }: PanelProps) {
  const [filter, setFilter] = useState('');
  const [unrelated, setUnrelated] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const renders = useRenderCount();
  const filterRuns = useRef(0);
  const scoreRuns = useRef(0);
  const lastScoreMs = useRef(0);

  const visibleItems = useMemo(() => {
    filterRuns.current += 1;
    return filterItems(items, filter);
  }, [items, filter]);

  const score = useMemo(() => {
    scoreRuns.current += 1;
    const startedAt = performance.now();
    const result = expensiveScore(visibleItems);
    lastScoreMs.current = performance.now() - startedAt;
    return result;
  }, [visibleItems]);

  // The body is cheap - `useCallback` is here for the *identity*, so the
  // memoised list's shallow prop comparison keeps passing. `setSelectedId` is
  // a stable setter, so the dependency array is genuinely empty.
  const handleSelect = useCallback((id: number) => setSelectedId(id), []);

  return (
    <section className={`${styles.panel} ${styles.after}`}>
      <div className={styles.panelHeader}>
        <h3>After optimization</h3>
        <span className={styles.tag}>derived when inputs change</span>
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Filter</span>
        <input
          className={styles.input}
          value={filter}
          placeholder="e.g. 12"
          data-testid="after-filter"
          onChange={(event) => setFilter(event.target.value)}
        />
      </label>

      <div className={styles.stats}>
        <Stat label="Items" value={items.length} testId="after-total" />
        <Stat
          label="Visible items"
          value={visibleItems.length}
          testId="after-visible"
        />
        <Stat label="Panel renders" value={renders} testId="after-renders" />
        <Stat
          label="Filter runs"
          value={filterRuns.current}
          testId="after-filter-runs"
        />
        <Stat
          label="Score runs"
          value={scoreRuns.current}
          testId="after-score-runs"
        />
        <Stat
          label="Last score (ms)"
          value={lastScoreMs.current.toFixed(1)}
          testId="after-score-ms"
        />
      </div>

      <p className={styles.result}>
        Expensive calculation: <b data-testid="after-score">{score}</b> ·
        unrelated state: <b data-testid="after-unrelated">{unrelated}</b>
      </p>

      <div className={styles.buttons}>
        <Button
          label="Unrelated state + 1"
          variant="secondary"
          testId="after-unrelated-button"
          onClick={() => setUnrelated((value) => value + 1)}
        />
      </div>

      <MemoItemList
        testId="after"
        items={visibleItems}
        selectedId={selectedId}
        onSelect={handleSelect}
      />
    </section>
  );
}
