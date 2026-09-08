import { getRequestCount } from './item-api';
import { OptimizedPanel } from './optimized-panel';
import { UnoptimizedPanel } from './unoptimized-panel';
import { useItems } from './use-items';
import styles from './item-filter-demo.module.scss';

/**
 * Entry point of the performance/caching demonstration.
 *
 * The API result is fetched *once*, here, and handed to both panels as a
 * prop - so the two columns work from the same data and neither of them can
 * trigger a request of its own. Filtering happens further down, on derived
 * data:
 *
 *   API -> items (state) -> filter -> visibleItems -> render
 */
export function ItemFilterDemo() {
  const { items, status, error } = useItems();

  return (
    <section className={styles.demo}>
      <div>
        <h2>Filtering and derived-data performance</h2>
        <p className={styles.intro}>
          Both panels receive the same fetched array. Type in one filter box and
          click <b>Unrelated state + 1</b> in each, then compare the “score
          runs” counters.
        </p>
      </div>

      <div className={styles.source}>
        <span>
          API: <code>GET /api/items</code>
        </span>
        <span>
          status: <b data-testid="items-status">{status}</b>
        </span>
        <span>
          items loaded: <b data-testid="items-count">{items.length}</b>
        </span>
        <span>
          HTTP requests: <b data-testid="request-count">{getRequestCount()}</b>
        </span>
      </div>

      {status === 'loading' && <p className={styles.intro}>Loading items…</p>}

      {status === 'error' && (
        <p className={styles.error} data-testid="items-error">
          {error} — start the API with <code>pnpm nx serve @interview/api</code>
          .
        </p>
      )}

      {status === 'ready' && (
        <div className={styles.panels}>
          <UnoptimizedPanel items={items} />
          <OptimizedPanel items={items} />
        </div>
      )}

      <Explanation />
    </section>
  );
}

/** The talking points, kept next to the thing they explain. */
function Explanation() {
  return (
    <section className="ui-card">
      <h3 className="ui-card__title">What the counters show</h3>

      <div className={styles.notes}>
        <p className={styles.note}>
          <strong>The bottleneck</strong>
          The left panel derives <code>visibleItems</code> and the expensive
          score in its render body, so every rerender redoes both — including
          rerenders caused by <code>unrelated</code>, which the calculation does
          not depend on. “Last score (ms)” is the real cost of one pass,
          measured with <code>performance.now()</code>.
        </p>
        <p className={styles.note}>
          <strong>Why useMemo here</strong>
          <code>visibleItems</code> and the score are <i>derived data</i>: pure
          functions of <code>items</code> and <code>filter</code>. That is the
          case <code>useMemo</code> is for. The score is expensive enough to be
          worth it on its own; the filter is memoised mainly so the array stays
          referentially stable for the score and for the memoised list.
        </p>
        <p className={styles.note}>
          <strong>Why useCallback here</strong>
          <code>useCallback</code> memoises the <i>function reference</i>, not
          the result of calling it. <code>handleSelect</code> is cheap to
          create; wrapping it only matters because <code>MemoItemList</code>{' '}
          compares props with <code>Object.is</code>, and a fresh arrow function
          fails that comparison every time.
        </p>
        <p className={styles.note}>
          <strong>The API result is never replaced</strong>
          <code>items</code> is written once by the fetch and read by both
          panels. Filtering calls <code>Array.prototype.filter</code>, which
          returns a new array — clearing the input derives the full list again,
          and the “HTTP requests” counter above never moves.
        </p>
        <p className={styles.note}>
          <strong>Why not memoise everything</strong>
          Every memoised value costs a dependency array that has to stay correct
          and memory to hold the previous value. The item count, the filter
          string and the JSX in these panels are all cheaper to recompute than
          to cache.
        </p>
      </div>
    </section>
  );
}

export default ItemFilterDemo;
