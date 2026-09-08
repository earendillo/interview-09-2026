import styles from './dashboard-widget.module.scss';

/**
 * Component exposed by the `dashboard` remote as `./DashboardWidget`.
 *
 * The shell loads this through Module Federation at runtime; it is never
 * imported via `@interview/dashboard` or a relative path. Its styles are a CSS
 * Module so they travel with the component and stay scoped inside the host.
 */
export function DashboardWidget() {
  return (
    <section className={styles.widget}>
      <div className={styles.title}>Dashboard remote widget</div>
      <div className={styles.origin}>served from http://localhost:4201</div>
    </section>
  );
}

export default DashboardWidget;
