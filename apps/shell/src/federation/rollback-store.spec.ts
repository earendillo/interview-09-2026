import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getRollbacks,
  recordRollback,
  resetRollbacks,
  subscribeRollbacks,
} from './rollback-store';

const event = {
  name: 'web',
  from: 'https://cdn.example/web/v2.js',
  to: 'https://cdn.example/web/v1.js',
  reason: '404',
};

beforeEach(() => resetRollbacks());

describe('rollback store', () => {
  it('starts with no rollbacks', () => {
    expect(getRollbacks()).toEqual([]);
  });

  it('keeps a stable snapshot reference until something changes', () => {
    expect(getRollbacks()).toBe(getRollbacks());
  });

  it('records a rollback and produces a new snapshot', () => {
    const before = getRollbacks();

    recordRollback(event);

    expect(getRollbacks()).not.toBe(before);
    expect(getRollbacks()).toEqual([event]);
  });

  it('notifies subscribers so React can rerender', () => {
    const listener = vi.fn();
    subscribeRollbacks(listener);

    recordRollback(event);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeRollbacks(listener);

    unsubscribe();
    recordRollback(event);

    expect(listener).not.toHaveBeenCalled();
  });

  it('records only the first rollback per remote', () => {
    recordRollback(event);
    recordRollback({ ...event, reason: 'again' });

    expect(getRollbacks()).toHaveLength(1);
  });
});
