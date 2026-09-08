import { Button } from '@interview/ui';
import { RemoteSlot } from './remote-slot';
import styles from './app.module.scss';

export function App() {
  return (
    <div className="ui-page">
      <header className="ui-header">
        <h1 className="ui-header__title">Shell Application</h1>
        <span className="ui-badge">host · :4202</span>
        <p className="ui-header__subtitle">
          Module Federation host. Each card below is a component loaded at
          runtime from a separate application.
        </p>
      </header>

      <div className={styles.remotes}>
        <section className={`ui-card ${styles.remote}`}>
          <div className={styles.remoteHeader}>
            <h2>Web remote</h2>
            <span className={styles.origin}>localhost:4200</span>
          </div>
          <RemoteSlot
            label="Web remote"
            loader={() => import('web/WebWidget')}
          />
        </section>

        <section className={`ui-card ${styles.remote}`}>
          <div className={styles.remoteHeader}>
            <h2>Dashboard remote</h2>
            <span className={styles.origin}>localhost:4201</span>
          </div>
          <RemoteSlot
            label="Dashboard remote"
            loader={() => import('dashboard/DashboardWidget')}
          />
        </section>
      </div>

      <div className={styles.actions}>
        <Button label="Shell Action" />
      </div>
    </div>
  );
}

export default App;
