import { useRef, useState } from 'react';
import { Button } from '@interview/ui';
import { MemoChildPanel } from './child-panel';
import { expensiveSum, WORK_SIZE } from './expensive-sum';
import { useRenderCount } from './use-render-count';
import styles from './react-rendering-demo.module.scss';

/**
 * The "before" column.
 *
 * The child is already wrapped in `React.memo`, and it still rerenders on
 * every click - because the props it receives are new values each time.
 */
export function UnoptimizedParent() {
  const [count, setCount] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const renders = useRenderCount();
  const calculations = useRef(0);

  // A new object literal on every render: same contents, new reference.
  const user = { id: 1, name: 'Ada' };

  // A new function instance on every render: same body, new reference.
  const handleSelect = () => setSelectedId(1);

  // Recomputed on every render, even though `count` has nothing to do with it.
  calculations.current += 1;
  const total = expensiveSum(WORK_SIZE);

  return (
    <section className={`${styles.column} ${styles.before}`}>
      <div className={styles.columnHeader}>
        <h3>Before optimization</h3>
        <span className={styles.tag}>new props each render</span>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Parent renders</span>
          <span
            className={styles.statValue}
            data-testid="before-parent-renders"
          >
            {renders}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>State value</span>
          <span className={styles.statValue} data-testid="before-count">
            {count}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Calculations</span>
          <span className={styles.statValue} data-testid="before-calculations">
            {calculations.current}
          </span>
        </div>
      </div>

      <div className={styles.buttons}>
        <Button
          label="Increment"
          testId="before-increment"
          onClick={() => setCount((value) => value + 1)}
        />
      </div>

      <MemoChildPanel
        testId="before"
        user={user}
        total={total}
        isSelected={selectedId === user.id}
        onSelect={handleSelect}
      />
    </section>
  );
}
