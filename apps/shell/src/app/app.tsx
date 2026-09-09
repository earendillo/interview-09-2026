import { useCallback, useSyncExternalStore, type ComponentType } from 'react';
import { Button } from '@interview/ui';
import type { LoadedManifest } from '../federation/manifest-source';
import type { RemoteRegistry } from '../federation/remote-registry';
import { getRollbacks, subscribeRollbacks } from '../federation/rollback-store';
import { ForeignRemote, type ForeignRemoteModule } from './foreign-remote';
import { RemoteSlot } from './remote-slot';
import styles from './app.module.scss';

export interface AppProps {
  registry: RemoteRegistry;
  manifest: LoadedManifest;
}

type RemoteModule = { default: ComponentType };

export function App({ registry, manifest }: AppProps) {
  // `useCallback`, not `useMemo`: what has to stay stable here is the loader's
  // *identity*. `RemoteSlot` feeds it to `lazy()` through a `useMemo` keyed on
  // it, and `ForeignRemote` has it in a `useEffect` dependency array - a fresh
  // function on every render would re-import the remote each time.
  const loadWeb = useCallback(
    () => registry.load<RemoteModule>('web', 'WebWidget'),
    [registry],
  );

  const loadDashboard = useCallback(
    () => registry.load<RemoteModule>('dashboard', 'DashboardWidget'),
    [registry],
  );

  const loadLegacy = useCallback(
    () => registry.load<ForeignRemoteModule>('legacy', 'LegacyWidget'),
    [registry],
  );

  const rollbacks = useSyncExternalStore(subscribeRollbacks, getRollbacks);

  const urlOf = (name: string) =>
    rollbacks.find((event) => event.name === name)?.to ??
    manifest.entries.find((entry) => entry.name === name)?.url ??
    'not in manifest';

  const rolledBack = (name: string) =>
    rollbacks.some((event) => event.name === name);

  return (
    <div className="ui-page">
      <header className="ui-header">
        <h1 className="ui-header__title">Shell Application</h1>
        <span className="ui-badge">host · :4202</span>
        <p className="ui-header__subtitle">
          Module Federation host. Each card below is a component loaded at
          runtime from a separate application, at the URL its manifest entry
          points to.
        </p>
      </header>

      {manifest.source === 'defaults' && (
        <p
          className={styles.degraded}
          role="alert"
          data-testid="manifest-degraded"
        >
          Remote manifest unavailable ({manifest.reason}) — running on built-in
          defaults.
        </p>
      )}

      <div className={styles.remotes}>
        <section className={`ui-card ${styles.remote}`}>
          <div className={styles.remoteHeader}>
            <h2>Web remote</h2>
            <span className={styles.origin} data-testid="web-origin">
              {urlOf('web')}
              {rolledBack('web') && (
                <b className={styles.rolledBack}> rolled back</b>
              )}
            </span>
          </div>
          <RemoteSlot label="Web remote" loader={loadWeb} />
        </section>

        <section className={`ui-card ${styles.remote}`}>
          <div className={styles.remoteHeader}>
            <h2>Dashboard remote</h2>
            <span className={styles.origin} data-testid="dashboard-origin">
              {urlOf('dashboard')}
              {rolledBack('dashboard') && (
                <b className={styles.rolledBack}> rolled back</b>
              )}
            </span>
          </div>
          <RemoteSlot label="Dashboard remote" loader={loadDashboard} />
        </section>

        <section className={`ui-card ${styles.remote}`}>
          <div className={styles.remoteHeader}>
            <h2>Legacy remote</h2>
            <span className={styles.origin} data-testid="legacy-origin">
              {urlOf('legacy')}
              {rolledBack('legacy') && (
                <b className={styles.rolledBack}> rolled back</b>
              )}
            </span>
          </div>
          <ForeignRemote label="Legacy remote" loader={loadLegacy} />
        </section>
      </div>

      <div className={styles.actions}>
        <Button label="Shell Action" />
      </div>
    </div>
  );
}

export default App;
