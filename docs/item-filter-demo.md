# Item filtering: performance and caching

A small feature in `apps/web` used to talk through a concrete rendering
bottleneck, how it was measured, and why `useMemo`/`useCallback` fix it — on
top of the existing `GET /api/items` endpoint and the shared `Item` type.

```
apps/web/src/features/item-filter-demo/
├── item-filter-demo.tsx          fetches once, renders both panels + explanation
├── unoptimized-panel.tsx         "before" panel
├── optimized-panel.tsx           "after" panel
├── item-list.tsx                 the memoised child list
├── stat.tsx                      one labelled counter
├── use-items.ts                  local-state loader for GET /api/items
├── item-api.ts                   the single fetch + an HTTP request counter
├── filter-items.ts               pure filter (items + filter -> visibleItems)
├── expensive-score.ts            a deliberately slow pure calculation
├── filter-field.tsx              the filter input, clear button and live region
├── filter-items.spec.ts          unit tests for the pure filter
├── filter-field.spec.tsx         unit tests for the filter control
├── item-filter-demo.spec.tsx     integration tests (HTTP boundary mocked)
└── item-filter-demo.a11y.spec.tsx  axe accessibility check
```

It is mounted in `apps/web/src/app/app.tsx`, below the rendering demo. The
Module Federation setup is untouched.

## Data flow

```
GET /api/items
   ↓
items            (useState, written once — the source of truth)
   ↓
filter           (useState, a string)
   ↓
visibleItems     (derived: Array.prototype.filter)
   ↓
render
```

`filterItems` returns a **new** array and never touches its input, so the
fetched result is never mutated, sorted or replaced. Clearing the filter does
not "restore" anything — it simply derives the full list again (and for an
empty filter it returns the original array reference, which keeps the memoised
child from rerendering for nothing).

### Running it

```bash
pnpm nx serve @interview/api    # http://localhost:3333
pnpm nx dev   @interview/web    # http://localhost:4200
```

The client fetches the relative path `/api/items`; `apps/web/vite.config.mts`
proxies `/api` to `http://localhost:3333`, so the API needs no CORS handling
and the client needs no environment-specific base URL. If the API is not
running, the feature renders an error line instead of the panels.

The API fixture was grown from 3 to **500 items** (`apps/api/src/app/items.ts`,
`ITEM_COUNT`) so filtering and the derived calculation are actually observable.
It is still an in-memory array — no database was added.

## Bottleneck

**What was repeated?** `UnoptimizedPanel` derives everything in its render
body:

```tsx
const visibleItems = filterItems(items, filter); // every render
const score = expensiveScore(visibleItems); // every render
```

`expensiveScore` walks the visible items doing `WORK_PER_ITEM` (20 000) square
roots each — a stand-in for real derived work (formatting, grouping, charting).

**What triggers it?** Any rerender of the panel, including one caused by state
the calculation does not depend on. The **Unrelated state + 1** button exists
only to make that unmistakable: it changes a number that is displayed and
nothing else, and the score is recomputed anyway.

**How was it measured?**

- `performance.now()` around the calculation, displayed as _Last score (ms)_;
- ref counters for panel renders, filter runs, score runs, list renders;
- the same counters asserted in `item-filter-demo.spec.tsx`;
- React DevTools Profiler in the browser shows the same commit durations
  without any of this instrumentation — the counters are here so the numbers
  survive into the tests.

**Is it meaningful?** Yes, at this size. One full 500-item pass measured
**72–92 ms** in the jsdom test environment and **~19–20 ms** in plain Node
(same input, `Math.sqrt` loop). Either way it is well past one 16 ms frame, so
every unrelated state update drops frames. With the filter narrowed to 15 items
the same calculation costs **2.6 ms** — worth saying out loud, because it shows
the honest limit of this: on a small list the memoisation would be noise, and
the right answer would be to leave the code alone.

**What is deliberately _not_ measured here: Web Vitals.** There is no LCP, INP
or CLS instrumentation anywhere in this workspace, and no Lighthouse run. That
is a scope choice, not an oversight: this feature answers the
_state-management_ half of the performance question — a specific bottleneck in
derived data, measured before and after a code change — and the numbers above
are `performance.now()` timings and render counters, which is the right
instrument for that.

Field metrics answer a different question, on a different axis. INP would be
the closest of the three to what is demonstrated here, since a long synchronous
recalculation on an unrelated state update is exactly what stretches the
interaction-to-next-paint window — but INP is a 75th-percentile field
measurement over real sessions, and this workspace has no traffic, no
`web-vitals` reporting endpoint and no deployment (CI/CD is intentionally not
implemented). Reporting an LCP from a localhost dev server with 500 in-memory
items would be a number without a meaning. The honest version of that work is a
`web-vitals` listener posting to an analytics sink plus a budget enforced in a
pipeline, and both halves of that are missing here by design.

## Fix

`OptimizedPanel` is the same UI with three targeted changes:

- **`useMemo` on `visibleItems`**, keyed `[items, filter]` — the only two
  things it depends on. The filtering itself is cheap; the reason to memoise it
  is that the result feeds the expensive calculation and the memoised child, so
  it also has to be _referentially_ stable.
- **`useMemo` on the score**, keyed `[visibleItems]`. Expensive, pure, and
  independent of `unrelated` — the textbook case.
- **`useCallback` on `handleSelect`**, keyed `[]`. `useCallback` memoises the
  **function reference, not the result of the function**. Creating the arrow is
  cheap; the reason to wrap it is that `MemoItemList` compares props with
  `Object.is`, and a fresh function fails that comparison on every render.

