import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ForeignRemote } from './foreign-remote';

const mountedInto = (container: Element, text: string) => {
  const node = container.ownerDocument.createElement('span');
  node.textContent = text;
  container.appendChild(node);
  return () => node.remove();
};

describe('ForeignRemote', () => {
  it('hands the remote a DOM node instead of rendering it as a React element', async () => {
    const mount = vi.fn((container: Element) =>
      mountedInto(container, 'legacy content'),
    );

    render(
      <ForeignRemote
        label="Legacy remote"
        loader={async () => ({ contract: 1, mount })}
      />,
    );

    expect(await screen.findByText('legacy content')).toBeTruthy();
    expect(mount.mock.calls[0][0]).toBeInstanceOf(HTMLElement);
  });

  it('passes props through to the remote', async () => {
    const mount = vi.fn(
      (container: Element, _props?: Record<string, unknown>) =>
        mountedInto(container, 'x'),
    );

    render(
      <ForeignRemote
        label="Legacy remote"
        loader={async () => ({ contract: 1, mount })}
        props={{ title: 'hello' }}
      />,
    );

    await waitFor(() => expect(mount).toHaveBeenCalled());
    expect(mount.mock.calls[0][1]).toEqual({ title: 'hello' });
  });

  it('unmounts the foreign tree when the slot goes away', async () => {
    const unmount = vi.fn();
    const { unmount: unmountSlot } = render(
      <ForeignRemote
        label="Legacy remote"
        loader={async () => ({ contract: 1, mount: () => unmount })}
      />,
    );

    await waitFor(() => expect(unmount).not.toHaveBeenCalled());
    unmountSlot();

    await waitFor(() => expect(unmount).toHaveBeenCalledTimes(1));
  });

  it('refuses a remote built against a different contract', async () => {
    const mount = vi.fn();

    render(
      <ForeignRemote
        label="Legacy remote"
        loader={async () => ({ contract: 99, mount })}
      />,
    );

    expect(await screen.findByText('Unable to load Legacy remote')).toBeTruthy();
    expect(mount).not.toHaveBeenCalled();
  });

  it('shows a fallback when the remote cannot be loaded', async () => {
    render(
      <ForeignRemote
        label="Legacy remote"
        loader={() => Promise.reject(new Error('offline'))}
      />,
    );

    expect(await screen.findByText('Unable to load Legacy remote')).toBeTruthy();
  });

  it('contains a remote that throws while mounting, since it has no boundary of its own', async () => {
    render(
      <ForeignRemote
        label="Legacy remote"
        loader={async () => ({
          contract: 1,
          mount: () => {
            throw new Error('boom');
          },
        })}
      />,
    );

    expect(await screen.findByText('Unable to load Legacy remote')).toBeTruthy();
  });
});
