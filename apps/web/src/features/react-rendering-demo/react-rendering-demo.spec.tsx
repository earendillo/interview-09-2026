import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReactRenderingDemo } from './react-rendering-demo';

/**
 * The tests assert the behaviour the demo is about - how many times each
 * component rendered and when effects ran - rather than markup details.
 *
 * Note: these run without `<StrictMode>`, so render counters step by 1 per
 * update. In the browser the app is wrapped in StrictMode and they step by 2.
 */

const count = (testId: string) =>
  Number(screen.getByTestId(testId).textContent);

const clickTimes = (testId: string, times: number) => {
  for (let i = 0; i < times; i += 1) {
    fireEvent.click(screen.getByTestId(testId));
  }
};

describe('initial render', () => {
  it('renders every parent and child exactly once', () => {
    render(<ReactRenderingDemo />);

    expect(count('before-parent-renders')).toBe(1);
    expect(count('before-child-renders')).toBe(1);
    expect(count('after-parent-renders')).toBe(1);
    expect(count('after-child-renders')).toBe(1);
  });

  it('shows the initial state value', () => {
    render(<ReactRenderingDemo />);

    expect(screen.getByTestId('before-count').textContent).toBe('0');
    expect(screen.getByTestId('after-count').textContent).toBe('0');
  });
});

describe('state update', () => {
  it('rerenders the parent once per setState call', () => {
    render(<ReactRenderingDemo />);

    clickTimes('before-increment', 3);

    expect(screen.getByTestId('before-count').textContent).toBe('3');
    expect(count('before-parent-renders')).toBe(4); // initial + 3 updates
  });

  it('leaves the other parent alone: state is local', () => {
    render(<ReactRenderingDemo />);

    clickTimes('before-increment', 3);

    expect(count('after-parent-renders')).toBe(1);
  });
});

describe('unnecessary child rerender', () => {
  it('rerenders the memoised child on every parent render, because the props are new references', () => {
    render(<ReactRenderingDemo />);

    clickTimes('before-increment', 5);

    expect(count('before-parent-renders')).toBe(6);
    expect(count('before-child-renders')).toBe(6);
  });

  it('redoes the expensive calculation on every render', () => {
    render(<ReactRenderingDemo />);

    clickTimes('before-increment', 5);

    expect(count('before-calculations')).toBe(6);
  });
});

describe('optimized version', () => {
  it('rerenders the parent but not the child', () => {
    render(<ReactRenderingDemo />);

    clickTimes('after-increment', 5);

    expect(count('after-parent-renders')).toBe(6);
    expect(count('after-child-renders')).toBe(1);
  });

  it('runs the useMemo calculation only once', () => {
    render(<ReactRenderingDemo />);

    clickTimes('after-increment', 5);

    expect(count('after-calculations')).toBe(1);
  });

  it('still rerenders the child when a prop actually changes', () => {
    render(<ReactRenderingDemo />);

    clickTimes('after-increment', 2);
    expect(count('after-child-renders')).toBe(1);

    fireEvent.click(screen.getByTestId('after-select'));

    expect(screen.getByTestId('after-selected').textContent).toBe('yes');
    expect(count('after-child-renders')).toBe(2);
  });

  it('does not rerender the child when the same value is set again', () => {
    render(<ReactRenderingDemo />);

    fireEvent.click(screen.getByTestId('after-select'));
    fireEvent.click(screen.getByTestId('after-select'));

    expect(count('after-child-renders')).toBe(2);
  });
});

describe('useEffect dependencies', () => {
  it('runs both effects after the initial render', () => {
    render(<ReactRenderingDemo />);

    expect(screen.getByTestId('effect-log').textContent).toContain(
      '[] effect ran',
    );
    expect(screen.getByTestId('effect-log').textContent).toContain(
      '[count] effect ran, count = 0',
    );
  });

  it('reruns the [count] effect when count changes', () => {
    render(<ReactRenderingDemo />);

    clickTimes('effect-increment', 2);

    const log = screen.getByTestId('effect-log').textContent ?? '';
    expect(log).toContain('[count] effect ran, count = 1');
    expect(log).toContain('[count] effect ran, count = 2');
    // The empty dependency array means mount only, no matter how many renders.
    expect(log.match(/\[\] effect ran/g)).toHaveLength(1);
  });

  it('does not rerun the [count] effect for an unrelated state update', () => {
    render(<ReactRenderingDemo />);

    const before = (screen.getByTestId('effect-log').textContent ?? '').match(
      /\[count\] effect ran/g,
    )?.length;

    clickTimes('effect-unrelated-button', 3);

    expect(screen.getByTestId('effect-unrelated').textContent).toBe('3');
    expect(
      (screen.getByTestId('effect-log').textContent ?? '').match(
        /\[count\] effect ran/g,
      )?.length,
    ).toBe(before);
  });

  it('reruns an object dependency every render, but a primitive one only once', () => {
    render(<ReactRenderingDemo />);

    clickTimes('effect-unrelated-button', 3);

    expect(count('effect-object-dep')).toBeGreaterThan(1);
    expect(count('effect-primitive-dep')).toBe(1);
  });
});
