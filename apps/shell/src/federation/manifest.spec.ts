import { describe, expect, it } from 'vitest';
import { SUPPORTED_CONTRACT, fallbackOf, parseManifest } from './manifest';

const valid = {
  web: {
    url: 'https://cdn.example/web/v2.0.0/remoteEntry.js',
    fallbackUrl: 'https://cdn.example/web/v1.9.3/remoteEntry.js',
    contract: SUPPORTED_CONTRACT,
  },
};

describe('parseManifest', () => {
  it('returns one entry per remote, carrying its name', () => {
    const manifest = parseManifest(valid);

    expect(manifest).toHaveLength(1);
    expect(manifest[0].name).toBe('web');
    expect(manifest[0].url).toBe(
      'https://cdn.example/web/v2.0.0/remoteEntry.js',
    );
  });

  it('defaults shareScope to the shared React scope', () => {
    expect(parseManifest(valid)[0].shareScope).toBe('default');
  });

  it('keeps an explicit shareScope, which is how a remote opts out of shared React', () => {
    const isolated = {
      legacy: {
        url: 'https://cdn.example/legacy.js',
        contract: 1,
        shareScope: 'legacy',
      },
    };

    expect(parseManifest(isolated)[0].shareScope).toBe('legacy');
  });

  it('rejects a manifest that is not an object', () => {
    expect(() => parseManifest('nope')).toThrow(/must be a JSON object/);
  });

  it('rejects an entry with no url, rather than registering an unloadable remote', () => {
    expect(() => parseManifest({ web: { contract: 1 } })).toThrow(/web.*url/);
  });

  it('rejects a contract version the host does not implement', () => {
    const future = { web: { url: 'https://cdn.example/web.js', contract: 99 } };

    expect(() => parseManifest(future)).toThrow(/contract 99/);
  });
});

describe('fallbackOf', () => {
  it('points the entry at the previous version, which is the rollback', () => {
    const rolledBack = fallbackOf(parseManifest(valid)[0]);

    expect(rolledBack?.url).toBe(
      'https://cdn.example/web/v1.9.3/remoteEntry.js',
    );
    expect(rolledBack?.name).toBe('web');
  });

  it('returns null when no previous version was published', () => {
    const single = { web: { url: 'https://cdn.example/web.js', contract: 1 } };

    expect(fallbackOf(parseManifest(single)[0])).toBeNull();
  });
});
