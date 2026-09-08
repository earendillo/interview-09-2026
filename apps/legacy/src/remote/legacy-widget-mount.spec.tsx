import { describe, expect, it } from 'vitest';
import { version } from 'react';
import { contract, mount } from './legacy-widget-mount';

const container = () => document.createElement('div');

describe('legacy widget mount contract', () => {
  it('declares the contract version the host checks', () => {
    expect(contract).toBe(1);
  });

  it('renders into a DOM node the host owns', () => {
    const node = container();

    mount(node);

    expect(node.textContent).toContain('Legacy remote widget');
  });

  it('renders with this app own React major, not the host one', () => {
    const node = container();

    mount(node);

    expect(version).toMatch(/^17\./);
    expect(node.textContent).toContain(`React ${version}`);
  });

  it('accepts props from the host', () => {
    const node = container();

    mount(node, { title: 'from the shell' });

    expect(node.textContent).toContain('from the shell');
  });

  it('returns an unmount that empties the container', () => {
    const node = container();

    const unmount = mount(node);
    unmount();

    expect(node.textContent).toBe('');
  });
});
