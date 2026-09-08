import { memo } from 'react';
import type { Item } from '@interview/shared';
// Reused from the previous phase's demo rather than duplicated: it is the same
// three-line ref counter, and both features are in this app.
import { useRenderCount } from '../react-rendering-demo/use-render-count';
import styles from './item-filter-demo.module.scss';

/** How many rows are actually put in the DOM - the counters are the point here. */
export const VISIBLE_ROW_LIMIT = 25;

export interface ItemListProps {
  items: readonly Item[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Prefix for the test ids, so both panels can be queried separately. */
  testId: string;
}

/**
 * The child under observation. It is wrapped in `memo` below, so it rerenders
 * only when one of these props is a new reference - which is exactly what the
 * `onSelect` prop decides in the two panels.
 */
export function ItemList({
  items,
  selectedId,
  onSelect,
  testId,
}: ItemListProps) {
  const renders = useRenderCount();
  const rows = items.slice(0, VISIBLE_ROW_LIMIT);

  return (
    <div className={styles.list}>
      <div className={styles.listHeader}>
        <span>Item list</span>
        <span>
          renders: <b data-testid={`${testId}-list-renders`}>{renders}</b>
        </span>
      </div>

      <ul className={styles.rows} data-testid={`${testId}-rows`}>
        {rows.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={
                item.id === selectedId
                  ? `${styles.row} ${styles.rowSelected}`
                  : styles.row
              }
              onClick={() => onSelect(item.id)}
            >
              {item.name}
            </button>
          </li>
        ))}
        {items.length === 0 && <li className={styles.empty}>No matches</li>}
      </ul>

      {items.length > VISIBLE_ROW_LIMIT && (
        <p className={styles.more}>
          …and {items.length - VISIBLE_ROW_LIMIT} more (only the first{' '}
          {VISIBLE_ROW_LIMIT} rows are rendered)
        </p>
      )}
    </div>
  );
}

export const MemoItemList = memo(ItemList);
