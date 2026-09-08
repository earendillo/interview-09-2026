import { useRef, useState } from 'react';
import type { Item } from '@interview/shared';
import { Button } from '@interview/ui';
import { expensiveScore } from './expensive-score';
import { FilterField } from './filter-field';
import { filterItems } from './filter-items';
import { MemoItemList } from './item-list';
import { Stat } from './stat';
import { useRenderCount } from '../react-rendering-demo/use-render-count';
import styles from './item-filter-demo.module.scss';

export interface PanelProps {
  /** The API result, owned by the parent. Never mutated here. */
  items: readonly Item[];
}

/**
 * The "before" panel.
 *
 * Everything derived is recomputed in the render body, so *any* rerender -
 * including one caused by state the calculation does not depend on - redoes
 * the filter and the expensive score. The child list is already memoised and
 * still rerenders, because `handleSelect` is a new function every render.
 */
export function UnoptimizedPanel({ items }: PanelProps) {
  const [filter, setFilter] = useState('');
  const [unrelated, setUnrelated] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const renders = useRenderCount();
  const filterRuns = useRef(0);
  const scoreRuns = useRef(0);
  const lastScoreMs = useRef(0);

  // Derived on every render, dependencies or not.
  filterRuns.current += 1;
  const visibleItems = filterItems(items, filter);

  scoreRuns.current += 1;
  const startedAt = performance.now();
  const score = expensiveScore(visibleItems);
  lastScoreMs.current = performance.now() - startedAt;

  // A new function instance every render: the memoised child cannot skip it.
  const handleSelect = (id: number) => setSelectedId(id);

  return (
    <section className={`${styles.panel} ${styles.before}`}>
      <div className={styles.panelHeader}>
        <h3>Before optimization</h3>
        <span className={styles.tag}>derived every render</span>
      </div>

      <FilterField
        testId="before"
        value={filter}
        onChange={setFilter}
        matchCount={visibleItems.length}
        totalCount={items.length}
      />

      <div className={styles.stats}>
        <Stat label="Items" value={items.length} testId="before-total" />
        <Stat
          label="Visible items"
          value={visibleItems.length}
          testId="before-visible"
        />
        <Stat label="Panel renders" value={renders} testId="before-renders" />
        <Stat
          label="Filter runs"
          value={filterRuns.current}
          testId="before-filter-runs"
        />
        <Stat
          label="Score runs"
          value={scoreRuns.current}
          testId="before-score-runs"
        />
        <Stat
          label="Last score (ms)"
          value={lastScoreMs.current.toFixed(1)}
          testId="before-score-ms"
        />
      </div>

      <p className={styles.result}>
        Expensive calculation: <b data-testid="before-score">{score}</b> ·
        unrelated state: <b data-testid="before-unrelated">{unrelated}</b>
      </p>

      <div className={styles.buttons}>
        <Button
          label="Unrelated state + 1"
          variant="secondary"
          testId="before-unrelated-button"
          onClick={() => setUnrelated((value) => value + 1)}
        />
      </div>

      <MemoItemList
        testId="before"
        items={visibleItems}
        selectedId={selectedId}
        onSelect={handleSelect}
      />
    </section>
  );
}
