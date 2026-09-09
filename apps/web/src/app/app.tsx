import type { Item } from '@interview/shared';
import { Button } from '@interview/ui';
import { AuthDemo } from '../features/auth-demo/auth-demo';
import { ItemFilterDemo } from '../features/item-filter-demo/item-filter-demo';
import { ReactRenderingDemo } from '../features/react-rendering-demo/react-rendering-demo';
import styles from './app.module.scss';

const items: Item[] = [
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' },
];

export function App() {
  return (
    <div className="ui-page">
      <header className="ui-header">
        <h1 className="ui-header__title">Web Application</h1>
        <span className="ui-badge">remote · :4200</span>
        <p className="ui-header__subtitle">
          Module Federation remote, and the home of the React rendering
          demonstration below.
        </p>
      </header>

      <section className="ui-card">
        <h2 className="ui-card__title">Workspace wiring</h2>
        <p className={styles.status}>
          The <code>Item</code> type comes from <code>@interview/shared</code>{' '}
          and the button from <code>@interview/ui</code> — both across a package
          boundary, neither by a relative path.
        </p>
        <ul className={styles.itemList} data-testid="item-list">
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              {item.name}
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <Button label="Click me" />
        </div>
      </section>

      <AuthDemo />
      <ReactRenderingDemo />
      <ItemFilterDemo />
    </div>
  );
}

export default App;
