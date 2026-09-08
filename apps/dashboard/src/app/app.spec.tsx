import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './app';

describe('App', () => {
  it('renders the heading', () => {
    const { container } = render(<App />);

    expect(container.querySelector('h1')?.textContent).toBe(
      'Dashboard Application',
    );
  });
});
