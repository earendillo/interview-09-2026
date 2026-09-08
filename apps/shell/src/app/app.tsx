import { Button } from '@interview/ui';
import { RemoteSlot } from './remote-slot';

export function App() {
  return (
    <div>
      <h1>Shell Application</h1>
      <p>Module Federation host. Each section below is a separate remote.</p>

      <h2>Web remote</h2>
      <RemoteSlot label="Web remote" loader={() => import('web/WebWidget')} />

      <h2>Dashboard remote</h2>
      <RemoteSlot
        label="Dashboard remote"
        loader={() => import('dashboard/DashboardWidget')}
      />

      <Button label="Shell Action" />
    </div>
  );
}

export default App;
