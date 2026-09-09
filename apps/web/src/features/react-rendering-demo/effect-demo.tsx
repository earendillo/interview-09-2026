import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@interview/ui';
import styles from './react-rendering-demo.module.scss';

/**
 * A separate, deliberately tiny component so the effect timeline is not mixed
 * up with the rerender counters above it.
 *
 * Three effects with three different dependency arrays run side by side:
 *
 *   []          -> after the first render only
 *   [count]     -> after the first render, then whenever `count` changes
 *   [config]    -> after *every* render, because `config` is a new object
 *   [config.id] -> after the first render only, because the id is a primitive
 */
export function EffectDemo() {
  const [count, setCount] = useState(0);
  const [unrelated, setUnrelated] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  // A brand new object on every render - the classic broken dependency.
  //
  // The disable belongs here rather than on the `useEffect` below:
  // `exhaustive-deps` reports an unstable dependency at the line that *creates*
  // it, not at the hook that consumes it. Its advice ("wrap the initialization
  // in useMemo") is the correct fix everywhere except here, where the bug is
  // the exhibit.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the point of the demo
  const config = { id: 1, label: 'demo' };

  const objectDepRuns = useRef(0);
  const primitiveDepRuns = useRef(0);

  const append = useCallback(
    (line: string) => setLog((lines) => [...lines, line]),
    [],
  );

  // Empty array: runs once after the first render (mount). The cleanup runs
  // on unmount - press "Reset demo" above and watch the console.
  useEffect(() => {
    append('[] effect ran (after the first render)');
    return () => console.log('[react-rendering-demo] [] effect cleanup');
  }, [append]);

  // Runs after the first render and after every render in which `count`
  // changed. Clicking "Unrelated state" rerenders the component but leaves
  // this effect alone.
  useEffect(() => {
    append(`[count] effect ran, count = ${count}`);
  }, [count, append]);

  // Object dependency: `config` is a different reference on every render, so
  // Object.is says "changed" and the effect runs every time.
  useEffect(() => {
    objectDepRuns.current += 1;
  }, [config]);

  // The same information as a primitive: compares by value, so it runs once.
  useEffect(() => {
    primitiveDepRuns.current += 1;
  }, [config.id]);

  return (
    <section className="ui-card">
      <h3 className="ui-card__title">useEffect and its dependency array</h3>

      <div className={styles.effectGrid}>
        <div className={styles.panel}>
          <div className={styles.buttons}>
            <Button
              label="count + 1 (effect dependency)"
              testId="effect-increment"
              onClick={() => setCount((value) => value + 1)}
            />
            <Button
              label="Unrelated state + 1 (rerender only)"
              variant="secondary"
              testId="effect-unrelated-button"
              onClick={() => setUnrelated((value) => value + 1)}
            />
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>count</span>
              <span className={styles.statValue} data-testid="effect-count">
                {count}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>unrelated</span>
              <span className={styles.statValue} data-testid="effect-unrelated">
                {unrelated}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>[config] runs</span>
              <span
                className={styles.statValue}
                data-testid="effect-object-dep"
              >
                {objectDepRuns.current}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>[config.id] runs</span>
              <span
                className={styles.statValue}
                data-testid="effect-primitive-dep"
              >
                {primitiveDepRuns.current}
              </span>
            </div>
          </div>

          <p className={styles.intro}>
            Effects run after the render is committed, so these two counters are
            read one render behind. The object one keeps climbing; the primitive
            one stays at 1.
          </p>
        </div>

        <div className={styles.log} data-testid="effect-log">
          {log.map((line, index) => (
            <div key={`${index}-${line}`} className={styles.logLine}>
              {line}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
