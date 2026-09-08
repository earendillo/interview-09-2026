export const SUPPORTED_CONTRACT = 1;

export interface RemoteEntry {
  name: string;
  url: string;
  fallbackUrl?: string;
  shareScope: string;
  contract: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseManifest(raw: unknown): RemoteEntry[] {
  if (!isRecord(raw)) {
    throw new Error(
      'Remote manifest must be a JSON object of remote name -> entry',
    );
  }

  return Object.entries(raw).map(([name, entry]) => {
    if (!isRecord(entry)) {
      throw new Error(`Remote manifest entry "${name}" must be an object`);
    }

    if (typeof entry['url'] !== 'string' || entry['url'] === '') {
      throw new Error(`Remote manifest entry "${name}" is missing a url`);
    }

    if (entry['contract'] !== SUPPORTED_CONTRACT) {
      throw new Error(
        `Remote "${name}" declares contract ${String(entry['contract'])}, ` +
          `but this host implements contract ${SUPPORTED_CONTRACT}`,
      );
    }

    const fallbackUrl = entry['fallbackUrl'];
    const shareScope = entry['shareScope'];

    return {
      name,
      url: entry['url'],
      ...(typeof fallbackUrl === 'string' ? { fallbackUrl } : {}),
      shareScope: typeof shareScope === 'string' ? shareScope : 'default',
      contract: SUPPORTED_CONTRACT,
    };
  });
}

export function fallbackOf(entry: RemoteEntry): RemoteEntry | null {
  if (!entry.fallbackUrl) return null;

  return { ...entry, url: entry.fallbackUrl, fallbackUrl: undefined };
}
