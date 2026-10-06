import { test, expect, type Page } from '@playwright/test';
import { createStoryState, storyReducer } from '../../src/story/engine';
import { legacyCompletedStory, seedStory } from './story-fixtures';
import {
  chooseDinner, chooseWalk, cityPreview, closeDialogue, depart, dialogue, expectClock,
  expectNoClippedText, expectNoOverflow, expectPhase, expectTouchTarget, openAction,
  openOptions, readStorySave, showcase, startStory, storyClock,
} from './story-helpers';

const note = (page: Page) => page.locator('.route-note');
const going = (page: Page) => page.getByRole('button', { name: /^Going out/ });
const coming = (page: Page) => page.getByRole('button', { name: /^Coming home/ });
const assumptions = (page: Page) => note(page).getByRole('button', { name: 'Evening assumptions', exact: true });

async function expectCompactForecast(page: Page, condition: string, forecast: string) {
  await expect(note(page).locator('.route-note-condition')).toHaveText(condition);
  await expect(note(page).locator('.route-note-forecast')).toHaveText(forecast);
  const clockRows = await note(page).locator('.route-note-forecast strong').evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element);
    return [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0).map(rect => rect.top);
  });
  expect(clockRows.length).toBeGreaterThan(0);
  expect(Math.max(...clockRows) - Math.min(...clockRows), 'The modeled home clock is one readable token.').toBeLessThanOrEqual(1);
}

async function expectSchematic(page: Page, crossing: string | null) {
  const loop = note(page).getByRole('region', { name: 'Complete round-trip route', exact: true });
  await expect(loop.locator('.route-loop-places > li')).toHaveText(crossing
    ? ['Kowloon / Tsim Sha Tsui', crossing, 'Luohu dinner area']
    : ['Kowloon / Tsim Sha Tsui', 'Hong Kong dinner area']);
  await expect(loop.locator('.route-loop-crossing')).toHaveCount(crossing ? 1 : 0);
  // The crossing must be visible on the common line itself, not merely named in
  // a selected-route heading, screen-reader announcement or unopened detail.
  const geometry = await loop.evaluate(element => {
    const dialog = element.closest('dialog')!.getBoundingClientRect();
    const pieces = [...element.querySelectorAll('.route-loop-places > li, .route-loop-line')];
    return pieces.map(piece => {
      const rect = piece.getBoundingClientRect();
      return { width: rect.width, height: rect.height,
        visible: rect.left >= Math.max(0, dialog.left) - 1 && rect.right <= Math.min(innerWidth, dialog.right) + 1
          && rect.top >= Math.max(0, dialog.top) - 1 && rect.bottom <= Math.min(innerHeight, dialog.bottom) + 1 };
    });
  });
  for (const piece of geometry) {
    expect(piece.width).toBeGreaterThan(0);
    expect(piece.height).toBeGreaterThan(0);
    expect(piece.visible, 'Every named place and the connecting line fit the actual open phone viewport.').toBe(true);
  }
  await expect(loop.locator('.route-loop-outward circle')).toHaveCount(crossing ? 1 : 0);
  await expect(loop.locator('.route-loop-inward circle')).toHaveCount(crossing ? 1 : 0);
}

async function expectDirectionEmphasis(page: Page, inspected: 'outward' | 'inward' | null) {
  const style = await note(page).locator('.route-loop-line').evaluate(element => {
    const read = (selector: string) => {
      const computed = getComputedStyle(element.querySelector(selector)!);
      return { width: Number.parseFloat(computed.strokeWidth), opacity: Number.parseFloat(computed.opacity) };
    };
    return { outward: read('.route-loop-outward'), inward: read('.route-loop-inward') };
  });
  if (inspected) {
    const other = inspected === 'outward' ? 'inward' : 'outward';
    expect(style[inspected].width, 'The inspected direction is actually rendered with stronger emphasis.').toBeGreaterThan(style[other].width);
    expect(style[inspected].opacity).toBeGreaterThan(style[other].opacity);
  } else {
    expect(style.outward.width).toBe(style.inward.width);
    expect(style.outward.opacity).toBe(style.inward.opacity);
  }
}

