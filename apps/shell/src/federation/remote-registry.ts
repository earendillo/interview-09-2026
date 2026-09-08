import { type RemoteEntry, fallbackOf } from './manifest';

export type RegisterRemotes = (
  remotes: {
    name: string;
    entry: string;
    type: 'module';
    shareScope: string;
  }[],
  options: { force: boolean },
) => void;

export type LoadRemote = (id: string) => Promise<unknown>;

export interface RollbackEvent {
  name: string;
  from: string;
  to: string;
  reason: string;
}

export interface RemoteRegistryOptions {
  entries: RemoteEntry[];
  registerRemotes: RegisterRemotes;
  loadRemote: LoadRemote;
  onRollback?: (event: RollbackEvent) => void;
}

export interface RemoteRegistry {
  load<T>(name: string, moduleName: string): Promise<T>;
}

const toRegistration = (entry: RemoteEntry) => ({
  name: entry.name,
  entry: entry.url,
  type: 'module' as const,
  shareScope: entry.shareScope,
});

export function createRemoteRegistry({
  entries,
  registerRemotes,
  loadRemote,
  onRollback,
}: RemoteRegistryOptions): RemoteRegistry {
  const active = new Map(entries.map((entry) => [entry.name, entry]));

  registerRemotes(entries.map(toRegistration), { force: true });

  return {
    async load<T>(name: string, moduleName: string): Promise<T> {
      const entry = active.get(name);

      if (!entry) {
        throw new Error(`Remote "${name}" is not in the manifest`);
      }

      try {
        return (await loadRemote(`${name}/${moduleName}`)) as T;
      } catch (error: unknown) {
        const previous = fallbackOf(entry);
        if (!previous) throw error;

        active.set(name, previous);
        registerRemotes([toRegistration(previous)], { force: true });
        onRollback?.({
          name,
          from: entry.url,
          to: previous.url,
          reason: error instanceof Error ? error.message : String(error),
        });

        return (await loadRemote(`${name}/${moduleName}`)) as T;
      }
    },
  };
}
