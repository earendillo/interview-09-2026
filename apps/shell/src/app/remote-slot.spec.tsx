import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RemoteSlot } from './remote-slot';

// The federation wiring itself is verified by running the apps; what matters
// here is that one unavailable remote degrades to a message instead of taking
// the shell down.
describe('RemoteSlot', () => {
  it('shows a loading fallback while the remote resolves', () => {
    // A loader that never settles keeps the slot in its Suspense state.
    render(
      <RemoteSlot
        label="Web remote"
        loader={() => new Promise(() => undefined)}
      />,
    );

    expect(screen.getByRole('status').textContent).toBe(
      'Loading Web remote...',
    );
  });

  it('renders the remote component once it loads', async () => {
    render(
      <RemoteSlot
        label="Web remote"
        loader={async () => ({ default: () => <span>remote content</span> })}
      />,
    );

    expect(await screen.findByText('remote content')).toBeTruthy();
  });

  it('falls back to a message when the remote is unavailable', async () => {
    render(
      <RemoteSlot
        label="Web remote"
        loader={() => Promise.reject(new Error('remote unavailable'))}
      />,
    );

    expect(await screen.findByText('Unable to load Web remote')).toBeTruthy();
  });
});
