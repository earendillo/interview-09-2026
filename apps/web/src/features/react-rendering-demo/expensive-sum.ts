/**
 * A deliberately slow pure function, standing in for a real calculation
 * (sorting, filtering, formatting a large list, ...).
 *
 * It is slow enough to be worth memoising and pure enough that memoising it
 * is safe - both conditions have to hold before `useMemo` earns its place.
 */
export function expensiveSum(size: number): number {
  let total = 0;

  for (let i = 0; i < size; i += 1) {
    total += Math.sqrt(i);
  }

  return Math.round(total);
}

/** Small enough to stay responsive, large enough to be a real calculation. */
export const WORK_SIZE = 200_000;