**What is deliberately _not_ memoised:** `items.length`, the filter string, the
`<Stat>` elements, the panel's JSX. Each memoised value costs a dependency
array that has to stay correct (a wrong one is a stale-value bug) plus memory
for the cached value, and the comparison is not free either. Memoise where a
render is measurably expensive or where a stable identity is required
downstream — not by default. (React Compiler is aimed at removing most of these
hand-written cases; it is not enabled here, which is why the manual version is
still worth explaining.)

## Before / after

Real numbers, from the instrumented panels rendered with the full 500-item
dataset in the test environment, clicking **Unrelated state + 1** five times in
each panel:

```
                       Before        After
Panel renders             6             6
Filter runs               6             1
Score runs                6             1
List renders (memo)       6             1
Last score (ms)        72.2          77.7   <- "after" is the initial pass, never redone
```

The panel render count is intentionally identical: the optimization was never
about the panel. What changed is the work done _inside_ those renders — roughly
**5 × ~75 ms of avoided calculation** over five clicks, and five avoided
rerenders of the list.

Then, still in the optimized panel:

```
type "12" in the filter  -> visible items 500 -> 15, score runs 1 -> 2, last score 2.6 ms
clear the filter         -> visible items back to 500, HTTP requests still 1
```

So the memo recomputes exactly when its dependencies change, and filtering
never touches the network.

## State vs Context vs React Query

**Chosen: local state** (`useItems`, a `useState` + `useEffect` pair).

- Only this feature reads the data.
- The lifecycle is trivial: fetched once on mount, never refetched, never
  invalidated, never written back.
- Nothing needs a shared server-state cache.

Adding a data layer for that would be more machinery to explain than the
feature contains.

**Context** would make sense if several components far apart in the tree needed
the same value and prop drilling had become genuinely painful — configuration,
theme, the current user. It is a _dependency-injection_ mechanism, not a cache:
it has no fetching, no deduplication, no staleness, no revalidation, no
loading/error handling, and every consumer rerenders when the value changes.
Putting server state in Context means hand-writing all of that anyway, which is
why "just use Context for API data" is usually the wrong reach.

**React Query** would be the right call as soon as any of these appear:
caching server state across components and routes; treating data as stale and
revalidating it (window focus, interval, invalidation after a mutation);
deduplicating concurrent requests for the same key; retries; pagination or
infinite lists; and consistent `isLoading`/`isError`/`isFetching` states instead
of a hand-rolled status union. None of those apply to one static list fetched
once, so it was deliberately left out.

Note that this choice is orthogonal to the performance point above: React Query
would replace `useItems`, not the `useMemo` — deriving `visibleItems` from
cached data would still happen in the component, and would still need memoising
at this size.

## Interview walkthrough

1. **Load.** Start the API and `web`, open http://localhost:4200 and scroll to
   the section. The header line shows `status: ready`, `items loaded: 500`.
2. **The original dataset.** Both panels show `Items: 500` — the same fetched
   array, passed down as a prop from one `useItems()` call.
3. **Change unrelated state.** Click **Unrelated state + 1** on the left a few
   times.
4. **The unnecessary work.** _Filter runs_, _Score runs_ and the list's own
   render counter all climb with it, and _Last score (ms)_ shows what each of
   those passes cost. Nothing the calculation depends on changed.
5. **The optimization.** Walk the right panel: `useMemo` on `visibleItems`,
   `useMemo` on the score, `useCallback` on `onSelect`.
6. **Repeat the update.** Click **Unrelated state + 1** on the right the same
   number of times.
7. **The difference.** _Panel renders_ climbs identically; _Filter runs_,
   _Score runs_ and the list renders stay put. Then click a row to show the
   list _does_ rerender when a prop genuinely changes — memo skips renders, it
   does not block them.
8. **Filter.** Type `12` into either filter box. _Visible items_ drops; the
   memo recomputes exactly once.
9. **No request.** _HTTP requests_ stays at its initial value while filtering,
   and clearing the box brings _Visible items_ back to 500 — the fetched array
   was never modified.
10. **`useMemo` vs `useCallback`.** `useMemo` caches the _result_ of a
    computation; `useCallback` caches the _function reference_
    (`useCallback(fn, d)` is `useMemo(() => fn, d)`). The first is for expensive
    derived data; the second is for identity, and only matters when something
    downstream compares references — `React.memo`, a `useEffect` dependency
    array, a subscription.

In the browser the app runs inside `<StrictMode>`, which double-invokes render
functions and mounts effects twice in development: the counters step by 2 per
click and `HTTP requests` reads 2 after mount (the first request is aborted by
the effect cleanup). Tests run without StrictMode and step by 1. The ratio
between the panels is the point, not the absolute numbers.

## Tests

`pnpm exec nx test @interview/web` — `item-filter-demo.spec.tsx` mocks `fetch`
and covers: the result is loaded from `GET /api/items`; a failed request shows
an error instead of the panels; filtering does not mutate or replace the
fetched array; the filter produces the expected visible items; clearing it
restores the full dataset; changing the filter (or unrelated state) makes no
further request; the unoptimized panel redoes both derived values on an
unrelated update while the optimized one does not; the optimized panel
recomputes exactly once when the filter changes and produces the same result as
the unoptimized one; and the memoised list still rerenders on a real prop
change.

## Tests and accessibility

This feature is also the subject of the testing/accessibility phase - the
pyramid across these spec files, the Playwright journey in `apps/web-e2e`, and
the accessible-name/focus bug in `filter-field.tsx` are all written up in
[testing-and-accessibility.md](testing-and-accessibility.md).
