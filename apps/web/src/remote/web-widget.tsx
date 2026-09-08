import styles from './web-widget.module.scss';

/**
 * Component exposed by the `web` remote as `./WebWidget`.
 *
 * The shell loads this through Module Federation at runtime; it is never
 * imported via `@interview/web` or a relative path. Its styles are a CSS
 * Module so they travel with the component and stay scoped inside the host.
 */
export function WebWidget() {
  return (
    <section className={styles.widget}>
      <div className={styles.title}>Web remote widget</div>
      <div className={styles.origin}>served from http://localhost:4200</div>
    </section>
  );
}

export default WebWidget;
