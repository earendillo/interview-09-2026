import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './app';

describe('App', () => {
  it('renders the heading and the item list', () => {
    const { container } = render(<App />);

    expect(container.querySelector('h1')?.textContent).toBe('Web Application');
    // Scoped to the item list: the page also renders the rendering demo,
    // whose explanation is a list of its own.
    const list = container.querySelector('[data-testid="item-list"]');
    expect(
      [...(list?.querySelectorAll('li') ?? [])].map((li) => li.textContent),
    ).toEqual(['Item 1', 'Item 2']);
  });
});
