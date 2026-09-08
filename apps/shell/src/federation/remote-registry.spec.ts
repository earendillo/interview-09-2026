import { describe, expect, it, vi } from 'vitest';
import { createRemoteRegistry } from './remote-registry';
import type { RemoteEntry } from './manifest';

const entry = (over: Partial<RemoteEntry> = {}): RemoteEntry => ({
  name: 'web',
  url: 'https://cdn.example/web/v2.js',
  fallbackUrl: 'https://cdn.example/web/v1.js',
  shareScope: 'default',
  contract: 1,
  ...over,
});

const widget = { default: () => null };

describe('createRemoteRegistry', () => {
  it('registers every manifest entry in the federation runtime', () => {
    const registerRemotes = vi.fn();

    createRemoteRegistry({
      entries: [entry()],
      registerRemotes,
      loadRemote: vi.fn(),
    });

    expect(registerRemotes).toHaveBeenCalledWith(
      [
        {
          name: 'web',
          entry: 'https://cdn.example/web/v2.js',
          type: 'module',
          shareScope: 'default',
        },
      ],
      { force: true },
    );
  });

  it('loads the requested module from the current build', async () => {
    const loadRemote = vi.fn().mockResolvedValue(widget);
    const registry = createRemoteRegistry({
      entries: [entry()],
      registerRemotes: vi.fn(),
      loadRemote,
    });

    await expect(registry.load('web', 'WebWidget')).resolves.toBe(widget);
    expect(loadRemote).toHaveBeenCalledWith('web/WebWidget');
  });

  it('rolls back to the previous build when the current one fails to load', async () => {
    const registerRemotes = vi.fn();
    const loadRemote = vi
      .fn()
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValueOnce(widget);

    const registry = createRemoteRegistry({
      entries: [entry()],
      registerRemotes,
      loadRemote,
    });

    await expect(registry.load('web', 'WebWidget')).resolves.toBe(widget);

    expect(registerRemotes).toHaveBeenLastCalledWith(
      [expect.objectContaining({ entry: 'https://cdn.example/web/v1.js' })],
      { force: true },
    );
  });

  it('keeps using the rolled-back build for later loads', async () => {
    const loadRemote = vi
      .fn()
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValue(widget);
    const registry = createRemoteRegistry({
      entries: [entry()],
      registerRemotes: vi.fn(),
      loadRemote,
    });

    await registry.load('web', 'WebWidget');
    await registry.load('web', 'OtherWidget');

    expect(loadRemote).toHaveBeenCalledTimes(3);
  });

  it('gives up when the rollback also fails, instead of retrying forever', async () => {
    const loadRemote = vi.fn().mockRejectedValue(new Error('404'));
    const registry = createRemoteRegistry({
      entries: [entry()],
      registerRemotes: vi.fn(),
      loadRemote,
    });

    await expect(registry.load('web', 'WebWidget')).rejects.toThrow('404');
    expect(loadRemote).toHaveBeenCalledTimes(2);
  });

  it('surfaces the failure when there is no previous build to roll back to', async () => {
    const loadRemote = vi.fn().mockRejectedValue(new Error('404'));
    const registry = createRemoteRegistry({
      entries: [entry({ fallbackUrl: undefined })],
      registerRemotes: vi.fn(),
      loadRemote,
    });

    await expect(registry.load('web', 'WebWidget')).rejects.toThrow('404');
    expect(loadRemote).toHaveBeenCalledTimes(1);
  });

  it('refuses a remote the manifest never listed', async () => {
    const registry = createRemoteRegistry({
      entries: [entry()],
      registerRemotes: vi.fn(),
      loadRemote: vi.fn(),
    });

    await expect(registry.load('legacy', 'LegacyWidget')).rejects.toThrow(
      /not in the manifest/,
    );
  });
});

describe('rollback reporting', () => {
  it('reports the remote and the build it fell back to', async () => {
    const onRollback = vi.fn();
    const loadRemote = vi
      .fn()
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValueOnce(widget);

    const registry = createRemoteRegistry({
      entries: [entry()],
      registerRemotes: vi.fn(),
      loadRemote,
      onRollback,
    });

    await registry.load('web', 'WebWidget');

    expect(onRollback).toHaveBeenCalledWith({
      name: 'web',
      from: 'https://cdn.example/web/v2.js',
      to: 'https://cdn.example/web/v1.js',
      reason: '404',
    });
  });

  it('does not report a rollback when the current build loads', async () => {
    const onRollback = vi.fn();
    const registry = createRemoteRegistry({
      entries: [entry()],
      registerRemotes: vi.fn(),
      loadRemote: vi.fn().mockResolvedValue(widget),
      onRollback,
    });

    await registry.load('web', 'WebWidget');

    expect(onRollback).not.toHaveBeenCalled();
  });
});
