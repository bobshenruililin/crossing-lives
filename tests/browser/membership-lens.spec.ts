import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { legacyCompletedStory, seedLegacyPlanner, seedStory } from './story-fixtures';
import {
  closeDialogue, dialogue, expectHomeScene, expectNoClippedText, expectNoOverflow,
  expectTouchTarget, openAction, readStorySave, startStory, storyClock,
} from './story-helpers';

const urls = {
  homeAbout: 'https://www.homemarket.hk/en/about_us.php',
  homeMembership: 'https://www.homemarket.hk/en/become_member.php',
  cheeseAbout: 'https://cheeseboardcollective.coop/about-us/about-main/',
  cheeseHiring: 'https://cheeseboardcollective.coop/wp-content/uploads/2022/09/Collective-Hiring-Notice-202200930.pdf',
};
const lens = (page: Page) => page.locator('.membership-lens');
const rawBytes = (page: Page) => page.evaluate(() => {
  const entries = (storage: Storage) => Object.keys(storage).sort().map(key => [key, storage.getItem(key)]);
  return { local: entries(localStorage), session: entries(sessionStorage) };
});

async function expectActiveQuestion(page: Page, question: string, beforeAdapting: string) {
  await expect(lens(page).locator('.membership-reading')).toHaveCount(1);
  await expect(lens(page).locator('.membership-reading > h3')).toHaveText(question);
  await expect(lens(page).locator('.membership-reading-row')).toHaveCount(2);
  await expect(lens(page).locator('.membership-reading-row > h4')).toHaveText(['Home Market · Hong Kong', 'The Cheese Board Collective · Berkeley']);
  for (const text of await lens(page).locator('.membership-reading-row p').all()) await expect(text).toBeVisible();
  await expect(lens(page).locator('.membership-question')).toHaveCount(1);
  await expect(lens(page).locator('.membership-question')).toContainText(beforeAdapting);
  await expect(lens(page).locator('.membership-boundary')).toHaveText('Two organizations, different settings. These sources document rights, not comparative financial outcomes. Neither describes tonight’s fictional businesses.');
  await expect(lens(page).locator('input[type="radio"]:checked')).toHaveCount(1);
  await expectNoClippedText(lens(page));
  await expectNoOverflow(page);
  const undersized = await lens(page).locator('p,h4,legend,label,a,summary').evaluateAll(elements => elements
    .filter(element => element.getClientRects().length > 0)
    .filter(element => Number.parseFloat(getComputedStyle(element).fontSize) < 14)
    .map(element => element.textContent));
  expect(undersized, 'Visible evidence, dates and uncertainty remain at least 14px.').toEqual([]);
  for (const control of await lens(page).locator('summary:visible, label:visible, a:visible').all()) await expectTouchTarget(control);
}

async function expectAdjacentLinks(page: Page, surplus: boolean) {
  const rows = lens(page).locator('.membership-reading-row');
  await expect(rows.nth(0).locator('.membership-source-links a')).toHaveCount(2);
  await expect(rows.nth(0).locator('.membership-source-links a').nth(0)).toHaveAttribute('href', urls.homeAbout);
  await expect(rows.nth(0).locator('.membership-source-links a').nth(1)).toHaveAttribute('href', urls.homeMembership);
  const cheese = rows.nth(1).locator('.membership-source-links a');
  await expect(cheese).toHaveCount(surplus ? 1 : 2);
  if (!surplus) await expect(cheese.first()).toHaveAttribute('href', urls.cheeseAbout);
  await expect(cheese.last()).toHaveAttribute('href', urls.cheeseHiring);
  for (const link of await rows.getByRole('link').all()) {
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noreferrer/);
  }
}

async function expectIndependentPool(page: Page) {
  const pool = page.locator('.surplus-lab');
  if (!(await pool.evaluate((element: HTMLDetailsElement) => element.open))) await pool.locator(':scope > summary').click();
  await expect(page.getByLabel('Hypothetical pool · HKD', { exact: true })).toHaveValue('120');
  for (const [label, value] of [['Workers', '50'], ['Community', '20'], ['Business reserve', '30']] as const) {
    await expect(page.getByRole('slider', { name: new RegExp(label) })).toHaveValue(value);
  }
  await expect(page.locator('.allocation-proof')).toContainText('HK$60.00 + HK$24.00 + HK$36.00 = HK$120.00');
  await pool.locator(':scope > summary').click();
}

