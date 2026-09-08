import { Button } from '@interview/ui';
import { getAuthStatus } from '@interview/auth';

export function App() {
  return (
    <div>
      <h1>Dashboard Application</h1>
      <p>Auth status: {getAuthStatus()}</p>
      <Button label="Dashboard Action" />
    </div>
  );
}

export default App;
