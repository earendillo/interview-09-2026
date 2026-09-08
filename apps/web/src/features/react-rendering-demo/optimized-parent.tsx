import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@interview/ui';
import { MemoChildPanel, type DemoUser } from './child-panel';
import { expensiveSum, WORK_SIZE } from './expensive-sum';
import { useRenderCount } from './use-render-count';
import styles from './react-rendering-demo.module.scss';

/**
 * A value that never depends on props or state does not belong inside the
 * component at all. Hoisting it is cheaper and clearer than `useMemo(..., [])`
 * - the first tool to reach for is not always a hook.
 */
const USER: DemoUser = { id: 1, name: 'Ada' };

/**
 * The "after" column. Same UI, same memoised child, three targeted changes:
 *
 * 1. the object prop is a module constant (stable by construction);
 * 2. the calculation is wrapped in `useMemo`, keyed on what it depends on;
 * 3. the callback is wrapped in `useCallback`, so its identity is stable.
 */
export function OptimizedParent() {
  const [count, setCount] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const renders = useRenderCount();
  const calculations = useRef(0);
  const selectButtonRef = useRef<HTMLButtonElement>(null);

  // `useMemo` for the value: it is expensive, pure, and depends only on
  // WORK_SIZE, so it must not be redone when `count` changes.
  const total = useMemo(() => {
    calculations.current += 1;
    return expensiveSum(WORK_SIZE);
  }, []);

  // `useCallback` for the identity: the function body is cheap, but a fresh
  // instance would break the child's `memo` comparison. `setSelectedId` is a
  // stable setter, so the dependency array is genuinely empty.
  const handleSelect = useCallback(() => setSelectedId(USER.id), []);

  return (
    <section className={`${styles.column} ${styles.after}`}>
      <div className={styles.columnHeader}>
        <h3>After optimization</h3>
        <span className={styles.tag}>stable props</span>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Parent renders</span>
          <span className={styles.statValue} data-testid="after-parent-renders">
            {renders}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>State value</span>
          <span className={styles.statValue} data-testid="after-count">
            {count}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Calculations</span>
          <span className={styles.statValue} data-testid="after-calculations">
            {calculations.current}
          </span>
        </div>
      </div>

      <div className={styles.buttons}>
        <Button
          label="Increment"
          testId="after-increment"
          onClick={() => setCount((value) => value + 1)}
        />
        <Button
          label="Focus child button (React 19 ref-as-prop)"
          variant="secondary"
          onClick={() => selectButtonRef.current?.focus()}
        />
      </div>

      <MemoChildPanel
        testId="after"
        user={USER}
        total={total}
        isSelected={selectedId === USER.id}
        onSelect={handleSelect}
        ref={selectButtonRef}
      />
    </section>
  );
}
