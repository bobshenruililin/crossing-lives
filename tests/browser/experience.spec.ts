import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const noOverflow = async (page: import('@playwright/test').Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

test('complete story, edit, choose, reload and replay loop', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'One evening. Two possibilities.'})).toBeVisible();
  await page.getByRole('button',{name:'Discover the Hong Kong evening'}).click();
  await expect(page.getByText('Dinner, then the harbor.')).toBeVisible();
  await page.getByRole('button',{name:'Close location note'}).click();
  await page.getByRole('button',{name:'Step into the story'}).click();
  await page.getByRole('button',{name:/A new experience/}).click();
  await expect(page.getByRole('heading',{name:'There’s a whole evening nearby.'})).toBeVisible();
  await page.getByRole('button',{name:'Look across the border'}).click();
  await page.getByRole('button',{name:/Leave more breathing room/}).click();
  await page.getByRole('button',{name:'Compare your evening'}).click();
  await expect(page.getByRole('heading',{name:'Shape your evening'})).toBeVisible();
  await page.getByRole('button',{name:'One more person'}).click();
  await expect(page.locator('.party-field output')).toHaveText('3');
  await page.getByLabel('Budget per person').fill('500');
  await page.getByLabel('What makes this the right evening for you?').count().then(count => expect(count).toBe(0));
  await page.locator('.option-hk .choose-button').click();
  await expect(page.getByRole('heading',{name:'Your evening, pencilled in.'})).toBeVisible();
  await page.getByLabel('What makes this the right evening for you?').fill('More time together, fewer transfers.');
  await page.getByRole('button',{name:'Keep this field note'}).click();
  await expect(page.getByRole('button',{name:'Saved on this device'})).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'Continue your saved evening'}).click();
  await expect(page.getByLabel('What makes this the right evening for you?')).toHaveValue('More time together, fewer transfers.');
  await page.getByRole('button',{name:'Replay the story'}).click();
  await page.getByRole('button',{name:'Keep my evening'}).click();
  await expect(page.getByLabel('What makes this the right evening for you?')).toHaveValue('More time together, fewer transfers.');
  await page.getByRole('button',{name:'Replay the story'}).click();
  await page.getByRole('button',{name:'Reset and replay'}).click();
  await expect(page.getByRole('heading',{name:'Saturday has some room in it.'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('live constraints, costs, return route, allocation and evidence controls', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Your evening',exact:true}).click();
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
  await page.locator('.surplus-lab > summary').click();
  await page.getByLabel('Hypothetical pool').fill('100');
  for (const label of ['Workers','Community','Business reserve']) {const slider = page.getByLabel(label,{exact:false}); await slider.focus(); await slider.press('Home'); await slider.press('ArrowRight');}
  await expect(page.locator('.allocation-proof')).toContainText('HK$33.34 + HK$33.33 + HK$33.33 = HK$100.00');
  await page.getByRole('button',{name:/Research desk/}).click();
  await page.getByLabel('Search evidence').fill('nonexistent');
  await expect(page.getByRole('heading',{name:'No matching evidence yet.'})).toBeVisible();
  await page.getByRole('button',{name:'Show all sources'}).click();
  await expect(page.locator('.source-card')).toHaveCount(4);
  await page.getByRole('button',{name:'Business questions'}).click();
  await expect(page.getByRole('heading',{name:'A cheaper dinner isn’t a business model.'})).toBeVisible();
  await page.getByRole('button',{name:'Model roadmap'}).click();
  await expect(page.getByRole('heading',{name:'A model should earn your trust.'})).toBeVisible();
  await page.getByRole('button',{name:'The story',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Saturday has some room in it.'})).toBeVisible();
});

for (const width of [360,390,1440]) {
  test(`responsive ${width}px: every view fits and core controls remain accessible`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    await page.goto('/');
    await noOverflow(page);
    await expect(page.locator('.hero-world img')).toBeVisible();
    await page.screenshot({path:`artifacts/intro-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Step into the story'}).click();
    await noOverflow(page);
    await page.screenshot({path:`artifacts/story-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Your evening',exact:true}).click();
    await noOverflow(page);
    await page.screenshot({path:`artifacts/explore-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:/Research desk/}).click();
    await noOverflow(page);
    await page.screenshot({path:`artifacts/evidence-${width}.png`,fullPage:true});
  });
}

test('keyboard dialog focus, reduced motion and media failure fallback', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/art/*.webp',route => route.abort());
  await page.goto('/');
  await expect(page.getByText('The evening continues, even without the illustration.')).toBeVisible();
  await page.getByRole('button',{name:'Read the small print'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Read the small print'})).toBeFocused();
  await page.getByRole('button',{name:'Your evening',exact:true}).click();
  await expect(page.locator('.option-card')).toHaveCount(2);
  await expect(page.locator('.option-card .scene-fallback')).toHaveCount(2);
});

test('corrupt browser storage recovers without losing app access', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('between-journal-v1','not valid JSON'));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'One evening. Two possibilities.'})).toBeVisible();
  await expect(page.getByRole('status')).toBeVisible();
  await page.getByRole('button',{name:'Your evening',exact:true}).click();
  await expect(page.locator('.option-card')).toHaveCount(2);
});

test('no critical or serious accessibility violations in the main views', async ({page}) => {
  await page.goto('/');
  for (const view of ['intro','explore','desk']) {
    if (view === 'explore') await page.getByRole('button',{name:'Your evening',exact:true}).click();
    if (view === 'desk') await page.getByRole('button',{name:/Research desk/}).click();
    const result = await new AxeBuilder({page}).analyze();
    expect(result.violations.filter(v => ['critical','serious'].includes(v.impact ?? ''))).toEqual([]);
  }
});


test('unavailable localStorage keeps the full decision flow usable', async ({page}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Storage blocked','SecurityError');}});
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Saving is unavailable');
  await page.getByRole('button',{name:'Your evening',exact:true}).click();
  await page.locator('.option-hk .choose-button').click();
  await page.getByLabel('What makes this the right evening for you?').fill('This still works without storage.');
  await page.getByRole('button',{name:'Keep this field note'}).click();
  await expect(page.getByRole('button',{name:'Kept in this tab'})).toBeVisible();
});

test('an invalid intermediate edit does not overwrite a valid saved plan', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Your evening',exact:true}).click();
  await page.getByLabel('Budget per person').fill('500');
  await page.getByText('Travel & cost assumptions',{exact:true}).click();
  await page.getByLabel('Exchange assumption').fill('0');
  await expect(page.getByRole('alert')).toContainText('FX must be greater than 0');
  await page.reload();
  await page.getByRole('button',{name:'Continue your saved evening'}).click();
  await expect(page.getByLabel('Budget per person')).toHaveValue('500');
  await page.getByText('Travel & cost assumptions',{exact:true}).click();
  await expect(page.getByLabel('Exchange assumption')).toHaveValue('1.09');
});

test('adding a companion reopens the group entry check', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Your evening',exact:true}).click();
  const entry = page.getByRole('checkbox',{name:/everyone in this group/});
  await entry.check();
  await expect(entry).toBeChecked();
  await page.getByRole('button',{name:'One more person'}).click();
  await expect(entry).not.toBeChecked();
  await expect(page.locator('.option-sz .option-reasons')).toContainText('Entry eligibility is unconfirmed');
});

test('restored automatic journey assumptions match the selected route and origin', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Your evening',exact:true}).click();
  await page.getByLabel('Starting neighborhood').selectOption('island');
  await page.getByText('Travel & cost assumptions',{exact:true}).click();
  await page.getByLabel('Shenzhen route').selectOption('bus');
  await expect(page.getByLabel('HK local journey each way')).toHaveValue('20');
  await expect(page.getByLabel('SZ local journey each way')).toHaveValue('35');
  await expect(page.getByLabel('Border buffer each way')).toHaveValue('35');
  await page.reload();
  await page.getByRole('button',{name:'Continue your saved evening'}).click();
  await page.getByText('Travel & cost assumptions',{exact:true}).click();
  await expect(page.getByLabel('HK local journey each way')).toHaveValue('20');
  await expect(page.getByLabel('SZ local journey each way')).toHaveValue('35');
  await expect(page.getByLabel('Border buffer each way')).toHaveValue('35');
});
