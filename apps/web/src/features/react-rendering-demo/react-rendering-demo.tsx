import { EffectDemo } from './effect-demo';
import { OptimizedParent } from './optimized-parent';
import { UnoptimizedParent } from './unoptimized-parent';
import styles from './react-rendering-demo.module.scss';

/**
 * Entry point of the rendering demonstration.
 *
 * Two columns render the *same* child component with the *same* data. The
 * only difference is how the parent produces the props, which is exactly the
 * point: rerendering is decided by prop identity, not by prop contents.
 */
export function ReactRenderingDemo() {
  return (
    <section className={styles.demo}>
      <div>
        <h2>React rendering demonstration</h2>
        <p className={styles.intro}>
          Click <b>Increment</b> in both columns the same number of times and
          compare the child render counters.
        </p>
      </div>

      <div className={styles.columns}>
        <UnoptimizedParent />
        <OptimizedParent />
      </div>

      <Explanation />
      <EffectDemo />
    </section>
  );
}

/** The talking points, kept next to the thing they explain. */
function Explanation() {
  return (
    <section className="ui-card">
      <h3 className="ui-card__title">Why the left child rerenders</h3>

      <div className={styles.notes}>
        <p className={styles.note}>
          <strong>What causes a rerender</strong>
          Calling <code>setState</code> with a new value rerenders the component
          that owns the state, and by default re-renders its whole subtree -
          React does not compare props before rendering a child.
        </p>
        <p className={styles.note}>
          <strong>How React compares props</strong>
          Only <code>React.memo</code> (or equivalent) opts a component into a
          comparison, and that comparison is <i>shallow</i>: each prop is
          checked with <code>Object.is</code>.
        </p>
        <p className={styles.note}>
          <strong>Why a fresh object or function differs</strong>
          <code>{'{ id: 1 } === { id: 1 }'}</code> is <code>false</code>. An
          object literal or arrow function written in the render body is a new
          allocation on every render, so <code>Object.is</code> reports a change
          even though nothing the user cares about changed.
        </p>
        <p className={styles.note}>
          <strong>Why React.memo alone is not enough</strong>
          The child in both columns is the same memoised component. The left one
          still rerenders, because its props really are new references. Memo can
          only skip work if the parent hands it stable values.
        </p>
        <p className={styles.note}>
          <strong>What useMemo and useCallback add</strong>
          They keep a reference alive across renders while their dependencies
          are unchanged. <code>useMemo</code> is used here for the expensive
          calculation (skips the work <i>and</i> stabilises the value);{' '}
          <code>useCallback</code> is used for the handler (the body is cheap -
          only the identity matters). The object prop needs neither: it never
          depends on props or state, so it is a module constant.
        </p>
      </div>

      <p className={styles.caveat}>
        Memoisation is not free: it costs a dependency array to keep correct and
        memory to keep the previous value. Applying it everywhere makes code
        harder to read and can be slower than the renders it avoids - reach for
        it when a render is measurably expensive or when a stable identity is
        required.
      </p>
    </section>
  );
}

export default ReactRenderingDemo;