async function expectRouteReadability(page: Page) {
  await expectNoOverflow(page);
  await expectNoClippedText(dialogue(page));
  for (const button of await note(page).getByRole('button').all()) await expectTouchTarget(button);
  const undersized = await note(page).evaluate(root => [...root.querySelectorAll('p,strong,small,button,label,legend,a')]
    .filter(element => !element.closest('[hidden], .route-note-sr-only') && element.getClientRects().length > 0)
    .filter(element => Number.parseFloat(getComputedStyle(element).fontSize) < 12)
    .map(element => element.textContent));
  expect(undersized, 'Visible route copy must remain readable rather than shrink to hide overflow.').toEqual([]);
  for (const money of await note(page).locator('.route-money').all()) {
    const rows = await money.evaluate(element => {
      const range = document.createRange(); range.selectNodeContents(element);
      return [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0).map(rect => rect.top);
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(Math.max(...rows) - Math.min(...rows), 'Route currency tokens stay on one rendered line.').toBeLessThanOrEqual(1);
  }
}

async function expectOneDetail(page: Page, heading: string) {
  await expect(note(page).locator('[aria-expanded="true"]')).toHaveCount(1);
  await expect(note(page).locator('.route-note-detail:visible')).toHaveCount(1);
  await expect(note(page).locator('.route-note-detail h3')).toHaveText(heading);
  await expectRouteReadability(page);
}

async function captureMap(page: Page, filename: string, detail = false) {
  if (detail) await note(page).locator('.route-note-detail h3').scrollIntoViewIfNeeded();
  else await dialogue(page).getByRole('heading', { name: 'Out and home', exact: true }).scrollIntoViewIfNeeded();
  await showcase(page, filename);
}

for (const width of [360, 390]) {
  test(`route note ${width}px: real radio previews, complete two-way legs and exclusive details stay free`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await startStory(page);
    await cityPreview(page, 'Shenzhen').click();
    await openAction(page, 'Talk about dinner');
    await expect(page.locator('.departure-forecast')).toContainText('modeled home 22:15');
    await expect(page.locator('.departure-forecast')).toContainText('disclosed 30-minute dinner delay');
    const unfold = page.getByRole('button', { name: 'Unfold the route', exact: true });
    await unfold.click();
    await expect(dialogue(page).getByRole('heading', { name: 'Out and home', exact: true })).toBeFocused();
    await expect(page.getByRole('region', { name: 'Complete round-trip route', exact: true })).toHaveCount(1);
    await expect(note(page)).toHaveAttribute('data-route', 'rail');
    await expect(going(page)).toContainText('1h 45m');
    await expect(going(page)).toContainText('16:30–18:15');
    await expect(coming(page)).toContainText('1h 45m');
    await expect(coming(page)).toContainText('20:30–22:15');
    await expect(going(page)).toContainText('projected');
    await expect(coming(page)).toContainText('projected');
    await expectCompactForecast(page, 'Conditional plan', 'modeled home 22:15 · 1h 15m spare');
    await expect(assumptions(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(note(page).locator('.route-note-detail')).toBeHidden();
    await expectSchematic(page, 'Lo Wu rail crossing');
    await expectDirectionEmphasis(page, null);
    await expect(storyClock(page)).toHaveText('16:30');
    const beforeFolds = await readStorySave(page);
    await expectRouteReadability(page);
    await captureMap(page, `route-rail-compact-${width}`);

    // The approved compact presentation moves the full forecast explanation
    // into a real disclosure. Keep every meal/walk/delay/deadline assertion on
    // its visible content, rather than accepting the hidden live announcement.
    await assumptions(page).click();
    await expectOneDetail(page, 'Evening assumptions');
    await expect(note(page).locator('.route-note-detail')).toContainText('60-minute simple dinner · assumed, still to choose');
    await expect(note(page).locator('.route-note-detail')).toContainText('45-minute walk · assumed, still to choose');
    await expect(note(page).locator('.route-note-detail')).toContainText('Includes the disclosed 30-minute dinner delay.');
    await expect(note(page).locator('.route-note-deadline')).toHaveText('1h 15m before the chosen 23:30 home deadline.');
    await expect(note(page).locator('.route-note-detail')).toContainText('Dinner ends 19:45 · leave area 20:30.');
    await captureMap(page, `route-rail-assumptions-${width}`, true);
    expect(await readStorySave(page)).toEqual(beforeFolds);
    await assumptions(page).click();
    await expect(assumptions(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(note(page).locator('.route-note-detail')).toBeHidden();
    expect(await readStorySave(page)).toEqual(beforeFolds);

    await going(page).click();
    await expectOneDetail(page, 'Going out · leg details');
    await expectDirectionEmphasis(page, 'outward');
    await expect(note(page).locator('.route-note-legs li')).toHaveCount(3);
    await expect(note(page).locator('.route-note-legs li > span')).toHaveText(['16:30–17:20 · 50m', '17:20–17:50 · 30m', '17:50–18:15 · 25m']);
    await expect(note(page).locator('.route-note-legs')).toContainText('outward clearance allowance');
    await captureMap(page, `route-rail-outward-${width}`, true);
    await coming(page).click();
    await expectOneDetail(page, 'Coming home · leg details');
    await expectDirectionEmphasis(page, 'inward');
    await expect(note(page).locator('.route-note-legs li > span')).toHaveText(['20:30–20:55 · 25m', '20:55–21:25 · 30m', '21:25–22:15 · 50m']);
    await expect(note(page).locator('.route-note-legs')).toContainText('return clearance allowance');
    await captureMap(page, `route-rail-return-${width}`, true);
    await page.getByRole('button', { name: 'Whole-outing cost detail', exact: true }).click();
    await expectOneDetail(page, 'Whole-outing cost');
    await expectDirectionEmphasis(page, null);
    await expect(note(page).locator('.route-note-total')).toHaveText('Whole outing: HK$260.22 each / HK$520.44 for two.');
    await expect(note(page).locator('.route-note-detail')).toContainText('60-minute simple dinner · assumed, still to choose');
    await expect(note(page).locator('.route-note-detail')).toContainText('45-minute walk · assumed, still to choose');
    await expect(note(page).locator('.route-note-detail')).toContainText('disclosed 30-minute dinner delay');
    await captureMap(page, `route-rail-cost-${width}`, true);
    await page.getByRole('button', { name: 'Hours and sources', exact: true }).click();
    await expectOneDetail(page, 'Published crossing hours');
    await expect(note(page).locator('.route-note-detail')).toContainText('06:30–00:00');
    await expect(note(page).locator('.route-note-detail')).toContainText('not a last-train or service guarantee');
    await expect(note(page).getByRole('link')).toHaveAttribute('href', /^https:\/\/www\.immd\.gov\.hk\//);
    await captureMap(page, `route-rail-hours-${width}`, true);
    expect(await readStorySave(page)).toEqual(beforeFolds);

    await page.getByRole('button', { name: 'Change route', exact: true }).click();
    const rail = page.getByRole('radio', { name: 'Rail via Lo Wu', exact: true });
    const road = page.getByRole('radio', { name: 'Bus via Lok Ma Chau road crossing', exact: true });
    await expect(rail).toBeChecked();
    for (const label of await note(page).locator('.route-note-choices label').all()) await expectTouchTarget(label);
    await road.check();
    await expect(road).toBeChecked();
    await expect(note(page)).toHaveAttribute('data-route', 'bus');
    await expect(note(page).locator('.route-note-detail')).toBeHidden();
    await expect(note(page).locator('.route-note-tradeoff')).toContainText('1h more round-trip travel; HK$66.36 more per person');
    await expect(going(page)).toContainText('16:30–18:45');
    await expect(coming(page)).toContainText('21:00–23:15');
    await expect(coming(page)).toContainText('2h 15m');
    await expectCompactForecast(page, 'Conditional plan', 'modeled home 23:15 · 15m spare');
    await expect(storyClock(page)).toHaveText('16:30');
    expect(await readStorySave(page)).toEqual({ ...beforeFolds, currentAttempt: { ...beforeFolds.currentAttempt, route: 'bus' } });
    await page.getByRole('button', { name: 'Change route', exact: true }).click();
    await captureMap(page, `route-road-compact-${width}`);
    await expectSchematic(page, 'Lok Ma Chau road crossing');
    await expectDirectionEmphasis(page, null);
    const roadPreview = await readStorySave(page);
    await assumptions(page).click();
    await expectOneDetail(page, 'Evening assumptions');
    await expect(note(page).locator('.route-note-detail')).toContainText('60-minute simple dinner · assumed, still to choose');
    await expect(note(page).locator('.route-note-detail')).toContainText('45-minute walk · assumed, still to choose');
    await expect(note(page).locator('.route-note-detail')).toContainText('Includes the disclosed 30-minute dinner delay.');
    await expect(note(page).locator('.route-note-deadline')).toHaveText('15m before the chosen 23:30 home deadline.');
    await expect(note(page).locator('.route-note-detail')).toContainText('Dinner ends 20:15 · leave area 21:00.');
    await captureMap(page, `route-road-assumptions-${width}`, true);
    await going(page).click();
    await expectDirectionEmphasis(page, 'outward');
    await expect(note(page).locator('.route-note-legs li > span')).toHaveText(['16:30–17:35 · 1h 5m', '17:35–18:10 · 35m', '18:10–18:45 · 35m']);
    await coming(page).click();
    await expectDirectionEmphasis(page, 'inward');
    await expect(note(page).locator('.route-note-legs li > span')).toHaveText(['21:00–21:35 · 35m', '21:35–22:10 · 35m', '22:10–23:15 · 1h 5m']);
    expect(await readStorySave(page)).toEqual(roadPreview);
    await page.getByRole('button', { name: 'Hours and sources', exact: true }).click();
    await expect(note(page).locator('.route-note-detail')).toContainText('24 hours');
    await expect(note(page).locator('.route-note-detail')).toContainText('does not guarantee a bus');
    await page.getByRole('button', { name: 'Back to Jun', exact: true }).click();
    await expect(unfold).toBeFocused();
    await expect(page.locator('.departure-forecast')).toContainText('modeled home 23:15');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Talk about dinner', exact: true })).toBeFocused();
    await openAction(page, 'Open phone');
    await page.getByRole('button', { name: 'Put the phone away', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open phone', exact: true })).toBeFocused();
    await openAction(page, 'Open phone');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Open phone', exact: true })).toBeFocused();
  });
}

test('local route forecast includes the disclosed delay without inventing a crossing or advancing time', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await startStory(page);
  await cityPreview(page, 'Hong Kong').click();
  await openAction(page, 'Talk about dinner');
  await expect(page.locator('.departure-forecast')).toContainText('modeled home 19:15');
  await page.getByRole('button', { name: 'Unfold the route', exact: true }).click();
  const before = await readStorySave(page);
  await expectCompactForecast(page, 'Conditional plan', 'modeled home 19:15 · 4h 15m spare');
  await expectSchematic(page, null);
  await expectDirectionEmphasis(page, null);
  await expect(note(page).locator('.route-loop')).not.toContainText(/Lo Wu|Lok Ma Chau/);
  await captureMap(page, 'route-local-compact-390');
  await assumptions(page).click();
  await expectOneDetail(page, 'Evening assumptions');
  await expect(note(page).locator('.route-note-detail')).toContainText('60-minute simple dinner · assumed, still to choose');
  await expect(note(page).locator('.route-note-detail')).toContainText('45-minute walk · assumed, still to choose');
  await expect(note(page).locator('.route-note-detail')).toContainText('Includes the disclosed 30-minute dinner delay.');
  await expect(note(page).locator('.route-note-deadline')).toHaveText('4h 15m before the chosen 23:30 home deadline.');
  await expect(note(page).locator('.route-note-detail')).toContainText('Dinner ends 18:15 · leave area 19:00.');
  await captureMap(page, 'route-local-assumptions-390', true);
  await expect(going(page)).toContainText('16:30–16:45');
  await expect(coming(page)).toContainText('19:00–19:15');
  await expect(note(page).getByRole('radio')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Change route', exact: true })).toHaveCount(0);
  await going(page).click();
  await expectDirectionEmphasis(page, 'outward');
  await expect(note(page).locator('.route-note-legs li')).toHaveCount(1);
  await expect(note(page).locator('.route-note-legs')).toContainText('Local outward journey');
  await coming(page).click();
  await expectDirectionEmphasis(page, 'inward');
  await expect(note(page).locator('.route-note-legs li')).toHaveCount(1);
  await expect(note(page).locator('.route-note-legs')).toContainText('Local return journey');
  await page.getByRole('button', { name: 'Whole-outing cost detail', exact: true }).click();
  await expect(note(page).locator('.route-note-total')).toHaveText('Whole outing: HK$304.00 each / HK$608.00 for two.');
  await expect(storyClock(page)).toHaveText('16:30');
  expect(await readStorySave(page)).toEqual(before);
  await captureMap(page, 'route-local-cost-390', true);
});

test('committed routes are read-only and the return-first note follows actual journey completion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await startStory(page); await depart(page, 'Shenzhen');
  await openAction(page, 'Open phone');
  await expect(note(page)).toContainText('Chosen route · read-only');
  await expect(note(page).getByRole('radio')).toHaveCount(0);
  await expect(going(page)).toContainText('completed');
  await expect(coming(page)).toContainText('projected');
  await expectCompactForecast(page, 'Conditional plan', 'modeled home 22:15 · 1h 15m spare');
  await expect(storyClock(page)).toHaveText('18:15');
  await closeDialogue(page); await chooseDinner(page, 'simple'); await chooseWalk(page, 'short');
  await openAction(page, 'Head home');
  const check = page.getByRole('button', { name: 'Check the return route', exact: true });
  await check.click();
  const before = await readStorySave(page);
  await expect(note(page).locator('.route-loop-directions > button').first()).toHaveAccessibleName(/^Coming home/);
  await expect(coming(page)).toContainText('20:00–21:45');
  await expectCompactForecast(page, 'Chosen evening · modeled', 'modeled home 21:45 · 1h 45m spare');
  await expectDirectionEmphasis(page, 'inward');
  await assumptions(page).click();
  await expectOneDetail(page, 'Evening assumptions');
  await expect(note(page).locator('.route-note-detail')).toContainText('60-minute simple dinner · completed');
  await expect(note(page).locator('.route-note-detail')).toContainText('15-minute walk · completed');
  await expect(note(page).locator('.route-note-detail')).toContainText('Includes the applied 30-minute dinner delay.');
  await coming(page).click();
  await expect(note(page).locator('.route-note-legs li')).toHaveCount(3);
  await captureMap(page, 'route-return-plan-390', true);
  await page.getByRole('button', { name: 'Back to Jun', exact: true }).click();
  await expect(check).toBeFocused();
  expect(await readStorySave(page)).toEqual(before);
  await page.getByRole('button', { name: 'Follow the return journey', exact: true }).click();
  await expectClock(page, '21:45');
  await openAction(page, 'Open phone');
  await page.getByRole('button', { name: 'Check the journey', exact: true }).click();
  await expect(going(page)).toContainText('completed');
  await expect(coming(page)).toContainText('completed');
  await expectCompactForecast(page, 'Completed in this model', 'Home 21:45 · 1h 45m spare');
  await assumptions(page).click();
  await expectOneDetail(page, 'Evening assumptions');
  await expect(note(page).locator('.route-note-detail')).toContainText('15-minute walk · completed');
  await expect(note(page).locator('.route-note-detail')).toContainText('Includes the applied 30-minute dinner delay.');
  await page.getByRole('button', { name: 'Reconsider departure', exact: true }).click();
  await expectPhase(page, 'fork');
  await expect(storyClock(page)).toHaveText('16:30');
  await page.getByRole('button', { name: 'Change route', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Rail via Lo Wu', exact: true })).toBeVisible();
});

test('direct-return route preview shows no invented walk and remains free before its explicit commitment', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedStory(page, createStoryState('short', { delayScenario: 'none' }));
  await page.goto('/'); await startStory(page); await depart(page, 'Shenzhen'); await chooseDinner(page, 'simple');
  const before = await readStorySave(page);
  const check = page.getByRole('button', { name: 'Check direct return route', exact: true });
  await check.click();
  await expect(note(page)).toHaveAttribute('data-return-intent', 'direct');
  await expect(note(page).locator('.route-loop-directions > button').first()).toHaveAccessibleName(/^Coming home/);
  await expect(coming(page)).toContainText('19:45–21:30');
  await expectCompactForecast(page, 'Conditional · return now, no walk', 'modeled home 21:30 · past deadline');
  await expectDirectionEmphasis(page, 'inward');
  await expect(note(page).locator('.route-note-warnings')).toContainText('1h 30m after the chosen 20:00 home deadline');
  await expect(storyClock(page)).toHaveText('19:45');
  await assumptions(page).click();
  await expectOneDetail(page, 'Evening assumptions');
  await expect(note(page).locator('.route-note-detail')).toContainText('No walk · if we return now');
  await expect(note(page).locator('.route-note-detail')).toContainText('Calm version: no fictional dinner delay.');
  await expect(note(page).locator('.route-note-deadline')).toHaveText('1h 30m after the chosen 20:00 home deadline.');
  await page.getByRole('button', { name: 'Whole-outing cost detail', exact: true }).click();
  await expect(note(page).locator('.route-note-detail')).toContainText('No walk · if we return now');
  await expect(note(page).locator('.route-note-total')).toHaveText('Whole outing: HK$260.22 each / HK$520.44 for two.');
  await captureMap(page, 'route-direct-return-390', true);
  await page.getByRole('button', { name: 'Back to Jun', exact: true }).click();
  await expect(check).toBeFocused();
  expect(await readStorySave(page)).toEqual(before);
  await page.getByRole('button', { name: /^Let’s head home now\./ }).click();
  await expectClock(page, '21:30');
  await openAction(page, 'Open phone');
  await page.getByRole('button', { name: 'Check the journey', exact: true }).click();
  await expectCompactForecast(page, 'Completed in this model', 'Home 21:30 · past deadline');
  await assumptions(page).click();
  await expectOneDetail(page, 'Evening assumptions');
  await expect(note(page).locator('.route-note-detail')).toContainText('No walk · chosen direct return');
  await expect(note(page).locator('.route-note-detail')).not.toContainText('walk · completed');
});

test('phone reconsideration uses the existing legacy-detail confirmation rather than silently clearing it', async ({ page }) => {
  const saved = legacyCompletedStory({ city: 'sz', note: 'Keep this older route detail until a confirmed rewind.' });
  await seedStory(page, saved);
  await page.goto('/'); await startStory(page); await openAction(page, 'Open phone');
  await page.getByRole('button', { name: 'Check the journey', exact: true }).click();
  await page.getByRole('button', { name: 'Reconsider departure', exact: true }).click();
  await expect(dialogue(page).getByRole('heading', { name: 'Clear an older saved detail?', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Keep this evening', exact: true }).click();
  await expect(dialogue(page).getByRole('heading', { name: 'Out and home', exact: true })).toBeVisible();
  expect(await readStorySave(page)).toEqual(saved);
  await page.getByRole('button', { name: 'Reconsider departure', exact: true }).click();
  await page.getByRole('button', { name: 'Clear older detail and continue', exact: true }).click();
  await expectPhase(page, 'fork');
  expect((await readStorySave(page)).currentAttempt.journalNote).toBe('');
});

test('200% equivalent long-dialogue entry resets map scroll and Back restores its invoking control', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 450 });
  let state = createStoryState('short', { baseInputs: { departureMinutes: 21 * 60, homeByMinutes: 22 * 60, budgetPerPersonHKD: 100 } });
  state = storyReducer(state, { type: 'PREVIEW_CITY', city: 'sz' });
  await seedStory(page, state);
  await page.goto('/'); await startStory(page); await openAction(page, 'Talk about dinner');
  const unfold = page.getByRole('button', { name: 'Unfold the route', exact: true });
  await unfold.scrollIntoViewIfNeeded();
  expect(await dialogue(page).evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await unfold.click();
  await expect(dialogue(page).getByRole('heading', { name: 'Out and home', exact: true })).toBeFocused();
  await expect.poll(() => dialogue(page).evaluate(element => element.scrollTop)).toBe(0);
  await expect(dialogue(page).getByRole('heading', { name: 'Out and home', exact: true })).toBeInViewport();
  await expectRouteReadability(page);
  await captureMap(page, 'route-map-entry-200-percent');
  await page.getByRole('button', { name: 'Back to Jun', exact: true }).click();
  await expect(unfold).toBeFocused();
  await expect(unfold).toBeInViewport();
  expect(await readStorySave(page)).toEqual(state);
});

test('Wallet and phone use the same disclosed-delay deadline forecast after genuine short-evening setup', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await startStory(page); await openOptions(page);
  await page.locator('.story-setup > summary').click();
  await page.getByRole('button', { name: /^A short evening/ }).click();
  await expect(page.getByRole('checkbox', { name: 'Include one fictional 30-minute dinner delay', exact: true })).toBeChecked();
  await closeDialogue(page); await cityPreview(page, 'Shenzhen').click();
  await openAction(page, 'Open wallet');
  await expect(dialogue(page)).toContainText('HK$260.22');
  await expect(dialogue(page).locator('.commit-caveats')).toContainText('165 minutes beyond the home deadline');
  await expect(dialogue(page).locator('.commit-caveats')).not.toContainText('135 minutes');
  await showcase(page, 'wallet-short-delayed-forecast-390');
  await closeDialogue(page); await openAction(page, 'Open phone');
  await expectCompactForecast(page, 'Conditional plan', 'modeled home 22:45 · past deadline');
  await expect(note(page).locator('.route-note-warnings')).toContainText('2h 45m after the chosen 20:00 home deadline');
  await expect(note(page).locator('.route-note-warnings')).toBeVisible();
  await expect(storyClock(page)).toHaveText('17:00');
  await captureMap(page, 'route-short-delayed-forecast-390');
  const before = await readStorySave(page);
  await assumptions(page).click();
  await expectOneDetail(page, 'Evening assumptions');
  await expect(note(page).locator('.route-note-detail')).toContainText('Includes the disclosed 30-minute dinner delay.');
  await expect(note(page).locator('.route-note-deadline')).toHaveText('2h 45m after the chosen 20:00 home deadline.');
  expect(await readStorySave(page)).toEqual(before);
});

test('route radios support keyboard activation, arrow selection and Back without advancing time or losing focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const initial = storyReducer(createStoryState(), { type: 'PREVIEW_CITY', city: 'sz' });
  await seedStory(page, initial);
  await page.goto('/');
  await expectPhase(page, 'fork');
  await expect(page.locator('.world-dialogue')).not.toBeVisible();
  // The fixture only positions the player at a free city preview. Every route
  // interaction below uses the keyboard, with no click(), check() or focus().
  const tabTo = async (target: ReturnType<Page['getByRole']>) => {
    for (let count = 0; count < 40 && !(await target.evaluate(element => element === document.activeElement)); count += 1) {
      await page.keyboard.press('Tab');
    }
    await expect(target).toBeFocused();
    await expect(target).toBeInViewport();
  };
  const talk = page.getByRole('button', { name: 'Talk about dinner', exact: true });
  await tabTo(talk);
  await page.keyboard.press('Enter');
  const change = page.getByRole('button', { name: 'Change route', exact: true });
  await tabTo(change);
  await page.keyboard.press('Space');
  await expect(dialogue(page).getByRole('heading', { name: 'Out and home', exact: true })).toBeFocused();
  const rail = page.getByRole('radio', { name: 'Rail via Lo Wu', exact: true });
  const road = page.getByRole('radio', { name: 'Bus via Lok Ma Chau road crossing', exact: true });
  await tabTo(rail);
  await expect(rail).toBeChecked();
  await page.keyboard.press('ArrowDown');
  await expect(road).toBeFocused();
  await expect(road).toBeInViewport();
  await expect(road).toBeChecked();
  await expect(note(page).locator('.route-note-forecast')).toContainText('modeled home 23:15');
  await expect(storyClock(page)).toHaveText('16:30');
  await page.keyboard.press('ArrowUp');
  await expect(rail).toBeFocused();
  await expect(rail).toBeChecked();
  await expect(note(page).locator('.route-note-forecast')).toContainText('modeled home 22:15');
  await page.keyboard.press('ArrowRight');
  await expect(road).toBeFocused();
  await expect(road).toBeChecked();
  await page.keyboard.press('Space');
  await expect(road).toBeFocused();
  await expect(road).toBeInViewport();
  await expect(road).toBeChecked();
  await tabTo(page.getByRole('button', { name: 'Back to Jun', exact: true }));
  await page.keyboard.press('Enter');
  await expect(change).toBeFocused();
  await expect(change).toBeInViewport();
  await expect(page.locator('.departure-forecast')).toContainText('modeled home 23:15');
  await expect(storyClock(page)).toHaveText('16:30');
  expect(await readStorySave(page)).toEqual({ ...initial, currentAttempt: { ...initial.currentAttempt, route: 'bus' } });
  await page.keyboard.press('Escape');
  await expect(talk).toBeFocused();
  await expect(talk).toBeInViewport();
});
