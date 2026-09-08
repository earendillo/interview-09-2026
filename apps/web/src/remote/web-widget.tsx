/**
 * Component exposed by the `web` remote as `./WebWidget`.
 *
 * The shell loads this through Module Federation at runtime; it is never
 * imported via `@interview/web` or a relative path.
 */
export function WebWidget() {
  return (
    <section style={{ border: '1px solid #4a90d9', padding: '0.5rem' }}>
      Web remote widget (served from http://localhost:4200)
    </section>
  );
}

export default WebWidget;
