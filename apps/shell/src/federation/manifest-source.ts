import { type RemoteEntry, parseManifest } from './manifest';

export const MANIFEST_URL = '/remotes.json';

export type ManifestSource = 'network' | 'defaults';

export interface LoadedManifest {
  entries: RemoteEntry[];
  source: ManifestSource;
  reason?: string;
}

export interface LoadManifestOptions {
  fetchImpl: typeof fetch;
  defaults: RemoteEntry[];
}

export async function loadManifest({
  fetchImpl,
  defaults,
}: LoadManifestOptions): Promise<LoadedManifest> {
  try {
    const response = await fetchImpl(MANIFEST_URL, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`GET ${MANIFEST_URL} responded ${response.status}`);
    }

    return { entries: parseManifest(await response.json()), source: 'network' };
  } catch (error: unknown) {
    return {
      entries: defaults,
      source: 'defaults',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
