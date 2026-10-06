import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedLegacyPlanner } from './story-fixtures';
import { expectNoOverflow as noOverflow, expectPhase, showcase, startStory, openPlanner, openResearch } from './story-helpers';

test('independent practical edits preserve older notes without asking the player to record anything', async ({ page }) => {
  const legacy = await seedLegacyPlanner(page);
  await page.goto('/');
  await startStory(page);
  await openPlanner(page);
  await page.getByRole('button', { name: 'One more person' }).click();
  await expect(page.locator('.party-field output')).toHaveText('3');
  await page.getByLabel('Budget per person').fill('500');
  await page.locator('.option-hk .choose-button').click();
  await expect(page.getByRole('heading', { name: 'Your evening, pencilled in.' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Keep this field note|Saved on this device/ })).toHaveCount(0);
  const savedNote = () => page.evaluate(() => JSON.parse(localStorage.getItem('between-journal-v1')!).notes);
  await expect.poll(savedNote).toBe(legacy.notes);
  await page.reload();
  await startStory(page);
  await openPlanner(page);
  await expect(page.getByLabel('Budget per person')).toHaveValue('500');
  await expect(page.locator('.party-field output')).toHaveText('3');
  await expect.poll(savedNote).toBe(legacy.notes);
  await page.getByRole('button', { name: 'Replay the story', exact: true }).click();
  await page.getByRole('button', { name: 'Keep my evening', exact: true }).click();
  await expect.poll(savedNote).toBe(legacy.notes);
  await page.getByRole('button', { name: 'Replay the story', exact: true }).click();
  await page.getByRole('button', { name: 'Reset and replay', exact: true }).click();
  await expectPhase(page, 'fork');
  await expect.poll(savedNote).toBe('');
});

test('live constraints, costs, return route, allocation and evidence controls', async ({page}) => {
  await page.goto('/');
  await openPlanner(page);
  await expect(page.locator('.option-hk .option-metrics')).toContainText('HK$336');
  await page.getByLabel('Budget per person').fill('100');
  await expect(page.getByRole('heading',{name:'Neither outing fits these constraints'})).toBeVisible();
  await page.getByLabel('Budget per person').fill('500');
  await page.getByText('Travel & cost assumptions',{exact:true}).click();
  await page.getByLabel('Shenzhen route').selectOption('bus');
  await expect(page.locator('.option-sz .option-route')).toContainText('Lok Ma Chau road');
  await page.getByLabel('Leave at').fill('22:00');
  await page.getByLabel('Home by').fill('23:00');
  await expect(page.getByRole('heading',{name:'Neither outing fits these constraints'})).toBeVisible();
  await page.getByLabel('Leave at').fill('16:00');
  await page.getByLabel('Home by').fill('23:30');
  await page.locator('.option-sz .itinerary-detail summary').click();
  await expect(page.locator('.option-sz .itinerary-detail')).toContainText('Road crossing open 24 hours; transport services are not verified.');
  await page.locator('.option-sz .cost-toggle').click();
  await expect(page.locator('.option-sz .cost-breakdown')).toContainText('Shared across 2');
  await openResearch(page);
  await page.getByLabel('Search evidence').fill('nonexistent');
  await expect(page.getByRole('heading',{name:'No matching evidence yet.'})).toBeVisible();
  await page.getByRole('button',{name:'Show all sources'}).click();
  await expect(page.locator('.source-card')).toHaveCount(4);
  await page.getByRole('button',{name:'Business questions'}).click();
  await expect(page.getByRole('heading',{name:'A cheaper dinner isn’t a business model.'})).toBeVisible();
  await page.locator('.surplus-lab > summary').click();
  await page.getByLabel('Hypothetical pool · HKD',{exact:true}).fill('100');
  for (const label of ['Workers','Community','Business reserve']) {const slider = page.getByRole('slider',{name:new RegExp(label)}); await slider.focus(); await slider.press('Home'); await expect(slider).toHaveValue('0'); await slider.press('ArrowRight'); await expect(slider).toHaveValue('1');}
  await expect(page.locator('.allocation-proof')).toContainText('HK$33.34 + HK$33.33 + HK$33.33 = HK$100.00');
  await page.getByRole('button',{name:'Model roadmap'}).click();
  await expect(page.getByRole('heading',{name:'A model should earn your trust.'})).toBeVisible();
  await page.getByRole('button',{name:'The story',exact:true}).click();
  await expectPhase(page, 'fork');
  await expect(page.locator('.play-world')).toBeVisible();
});

for (const width of [360,390,1440]) {
  test(`responsive ${width}px: every view fits and core controls remain accessible`, async ({page}) => {
    await page.setViewportSize({width,height:width === 1440 ? 900 : 844});
    await page.goto('/');
    await noOverflow(page);
    await startStory(page);
    await expect(page.locator('.play-world img')).toBeVisible();
    await showcase(page, `world-${width}`);
    await openPlanner(page);
    await noOverflow(page);
    if (width < 640) {
      await page.getByLabel('Budget per person').fill('100');
      await expect(page.locator('.mobile-live-summary')).toContainText('Over the budget');
      await page.getByLabel('Budget per person').fill('400');
      await expect(page.locator('.mobile-live-summary')).toContainText('Entry not confirmed');
      await expect(page.locator('.trip-strip')).toContainText('/person');
      await expect(page.locator('.trip-strip')).toContainText('home');
      await page.locator('.mobile-live-summary').screenshot({path:`artifacts/mobile-summary-${width}.png`});
    }
    await expect(page.locator('.option-hk .time-axis')).toContainText('Shared scale');
    await expect(page.locator('.option-hk .time-legend')).toContainText('Total outing: 2h 45m');
    await expect(page.locator('.option-sz .time-legend')).toContainText('Total outing: 5h 45m');
    await showcase(page, `explore-${width}`);
    await openResearch(page);
    await noOverflow(page);
    await showcase(page, `evidence-${width}`);
  });
}

