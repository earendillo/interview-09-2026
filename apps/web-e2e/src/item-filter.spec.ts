import { expect, test } from '@playwright/test';

/**
 * E2E — one realistic journey, against the real API and the real bundle.
 *
 * What only this level can prove: that the Vite dev proxy, the Node API and
 * the React app are actually wired together, and that the keyboard path
 * through the feature works in a real browser's focus model - something jsdom
 * approximates but does not implement.
 *
 * What is deliberately *not* here: memoisation counters, filter edge cases,
 * error states, axe rule coverage. All of those are cheaper, faster and more
 * precise in `apps/web/src/features/item-filter-demo/*.spec.tsx`, and
 * duplicating them here would only buy a slower way to learn the same thing.
 */

test('filters the item list and clears it from the keyboard', async ({
  page,
}) => {
  // 1. Open the application and let the real API load.
  await page.goto('/');

  await expect(page.getByTestId('items-status')).toHaveText('ready', {
    timeout: 30_000,
  });
  await expect(page.getByTestId('items-count')).toHaveText('500');

  // The dev build renders under `<StrictMode>`, so the fetch effect runs
  // twice. The invariant worth testing is that this number does not move
  // again, not what it happens to start at.
  const requestsAfterLoad = await page
    .getByTestId('request-count')
    .textContent();

  // 2. Interact with the feature. Test ids locate the panel (both columns
  //    render the same control); the accessible name is asserted, because
  //    that is the part the accessibility fix is about.
  const filter = page.getByTestId('after-filter');
  await expect(filter).toHaveAccessibleName('Filter');

  await filter.fill('Item 12');

  // 3. The UI updates: the rows, the counter and the live region agree.
  //    "Item 12" matches 12 and 120-129.
  await expect(page.getByTestId('after-visible')).toHaveText('11');
  await expect(page.getByTestId('after-rows').getByRole('button')).toHaveCount(
    11,
  );
  await expect(page.getByTestId('after-live')).toHaveText(
    '11 of 500 items match “Item 12”',
  );

  // 4. The accessibility fix, exercised through the browser's real focus
  //    model: Tab reaches the clear button, it announces a name, Enter
  //    activates it, and focus lands back on the input even though the button
  //    it came from was removed from the DOM by that same activation.
  const clear = page.getByTestId('after-clear');
  await filter.press('Tab');
  await expect(clear).toBeFocused();
  await expect(clear).toHaveAccessibleName('Clear filter');

  await page.keyboard.press('Enter');

  await expect(filter).toBeFocused();
  await expect(filter).toHaveValue('');
  await expect(clear).toBeHidden();
  await expect(page.getByTestId('after-visible')).toHaveText('500');

  // 5. And the point of the whole demo: none of that hit the network again.
  await expect(page.getByTestId('request-count')).toHaveText(
    requestsAfterLoad ?? '',
  );
});
