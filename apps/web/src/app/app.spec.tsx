import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './app';

describe('App', () => {
  it('renders the heading and the item list', () => {
    const { container } = render(<App />);

    expect(container.querySelector('h1')?.textContent).toBe('Web Application');
    expect(
      [...container.querySelectorAll('li')].map((li) => li.textContent),
    ).toEqual(['Item 1', 'Item 2']);
  });
});
