import { version } from 'react';
import { LegacyWidget } from '../remote/legacy-widget';

export function App() {
  return (
    <div className="ui-page">
      <header className="ui-header">
        <h1 className="ui-header__title">Legacy Application</h1>
        <span className="ui-badge">remote · :4203 · React {version}</span>
        <p className="ui-header__subtitle">
          Runs standalone on its own React major, and is consumed by the shell
          through a DOM mount point rather than as a React element.
        </p>
      </header>

      <LegacyWidget />
    </div>
  );
}

export default App;
