# Testing and accessibility

A worked example on the existing item-filtering feature in `apps/web`
(`docs/item-filter-demo.md`). No new feature was added for this phase: the
point is to show a testing strategy and an accessibility fix on code that
already exists.

```
apps/web/src/features/item-filter-demo/
├── filter-field.tsx                  the accessible filter control (new)
├── filter-items.spec.ts              UNIT        — pure logic
├── filter-field.spec.tsx             UNIT        — one component in isolation
├── item-filter-demo.spec.tsx         INTEGRATION — the feature, fetch mocked
└── item-filter-demo.a11y.spec.tsx    A11Y        — axe over the same tree

apps/web/src/test-setup.ts            registers the jest-dom / jest-axe matchers
apps/web-e2e/src/item-filter.spec.ts  E2E         — one journey, real API
```

Commands:

```bash
pnpm nx test @interview/web        # unit + integration + axe
pnpm nx e2e @interview/web-e2e     # the single Playwright journey
pnpm nx lint @interview/web
```

---

## 1. The testing pyramid, on this feature

```
                    E2E                 1 test  — real browser, real API
                     ↑
              INTEGRATION         15 + 4 tests — whole feature, fetch mocked
                                               (behaviour + axe)
                     ↑
                   UNIT            6 + 11 tests — pure logic + one component
```

### Unit — `filter-items.spec.ts`, `filter-field.spec.tsx`

**What belongs here:** anything with no collaborators worth wiring up. Pure
functions, and single components whose only dependency is the parent that
owns their state.

**What is mocked:** as little as possible. `filterItems` gets nothing — it is
a pure function, so the test _is_ the contract. `FilterField` gets a `vi.fn()`
for `onChange`, because it is a controlled component and the state owner is
genuinely the only collaborator it has.

**Which failure it catches:** a wrong result or a broken contract, pinned to
one file. The sharpest example is

```ts
expect(filterItems(items, '')).toBe(items); // identity, not equality
```

A "defensive" `items.slice()` in `filterItems` passes every `toEqual`
assertion and silently un-optimises the memoised panel downstream, because
`useMemo` and `memo` both compare by reference. That is the realistic bug
review would wave through, and this is the test that fails on it.

### Integration — `item-filter-demo.spec.tsx`

**What belongs here:** the user flow across components —
`render → type → state changes → UI updates`. `useItems`, both panels,
`filterItems`, `expensiveScore`, `FilterField` and the memoised list all run
for real.

**What is mocked, and why:** `fetch`, and nothing else. It is a genuine
external boundary (it would open a socket), the test needs a deterministic
payload to assert derived counts against, and its call count is itself part
of what is under test — "filtering makes no further request" is the claim the
whole performance demo rests on.

**What is deliberately not mocked:** no React component is stubbed. Replacing
a panel with a fake would delete exactly the wiring these tests exist to
cover, and would turn a behaviour test into a snapshot of the mock.

**Which failure it catches:** components that each pass their own unit tests
but are wired together wrongly — the fetch firing twice, the filter reaching
one panel and not the other, a memoisation dependency array losing an entry.

### E2E — `apps/web-e2e/src/item-filter.spec.ts`

**What belongs here:** exactly one journey —
`open the app → wait for the real API → filter → clear it from the keyboard`.

**What is mocked:** nothing. The Node API, the Vite dev proxy and the real
bundle all run. Playwright starts both servers itself from the `webServer`
block in `playwright.config.ts`, and `reuseExistingServer` attaches to a
`nx dev` session that is already running instead of failing on a busy port.

**Why it stays focused:** E2E is the slowest and most brittle level, and its
failures are the least specific — a red E2E says "something in the system
broke", not which unit. Every assertion that can live in jsdom lives in
jsdom. What only this level can prove is the wiring across process boundaries
and the _browser's real focus model_, which jsdom approximates but does not
implement.

**Which failure it catches:** the dev proxy misconfigured, the API contract
drifting from the shared `Item` type, a build that only fails in a browser,
or tab-order and focus behaviour that jsdom would have let through.

### What is deliberately not tested

`expensiveScore` has no test of its own. Its only contract is "pure and
expensive", and both halves are covered indirectly by the memoisation
assertions in the integration spec. Asserting its exact numeric output would
pin down a tuning constant, not a behaviour.

---

## 2. The accessibility bug

The clear button on the filter input —
`apps/web/src/features/item-filter-demo/filter-field.tsx`.

### Problem

_What could the keyboard or screen-reader user not do?_

Two separate failures in one small control:

1. **A screen-reader user could not tell what the button was.** It was
   announced as just "button" — no name, no purpose, indistinguishable from
   any other unnamed button in the tab order.
2. **A keyboard user lost their place by using it.** Activating the button
   cleared the filter, and clearing the filter removed the button from the
   DOM. Focus fell back to `<body>`, so the next `Tab` restarted from the top
   of the document — past the header, the rendering demo and the whole left
   panel — to get back to the input they were working in.

### Cause

_What was incorrect in the markup/interaction?_

