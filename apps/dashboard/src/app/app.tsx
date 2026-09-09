import { Button } from '@interview/ui';
import { SessionConsumer } from '../features/session-consumer/session-consumer';
import styles from './app.module.scss';

/** Static placeholder figures - this app exists to be a second remote. */
const metrics = [
  { label: 'Remotes online', value: '2' },
  { label: 'Share scope', value: 'default' },
  { label: 'Port', value: '4201' },
];

export function App() {
  return (
    <div className="ui-page">
      <header className="ui-header">
        <h1 className="ui-header__title">Dashboard Application</h1>
        <span className="ui-badge">remote · :4201</span>
        <p className="ui-header__subtitle">
          Module Federation remote. Exposes <code>./DashboardWidget</code> to
          the shell and still runs on its own.
        </p>
      </header>

      <section className="ui-card">
        <h2 className="ui-card__title">Overview</h2>
        <div className={styles.metrics}>
          {metrics.map((metric) => (
            <div key={metric.label} className={styles.metric}>
              <div className={styles.metricLabel}>{metric.label}</div>
              <div className={styles.metricValue}>{metric.value}</div>
            </div>
          ))}
        </div>
        <Button label="Dashboard Action" />
      </section>

      <SessionConsumer />
    </div>
  );
}

export default App;
