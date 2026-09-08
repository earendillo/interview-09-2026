import styles from './item-filter-demo.module.scss';

export interface StatProps {
  label: string;
  value: string | number;
  testId: string;
}

/** One labelled counter. Both panels show the same six, so it is factored out. */
export function Stat({ label, value, testId }: StatProps) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue} data-testid={testId}>
        {value}
      </span>
    </div>
  );
}
