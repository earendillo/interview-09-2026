import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './app/app';

// The one global stylesheet: design tokens, reset, shared layout primitives.
import '@interview/ui/styles/base.scss';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
