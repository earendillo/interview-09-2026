/**
 * Component exposed by the `dashboard` remote as `./DashboardWidget`.
 *
 * The shell loads this through Module Federation at runtime; it is never
 * imported via `@interview/dashboard` or a relative path.
 */
export function DashboardWidget() {
  return (
    <section style={{ border: '1px solid #7ab648', padding: '0.5rem' }}>
      Dashboard remote widget (served from http://localhost:4201)
    </section>
  );
}

export default DashboardWidget;
