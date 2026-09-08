import { memo, type Ref } from 'react';
import { Button } from '@interview/ui';
import { useRenderCount } from './use-render-count';
import styles from './react-rendering-demo.module.scss';

export interface DemoUser {
  id: number;
  name: string;
}

export interface ChildPanelProps {
  user: DemoUser;
  total: number;
  isSelected: boolean;
  onSelect: () => void;
  /**
   * React 19: `ref` is an ordinary prop for function components, so this
   * child needs no `forwardRef` wrapper. `memo` still passes it through, and
   * because a `useRef` object is referentially stable it does not defeat the
   * shallow prop comparison.
   */
  ref?: Ref<HTMLButtonElement>;
  /** Prefix for the test ids, so both columns can be queried separately. */
  testId: string;
}

/**
 * The child under observation. It has no state of its own: every render it
 * performs was requested by its parent.
 */
export function ChildPanel({
  user,
  total,
  isSelected,
  onSelect,
  ref,
  testId,
}: ChildPanelProps) {
  const renders = useRenderCount();

  return (
    <div className={styles.child}>
      <div className={styles.childTitle}>
        <span>Child component</span>
        <span>
          renders: <b data-testid={`${testId}-child-renders`}>{renders}</b>
        </span>
      </div>

      <div className={styles.props}>
        <span>
          user.name: <b>{user.name}</b>
        </span>
        <span>
          total: <b data-testid={`${testId}-total`}>{total}</b>
        </span>
        <span>
          selected:{' '}
          <b data-testid={`${testId}-selected`}>{isSelected ? 'yes' : 'no'}</b>
        </span>
      </div>

      <Button
        label="Select user (real prop change)"
        variant="secondary"
        testId={`${testId}-select`}
        onClick={onSelect}
        ref={ref}
      />
    </div>
  );
}

/**
 * `React.memo` skips a rerender when every prop is `Object.is`-equal to the
 * previous one. That is a *necessary* part of the fix, but on its own it is
 * not sufficient: see `UnoptimizedParent`, which hands this very component a
 * fresh object and a fresh function on every render.
 */
export const MemoChildPanel = memo(ChildPanel);
