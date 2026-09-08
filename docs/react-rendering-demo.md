# React rendering demonstration

A small feature in `apps/web` used to talk through rendering, rerendering,
`useEffect` dependencies, and the three memoisation tools.

```
apps/web/src/features/react-rendering-demo/
├── react-rendering-demo.tsx        composition + the on-screen explanation
├── unoptimized-parent.tsx          "before" column
├── optimized-parent.tsx            "after" column
├── child-panel.tsx                 the observed child (+ its memo wrapper)
├── effect-demo.tsx                 useEffect / dependency-array demo
├── expensive-sum.ts                a deliberately slow pure function
├── use-render-count.ts             ref-based render counter
└── react-rendering-demo.spec.tsx   tests
```

It is mounted in `apps/web/src/app/app.tsx`. Nothing else in the workspace was
changed, and the Module Federation setup is untouched.

Run it with `pnpm exec nx serve web` (http://localhost:4200).

## Rendering

**What causes the initial render?** Mounting: `createRoot(...).render(<App />)`
in `main.tsx` renders the tree once. Every component function runs, then React
commits the resulting DOM.

**What causes a rerender?** A state update (`setState` with a value React does
not consider equal, compared with `Object.is`), a context value change, or the
parent rendering. The third one is the important one for this demo: when a
parent rerenders, React re-invokes its children by default — it does **not**
compare props first. Opting into a comparison is what `React.memo` is for.

**When does `useEffect` run?** After the render is committed to the DOM, never
during it. It always runs after the first render; after that it runs again only
when one of its dependencies changed, compared with `Object.is`. The cleanup
function runs before the next run and on unmount.

Answers to the usual follow-up questions:

| Question | Answer |
| --- | --- |
| Does it run after the initial render? | Yes, always — the dependency array only controls *subsequent* runs. |
| What happens when `someState` changes? | Cleanup (if any) runs, then the effect runs again. |
| Empty array `[]`? | Runs once after mount, cleanup on unmount. |
| Dependency is an object created during render? | It is a new reference every render, so the effect runs after **every** render. Depend on the primitive fields instead (`config.id`), or memoise the object. |
| Dependency omitted (no array at all)? | The effect runs after every render. Omitting a *used value* from a non-empty array is different and worse: the effect closes over a stale value and silently stops reflecting reality. |

The demo shows the last two side by side: `[config]` keeps climbing, while
`[config.id]` stays at 1.

## Unnecessary rerender

**What caused it?** `UnoptimizedParent` creates the child's props inside its
render body:

```tsx
const user = { id: 1, name: 'Ada' };        // new object every render
const handleSelect = () => setSelectedId(1); // new function every render
```

**How was it observed?** `useRenderCount()` — a `useRef` counter incremented
during render — is displayed in each component. Incrementing the parent's state
five times takes both the parent and the child from 1 to 6 renders. A ref is
used rather than state because writing to state during render would schedule
another render. The React DevTools profiler ("Highlight updates when components
render", or "Why did this render?") shows the same thing without any code.

**Why did it happen?** The child *is* wrapped in `React.memo`, but memo does a
shallow comparison of props with `Object.is`, and two structurally identical
object literals are not the same reference. So memo sees "props changed" and
renders. This is the key interview point: **`React.memo` on the child cannot fix
a parent that hands it fresh references.**

## Optimization

`OptimizedParent` renders the same memoised child and fixes the props, using a
different tool for each problem — deliberately not all three everywhere:

- **`React.memo`** (in `child-panel.tsx`) — opts the child into a prop
  comparison at all. Without it, stable props change nothing: React would
  re-invoke the child regardless.
- **`useMemo`** — for `expensiveSum(WORK_SIZE)`. It is expensive and pure, and
  it does not depend on `count`, so recomputing it on every increment is wasted
  work. `useMemo` skips the work *and* keeps the resulting value referentially
  stable for the memoised child. Counter: "Calculations run" stays at 1 on the
  right and climbs on the left.
- **`useCallback`** — for `handleSelect`. Creating the function is cheap; the
  reason to wrap it is *identity*, so the child's memo comparison keeps passing.
- **Neither** — for the `user` object. It never depends on props or state, so it
  is a module constant (`const USER = ...`) outside the component. The cheapest
  fix is often not a hook.

**Why not use them everywhere?** Every memoised value costs a dependency array
that has to stay correct (a wrong one causes stale-value bugs), extra memory for
the cached value, and reading noise. The comparison work itself is not free
either, so for a cheap component memoisation can cost more than the render it
avoids. Use it when a render is measurably expensive, or when a stable identity
is required by something downstream (`memo`, a `useEffect` dependency, a
subscription). React Compiler is aimed at removing most of these hand-written
cases; this playground does not use it.

### The measurable difference

After five increments in each column (numbers from
`react-rendering-demo.spec.tsx`):

```
Before optimization          After optimization
Parent renders: 6            Parent renders: 6
Child renders:  6            Child renders:  1
Calculations:   6            Calculations:   1
```

The parent count is intentionally the same in both columns — the optimization
was never about the parent. Clicking "Select user" on the right *does* rerender
the child, because `isSelected` genuinely changed; memo skips renders, it does
not block them.

Note: in the browser the app runs inside `<StrictMode>`, which double-invokes
render functions in development, so the counters step by 2 per click. Tests run
without StrictMode and step by 1. The ratio between the columns is the point,
not the absolute numbers.

## React version

```
React version used by this project: 19.0.0
```

(`react` and `react-dom` are pinned to `19.0.0` in the root `package.json`; the
installed tree resolves to the same version.)

### Implemented in this playground

Because the project is already on React 19, one React 19 API is used directly:

- **`ref` as an ordinary prop for function components.** `ChildPanel` declares
  `ref?: Ref<HTMLButtonElement>` in its props and forwards it to a `<button>` —
  no `forwardRef` wrapper. `OptimizedParent` passes a `useRef` object through
  `memo` and focuses the child's button with it. This is also a small rendering
  point: a ref object is referentially stable, so passing it does not defeat the
  memo comparison. In React 18 this component would have needed
  `forwardRef(...)`, and `forwardRef` is deprecated in 19.

### Investigated / understood

Read about, not used in this repository, and not used in production by me:

- **`useMemo`/`useCallback` and React Compiler.** The React 19 compiler
  auto-memoises component output so most manual `useMemo`/`useCallback` calls
  become unnecessary. It is opt-in via a Babel plugin and is *not* enabled here
  — which is precisely why the manual version above is still worth explaining.
- **`useActionState`, `useOptimistic`, and `use`.** React 19 adds first-class
  handling for async transitions in forms (`useActionState` tracks pending state
  and the action result) and optimistic UI (`useOptimistic`), plus `use()` for
  reading a promise or context conditionally. They would replace hand-rolled
  `isLoading` state in a data-writing form; there is no such form in this
  playground, so nothing was added for them.

## Interview walkthrough

1. **Initial render.** Open http://localhost:4200. Both columns read
   `Parent renders: 2`, `Child renders: 2` (StrictMode double-invoke — say so).
2. **Change state.** Click **Increment** on the left a few times.
3. **Parent rerenders.** The left parent counter climbs — `setState` rerendered
   the owner of the state.
4. **Child rerenders.** The left child counter climbs by the same amount, and it
   is a `React.memo` component.
5. **Explain why.** The parent builds `user` and `handleSelect` in its render
   body; memo's shallow `Object.is` check sees two new references. Point out
   that "Calculations run" climbs too — the expensive function is redone for a
   state it does not depend on.
6. **Optimized version.** Walk the right column: module constant for the object,
   `useMemo` for the calculation, `useCallback` for the handler.
7. **Repeat the state update.** Click **Increment** on the right the same number
   of times.
8. **Explain the difference.** The parent counter climbs identically; the child
   counter and the calculation counter stay at their initial value. Then click
   **Select user** on the right to show the child *does* rerender when a prop
   really changes — and **Focus child button** for the React 19 ref-as-prop.
9. **useEffect execution.** In the bottom section: `count + 1` appends a
   `[count]` line; `Unrelated state + 1` rerenders without appending one; the
   `[]` line never repeats; `[config]` climbs while `[config.id]` stays at 1.

## Tests

`pnpm exec nx test web` — covers the initial render, state updates, the
unnecessary child rerender, the optimized child and calculation counts, the
"real prop change still rerenders" case, and the four effect behaviours.