test('keyboard dialog focus, reduced motion and media failure fallback', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/art/*.webp',route => route.abort());
  await page.goto('/');
  await startStory(page);
  await expect(page.locator('.play-image-fallback')).toBeVisible();
  await openPlanner(page);
  await page.getByRole('button',{name:'Assumptions & sources'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Assumptions & sources'})).toBeFocused();
  await openPlanner(page);
  await expect(page.locator('.option-card')).toHaveCount(2);
  await expect(page.locator('.option-card .scene-fallback')).toHaveCount(2);
});

test('corrupt browser storage recovers without losing app access', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('between-journal-v1','not valid JSON'));
  await page.goto('/');
  await startStory(page);
  await openPlanner(page);
  await expect(page.locator('.storage-notice')).toHaveText('This saved planner could not be restored. Its original data is untouched. You can plan in this tab, or explicitly reset to replace it.');
  await expect(page.locator('.option-card')).toHaveCount(2);
});

test('no critical or serious accessibility violations in the world, optional planner and research desk', async ({page}) => {
  await page.goto('/');
  for (const view of ['world','explore','desk']) {
    if (view === 'explore') await openPlanner(page);
    if (view === 'desk') await openResearch(page);
    const result = await new AxeBuilder({page}).analyze();
    expect(result.violations.filter(v => ['critical','serious'].includes(v.impact ?? ''))).toEqual([]);
  }
});


test('unavailable localStorage keeps the full decision flow usable', async ({page}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Storage blocked','SecurityError');}});
  });
  await page.goto('/');
  await startStory(page);
  await openPlanner(page);
  await expect(page.locator('.storage-notice')).toContainText('Saving is unavailable');
  await page.locator('.option-hk .choose-button').click();
  await expect(page.getByRole('heading', { name: 'Your evening, pencilled in.' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'Change my plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shape your evening', exact: true })).toBeVisible();
});

test('an invalid intermediate edit does not overwrite a valid saved plan', async ({page}) => {
  await page.goto('/');
  await openPlanner(page);
  await page.getByLabel('Budget per person').fill('500');
  await page.getByText('Travel & cost assumptions',{exact:true}).click();
  await page.getByLabel('Exchange assumption').fill('0');
  await expect(page.getByRole('alert')).toContainText('FX must be greater than 0');
  await page.reload();
  await startStory(page);
  await openPlanner(page);
  await expect(page.getByLabel('Budget per person')).toHaveValue('500');
  await page.getByText('Travel & cost assumptions',{exact:true}).click();
  await expect(page.getByLabel('Exchange assumption')).toHaveValue('1.09');
});

test('adding a companion reopens the group entry check', async ({page}) => {
  await page.goto('/');
  await openPlanner(page);
  const entry = page.getByRole('checkbox',{name:/everyone in this group/});
  await entry.check();
  await expect(entry).toBeChecked();
  await page.getByRole('button',{name:'One more person'}).click();
  await expect(entry).not.toBeChecked();
  await expect(page.locator('.option-sz .option-reasons')).toContainText('Entry eligibility is unconfirmed');
});

test('restored automatic journey assumptions match the selected route and origin', async ({page}) => {
  await page.goto('/');
  await openPlanner(page);
  await page.getByLabel('Starting neighborhood').selectOption('island');
  await page.getByText('Travel & cost assumptions',{exact:true}).click();
  await page.getByLabel('Shenzhen route').selectOption('bus');
  await expect(page.getByLabel('HK local journey each way')).toHaveValue('20');
  await expect(page.getByLabel('SZ local journey each way')).toHaveValue('35');
  await expect(page.getByLabel('Border buffer each way')).toHaveValue('35');
  await page.reload();
  await startStory(page);
  await openPlanner(page);
  await page.getByText('Travel & cost assumptions',{exact:true}).click();
  await expect(page.getByLabel('HK local journey each way')).toHaveValue('20');
  await expect(page.getByLabel('SZ local journey each way')).toHaveValue('35');
  await expect(page.getByLabel('Border buffer each way')).toHaveValue('35');
});

for (const [label, bytes] of [
  ['future version', JSON.stringify({ version: 2, notes: 'Keep this future planner unchanged.' })],
  ['empty string', ''],
] as const) {
  test(`rejected practical ${label} bytes survive ordinary navigation and edits until explicit reset`, async ({ page }) => {
    await page.addInitScript(raw => {
      if (localStorage.getItem('between-journal-v1') === null) localStorage.setItem('between-journal-v1', raw);
    }, bytes);
    const stored = () => page.evaluate(() => localStorage.getItem('between-journal-v1'));
    await page.goto('/');
    await startStory(page);
    expect(await stored()).toBe(bytes);
    await openPlanner(page);
    await expect(page.locator('.storage-notice')).toHaveText('This saved planner could not be restored. Its original data is untouched. You can plan in this tab, or explicitly reset to replace it.');
    await page.getByLabel('Budget per person').fill('500');
    expect(await stored()).toBe(bytes);
    await startStory(page);
    await openPlanner(page);
    await expect(page.getByLabel('Budget per person')).toHaveValue('500');
    expect(await stored()).toBe(bytes);
    await page.getByRole('button', { name: 'Replay the story', exact: true }).click();
    await page.getByRole('button', { name: 'Reset and replay', exact: true }).click();
    await expectPhase(page, 'fork');
    await expect.poll(async () => JSON.parse((await stored())!).version).toBe(1);
  });
}
