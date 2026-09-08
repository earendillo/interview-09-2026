// Module Federation remotes are resolved at runtime, so TypeScript needs the
// shapes declared here. Kept hand-written rather than generated to avoid
// wiring the plugin's dts tooling into the build for two trivial components.
declare module 'web/WebWidget' {
  import type { ComponentType } from 'react';
  const WebWidget: ComponentType;
  export default WebWidget;
}

declare module 'dashboard/DashboardWidget' {
  import type { ComponentType } from 'react';
  const DashboardWidget: ComponentType;
  export default DashboardWidget;
}
