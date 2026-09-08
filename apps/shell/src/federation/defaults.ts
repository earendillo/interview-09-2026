import { SUPPORTED_CONTRACT, type RemoteEntry } from './manifest';

export const DEFAULT_REMOTES: RemoteEntry[] = [
  {
    name: 'web',
    url: 'http://localhost:4200/remoteEntry.js',
    shareScope: 'default',
    contract: SUPPORTED_CONTRACT,
  },
  {
    name: 'dashboard',
    url: 'http://localhost:4201/remoteEntry.js',
    shareScope: 'default',
    contract: SUPPORTED_CONTRACT,
  },
  {
    name: 'legacy',
    url: 'http://localhost:4203/remoteEntry.js',
    shareScope: 'legacy',
    contract: SUPPORTED_CONTRACT,
  },
];