for (const width of [360, 390]) {
  test(`membership evidence ${width}px: native topic choices expose limits without altering the evening or fixed pool`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 844 });
    const city = width === 360 ? 'sz' : 'hk';
    const saved = legacyCompletedStory({ city, note: 'Mock private story note must not enter the rights lens.' });
    const practical = await seedLegacyPlanner(page, 'Mock separate practical note must not enter the rights lens.');
    await seedStory(page, saved);
    await page.goto('/'); await startStory(page); await openAction(page, 'Open wallet');
    const before = await rawBytes(page);
    await page.getByRole('button', { name: 'Who benefits from this spending?', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'What does tonight’s spending tell us about who gained?', exact: true })).toBeFocused();
    await expect(lens(page)).toHaveJSProperty('open', false);
    await expect(lens(page).locator('.membership-body')).toBeHidden();
    const summary = lens(page).locator(':scope > summary');
    // Judge the untouched landing before opening the pool or scrolling. The
    // optional evidence entry belongs beside the spending context it explains.
    await page.evaluate(async () => { await document.fonts.ready; });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(summary).toBeInViewport({ ratio: 1 });
    const order = await lens(page).evaluate(element => {
      const scaffold = document.querySelector('.business-grid')!;
      return {
        followsInDocument: Boolean(element.compareDocumentPosition(scaffold) & Node.DOCUMENT_POSITION_FOLLOWING),
        precedesVisually: element.getBoundingClientRect().bottom <= scaffold.getBoundingClientRect().top + 1,
      };
    });
    expect(order.followsInDocument, 'The membership entry precedes the generic business scaffold.').toBe(true);
    expect(order.precedesVisually).toBe(true);
    await expectIndependentPool(page);
    const poolSummary = page.locator('.surplus-lab > summary');
    const poolInput = page.getByLabel('Hypothetical pool · HKD', { exact: true });
    const workerWeight = page.getByRole('slider', { name: /^Workers/ });
    const readPool = async () => ({
      pool: await poolInput.inputValue(),
      worker: await workerWeight.inputValue(),
      community: await page.getByRole('slider', { name: /^Community/ }).inputValue(),
      business: await page.getByRole('slider', { name: /^Business reserve/ }).inputValue(),
      proof: await page.locator('.allocation-proof').innerText(),
    });
    let editedPool: Awaited<ReturnType<typeof readPool>> | undefined;
    if (width === 390) {
      await poolSummary.click();
      await poolInput.fill('180');
      await workerWeight.press('ArrowRight');
      await expect(workerWeight).toHaveValue('51');
      await expect(page.locator('.allocation-proof')).toContainText('HK$90.89 + HK$35.64 + HK$53.47 = HK$180.00');
      editedPool = await readPool();
      await poolSummary.click();
    }
    // Use the real document tab order to reach and open the native disclosure.
    for (let count = 0; count < 45 && !(await summary.evaluate(element => element === document.activeElement)); count += 1) await page.keyboard.press('Shift+Tab');
    await expect(summary).toBeFocused();
    await page.keyboard.press('Space');
    await expect(lens(page)).toHaveJSProperty('open', true);
    const group = lens(page).getByRole('group', { name: 'Choose a membership question', exact: true });
    const customer = group.getByRole('radio', { name: 'Customer access', exact: true });
    const worker = group.getByRole('radio', { name: 'Worker decisions', exact: true });
    const surplus = group.getByRole('radio', { name: 'Surplus', exact: true });
    await expect(customer).toBeChecked();
    await expectActiveQuestion(page, 'What benefit does a customer receive?', 'What funds the price benefit, and how durable is that funding?');
    await page.keyboard.press('Tab');
    await expect(customer).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(worker).toBeFocused(); await expect(worker).toBeChecked();
    await expect(worker).toBeInViewport();
    await expectActiveQuestion(page, 'What decision rights do workers have?', 'Who can approve a major change, and who is still outside membership?');
    const home = lens(page).locator('.membership-reading-row').nth(0);
    const cheese = lens(page).locator('.membership-reading-row').nth(1);
    const sources = lens(page).locator('.membership-sources');
    await expect(sources).toHaveJSProperty('open', false);
    await expect(home.locator('.membership-limit')).toHaveText('Evidence limit: Undisclosed here does not mean workers have no voice.');
    await expect(cheese.locator('.membership-answer')).toContainText('equal worker ownership and control');
    await expect(cheese.locator('.membership-status')).toContainText('historical 2022');
    await expect(cheese.locator('.membership-limit')).toBeVisible();
    await expect(cheese.locator('.membership-limit')).toContainText('six-month candidacy, not automatic membership');
    await expect(cheese.locator('.membership-limit')).toContainText('Candidates’ exact rights and current admission or meeting rules were not verified.');
    await expect(cheese.locator('.membership-citation')).toContainText('historical 2022 hiring notice, p. 1');
    await expectAdjacentLinks(page, false);
    await page.evaluate(async () => { await document.fonts.ready; });
    await lens(page).screenshot({ path: `artifacts/membership-worker-${width}.png`, animations: 'disabled' });
    if (width === 390) {
      const result = await new AxeBuilder({ page }).include('.membership-lens').analyze();
      expect(result.violations.filter(violation => ['critical', 'serious'].includes(violation.impact ?? ''))).toEqual([]);
    }
    // Screenshot/axe inspection does not change the real radio's keyboard focus.
    await expect(worker).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(surplus).toBeFocused(); await expect(surplus).toBeChecked();
    await expect(surplus).toBeInViewport();
    await expectActiveQuestion(page, 'Who has a documented claim on surplus?', 'What remains after costs and reserves, and who decides its use?');
    await expect(sources).toHaveJSProperty('open', false);
    await expect(home.locator('.membership-answer')).toContainText('Member price benefits do not establish a claim on business surplus.');
    await expect(home.locator('.membership-limit')).toContainText('audited finances were not verified');
    await expect(cheese.locator('.membership-status')).toHaveText('Historical 2022 detail');
    await expect(cheese.locator('.membership-answer')).toHaveText('A 2022 hiring notice described worker-owner profit shares based on hours worked.');
    await expect(cheese.locator('.membership-limit')).toBeVisible();
    await expect(cheese.locator('.membership-limit')).toContainText('Amounts, retained reserves, current terms and audited finances were not verified.');
    await expect(cheese.locator('.membership-citation')).toContainText('p. 2 · historical 2022 detail');
    await expectAdjacentLinks(page, true);
    await lens(page).screenshot({ path: `artifacts/membership-surplus-${width}.png`, animations: 'disabled' });
    await sources.locator(':scope > summary').click();
    await expect(sources).toHaveJSProperty('open', true);
    await expect(sources.locator(':scope > p')).toContainText('current terms were not verified');
    await expect(sources.locator(':scope > p')).toContainText('official indexed text because direct access failed');
    for (const [title, href] of [
      ['Home Market: About Us', urls.homeAbout], ['Home Market: How to Join', urls.homeMembership],
      ['The Cheese Board Collective: About Us', urls.cheeseAbout], ['The Cheese Board Collective: 2022 hiring notice', urls.cheeseHiring],
    ]) await expect(sources.getByRole('link', { name: title, exact: true })).toHaveAttribute('href', href);
    await expect(sources).toContainText('Direct open timed out. Official-domain indexed page text');
    await expect(sources).toContainText('Direct PDF open failed. Official-domain indexed PDF text');
    await expect(sources).toContainText('internal application deadline 24 October 2022; exact publication day unknown');
    await expect(sources).toContainText('inconsistent search publication metadata was not used');
    await expectActiveQuestion(page, 'Who has a documented claim on surplus?', 'What remains after costs and reserves, and who decides its use?');
    await expect(lens(page)).not.toContainText(/HK\$|CNY|allocation rate|profit margin.*%/i);
    await expect(lens(page)).not.toContainText(saved.currentAttempt.journalNote);
    await expect(lens(page)).not.toContainText(practical.notes);
    if (editedPool) {
      // Topic switches and source reading must preserve user edits too. A reset
      // back to initial values would have passed the default-only check.
      await poolSummary.click();
      expect(await readPool()).toEqual(editedPool);
      await poolInput.fill('120');
      await workerWeight.press('ArrowLeft');
      await expect(workerWeight).toHaveValue('50');
      await poolSummary.click();
    }
    await expectIndependentPool(page);
    expect(await rawBytes(page)).toEqual(before);
    await page.getByRole('button', { name: 'Return to your evening', exact: true }).click();
    await expect(dialogue(page).getByRole('heading', { name: 'Wallet', exact: true })).toBeFocused();
    await expectHomeScene(page);
    await expect(storyClock(page)).toHaveText(city === 'hk' ? '19:45' : '22:45');
    expect(await readStorySave(page)).toEqual(saved);
    expect(await rawBytes(page)).toEqual(before);
    await closeDialogue(page);
    await expect(page.getByRole('button', { name: 'Open wallet', exact: true })).toBeFocused();
    await openAction(page, 'Open wallet');
    await page.getByRole('button', { name: 'Who benefits from this spending?', exact: true }).click();
    await expect(lens(page)).toHaveJSProperty('open', false);
    await summary.click();
    await expect(customer).toBeChecked();
    await expectActiveQuestion(page, 'What benefit does a customer receive?', 'What funds the price benefit, and how durable is that funding?');
    expect(await rawBytes(page)).toEqual(before);
  });
}