```tsx
<button type="button" onClick={handleClear}>
  <span aria-hidden="true">×</span>
</button>
```

The button's only content is a decorative glyph marked `aria-hidden="true"`,
which is right in itself — "×" read aloud is noise. But that leaves the
element with **no accessible name at all**: no text content, no `aria-label`,
no `aria-labelledby`. It looks obviously labelled on screen and is completely
anonymous in the accessibility tree.

The focus failure is a separate and very common React shape: the element that
handles the event is conditionally rendered on the state that the event
changes. Nothing in React moves focus when a focused node unmounts — the
browser drops it to `<body>`.

### Fix

```tsx
<button type="button" aria-label="Clear filter" onClick={handleClear}>
  <span aria-hidden="true">×</span>
</button>
```

```tsx
const handleClear = () => {
  onChange('');
  inputRef.current?.focus(); // the button is about to unmount
};
```

Three smaller fixes went in alongside, all the same category — a UI update
that changes nothing a non-visual user can perceive:

- `role="status"` on the match count, so filtering announces
  `11 of 500 items match “Item 12”` instead of silently swapping the list;
- `role="alert"` on the API failure message in `item-filter-demo.tsx`, which
  otherwise replaces both panels without a word;
- `aria-pressed` on the item rows in `item-list.tsx`, where selection had
  been conveyed by background colour alone.

### Verification

_How did you verify the fix?_

| How                   | Where                                                                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessible name       | `toHaveAccessibleName('Clear filter')` in `filter-field.spec.tsx`                                                                                                                                                       |
| Focus restoration     | `expect(input).toHaveFocus()` after clicking clear, driven through a real stateful parent so the button actually unmounts                                                                                               |
| axe rule engine       | `expect(await axe(container)).toHaveNoViolations()` over the control and over the whole loaded feature                                                                                                                  |
| Real browser keyboard | the E2E journey tabs to the button, presses `Enter`, and asserts focus landed back on the input                                                                                                                         |
| Manual                | `pnpm nx dev @interview/web` → Tab to the filter, type, Tab once, `Enter`. The focus ring returns to the input; with VoiceOver/NVDA the button reads "Clear filter, button" and the count is announced on every change. |

The regression tests were confirmed to be load-bearing by deleting the
`aria-label` and the `focus()` call and re-running: **five** tests fail,
across three files. A check that has never failed is not a check.

---

## 3. What the automated accessibility check does and does not prove

`jest-axe` (a wrapper around axe-core) is the only new dependency in this
phase. It is scoped on purpose:

```ts
axe(container, {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
});
```

axe's `best-practice` rule set also flags things this playground does
deliberately — demo `<section>`s that are not landmarks. A check that is
permanently red is a check nobody reads.

**It does not prove the page is accessible.** axe-core is a static rule
engine over the rendered DOM. It caught exactly one of the two bugs above,
and it is structurally incapable of catching the other:

| Issue                                     | axe                 | Caught by                         |
| ----------------------------------------- | ------------------- | --------------------------------- |
| Button with no accessible name            | yes (`button-name`) | axe                               |
| Focus dropped to `<body>` after an update | no                  | explicit focus assertion + E2E    |
| Selection conveyed by colour only         | no                  | explicit `aria-pressed` assertion |
| A live region that says something useless | no                  | manual screen-reader pass         |
| A tab order that is legal but nonsensical | no                  | manual keyboard pass              |

Automated tooling covers roughly a third of the WCAG success criteria. Its
value is that it is free, fast, and catches regressions — not that it is a
sign-off.

To keep that honest, `filter-field.spec.tsx` renders the **pre-fix markup** as
a fixture and asserts that axe reports `button-name` on it. That test is what
makes the green ones mean anything.

---

## 4. Interview walkthrough

1. **Show the feature** — `pnpm nx dev @interview/web`, open
   `http://localhost:4200`. Type in the filter: the counters and the live
   region update, the HTTP request counter does not move.
2. **The isolated unit test** — `filter-items.spec.ts`. No React, no DOM,
   nothing mocked. Point at the `toBe(items)` identity assertion and explain
   why `toEqual` would miss the bug.
3. **The integration test** — `item-filter-demo.spec.tsx`. One mock: `fetch`.
   Explain why that boundary and no other, and why no React component is
   stubbed.
4. **The E2E test** — `pnpm nx e2e @interview/web-e2e`. One journey. Explain
   what only this level can prove.
5. **The accessibility problem** — show the "Cause" markup above: an
   `aria-hidden` glyph inside a button with no other name.
6. **Demonstrate it with the keyboard** — Tab to the filter, type `Item 12`,
   Tab once to the clear button, press `Enter`. In the shipped code focus
   returns to the input. Describe what the broken version did: focus to
   `<body>`, and a screen reader announcing "button".
7. **The fix** — `aria-label` plus `inputRef.current?.focus()` in
   `handleClear`, each with the comment explaining why.
8. **The regression test** — `pnpm nx test @interview/web`. Then delete the
   `aria-label`, rerun, and watch five tests go red across three files.
