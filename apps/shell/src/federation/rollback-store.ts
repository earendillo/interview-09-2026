import type { RollbackEvent } from './remote-registry';

const listeners = new Set<() => void>();
let snapshot: RollbackEvent[] = [];

export function recordRollback(event: RollbackEvent): void {
  if (snapshot.some((existing) => existing.name === event.name)) return;

  snapshot = [...snapshot, event];
  listeners.forEach((listener) => listener());
}

export function subscribeRollbacks(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function getRollbacks(): RollbackEvent[] {
  return snapshot;
}

export function resetRollbacks(): void {
  snapshot = [];
  listeners.clear();
}
