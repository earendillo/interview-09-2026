import type { Item } from '@interview/shared';
import { getAuthStatus } from '@interview/auth';
import { Button } from '@interview/ui';

const items: Item[] = [
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' },
];

export function App() {
  return (
    <div>
      <h1>Web Application</h1>
      <p>Auth status: {getAuthStatus()}</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
      <Button label="Click me" />
    </div>
  );
}

export default App;
