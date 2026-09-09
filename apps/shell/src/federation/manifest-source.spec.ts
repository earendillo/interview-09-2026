import { describe, expect, it, vi } from 'vitest';
import { MANIFEST_URL, loadManifest } from './manifest-source';
import { SUPPORTED_CONTRACT } from './manifest';

const body = {
  web: { url: 'https://cdn.example/web/v2.js', contract: SUPPORTED_CONTRACT },
};

const defaults = [
  {
    name: 'web',
    url: '/built-in.js',
    shareScope: 'default',
    contract: SUPPORTED_CONTRACT,
  },
];

const okResponse = (json: unknown) => ({
  ok: true,
  status: 200,
  json: async () => json,
});

describe('loadManifest', () => {
  it('uses the fetched manifest when the network succeeds', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(body));

    const result = await loadManifest({ fetchImpl, defaults });

    expect(result.source).toBe('network');
    expect(result.entries[0].url).toBe('https://cdn.example/web/v2.js');
  });

  it('never serves the manifest from cache, or a rollback would not take effect', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(body));

    await loadManifest({ fetchImpl, defaults });

    expect(fetchImpl).toHaveBeenCalledWith(MANIFEST_URL, { cache: 'no-store' });
  });

  it('falls back to the built-in defaults when the manifest is unreachable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));

    const result = await loadManifest({ fetchImpl, defaults });

    expect(result.source).toBe('defaults');
    expect(result.entries).toEqual(defaults);
    expect(result.reason).toMatch(/offline/);
  });

  it('falls back when the manifest responds with an error status', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });

    const result = await loadManifest({ fetchImpl, defaults });

    expect(result.source).toBe('defaults');
    expect(result.reason).toMatch(/404/);
  });

  it('degrades instead of bricking the host when the manifest is malformed', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(okResponse({ web: { contract: 1 } }));

    const result = await loadManifest({ fetchImpl, defaults });

    expect(result.source).toBe('defaults');
    expect(result.reason).toMatch(/missing a url/);
  });
});
