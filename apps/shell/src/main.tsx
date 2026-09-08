import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { loadRemote, registerRemotes } from '@module-federation/runtime';
import App from './app/app';
import { DEFAULT_REMOTES } from './federation/defaults';
import { loadManifest } from './federation/manifest-source';
import { createRemoteRegistry } from './federation/remote-registry';
import { recordRollback } from './federation/rollback-store';

import '@interview/ui/styles/base.scss';

const manifest = await loadManifest({
  fetchImpl: (...args) => fetch(...args),
  defaults: DEFAULT_REMOTES,
});

const registry = createRemoteRegistry({
  entries: manifest.entries,
  registerRemotes: (remotes, options) => registerRemotes(remotes, options),
  loadRemote: (id) => loadRemote(id),
  onRollback: recordRollback,
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

root.render(
  <StrictMode>
    <App registry={registry} manifest={manifest} />
  </StrictMode>,
);
