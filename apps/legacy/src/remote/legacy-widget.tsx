import { useState, version } from 'react';
import styles from './legacy-widget.module.scss';

export interface LegacyWidgetProps {
  title?: string;
}

export function LegacyWidget({
  title = 'Legacy remote widget',
}: LegacyWidgetProps) {
  const [clicks, setClicks] = useState(0);

  return (
    <section className={styles.widget}>
      <div className={styles.title}>{title}</div>
      <div className={styles.origin} data-testid="legacy-react-version">
        served from http://localhost:4203 · React {version}
      </div>
      <button
        type="button"
        className={styles.button}
        data-testid="legacy-clicks"
        onClick={() => setClicks((value) => value + 1)}
      >
        clicked {clicks} times
      </button>
    </section>
  );
}

export default LegacyWidget;
