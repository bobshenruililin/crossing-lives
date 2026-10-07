import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { capture, closePoint, expectNoOverflow, expectScene, mapTo, openPoint, player, position, stage, world } from './world-helpers';
import { expectVisibleCast, expectVisibleFamilyBodies } from './world-cast-geometry';
import { expectVisibleSprite } from './world-geometry';

async function selectParty(page: Page, party: string) {
  await page.getByRole('button', { name: 'Change people and day', exact: true }).click();
  await page.getByRole('combobox', { name: 'People', exact: true }).selectOption(party);
  await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
  await expect(world(page)).toHaveAttribute('data-party', party);
}
for (const viewport of [{ width:360,height:844 },{ width:390,height:844 },{ width:1440,height:900 }]) for (const party of ['older-couple','family'] as const) {
  test(`${party} has distinct complete people, grounded flips and party switching at ${viewport.width}px`, async ({ browser, baseURL }, info) => {
    test.setTimeout(90_000);
    const touch = viewport.width < 650, context = await browser.newContext({ baseURL, viewport, hasTouch: touch, reducedMotion: 'no-preference' });
    const page = await context.newPage(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto('/world.html'); await expect(page.getByRole('combobox')).toHaveCount(0);
      await page.getByRole('button', { name: 'Change people or day' }).click();
      await page.getByRole('combobox', { name: 'People', exact: true }).selectOption(party);
      if (touch) await page.getByRole('button', { name: 'Play', exact: true }).tap(); else await page.getByRole('button', { name: 'Play', exact: true }).click();
      await expect(world(page)).toHaveAttribute('data-started', 'true'); await expect(world(page)).toHaveAttribute('data-party', party);
      await expect(stage(page)).toBeFocused(); await expectScene(page, 'hk-home');
      const checkCast = async () => {
        await expect(page.locator('.world-sprite')).toHaveCount(party === 'family' ? 3 : 2);
        if (party === 'older-couple') { await expectVisibleCast(page, player(page), 'older-adult-a'); await expectVisibleCast(page, page.getByTestId('world-friend'), 'older-adult-b'); }
        else {
          const adult = await expectVisibleSprite(page);
          await expect(page.getByTestId('world-friend').locator('img')).toHaveAttribute('src', /\/art\/friend\.webp$/);
          const child = await expectVisibleCast(page, page.getByTestId('world-child'), 'child');
          const ratio = (child.alpha.bottom - child.alpha.top) / adult.height; expect(ratio).toBeGreaterThan(.66); expect(ratio).toBeLessThan(.68);
          await expectVisibleFamilyBodies(page);
        }
        await expectNoOverflow(page);
      };
      await checkCast(); await capture(page, info, 'selected-cast-first-play');
      for (const facing of ['left','right'] as const) {
        const before = await position(page);
        if (touch) await page.getByRole('button', { name: `Walk ${facing}`, exact:true }).tap(); else await page.keyboard.press(facing === 'left' ? 'ArrowLeft' : 'ArrowRight');
        await expect(player(page)).toHaveAttribute('data-walking', 'true');
        const pose = page.locator('.world-cast-sprite').first();
        await expect.poll(() => pose.locator('.world-sprite-crop').evaluate(el => getComputedStyle(el).animationName)).not.toBe('none');
        await expect(player(page)).toHaveAttribute('data-walking', 'false'); expect(Math.abs((await position(page)).x - before.x)).toBeGreaterThan(80);
        await expect(pose).toHaveAttribute('data-facing', facing); await checkCast(); await capture(page, info, `moving-${facing}-grounded`);
      }
      for (const id of ['metro-carriage','neighborhood-lane','rental-home'] as const) { await mapTo(page, id); await checkCast(); await capture(page, info, `${id}-cast`); }
      for (const approach of party === 'older-couple' ? ['from-left','from-right'] : ['from-left']) {
        if (approach === 'from-right') { await page.getByRole('button', { name:'Walk right',exact:true }).click(); await expect(player(page)).toHaveAttribute('data-walking','false'); }
        await openPoint(page,'rental-home'); await closePoint(page); await checkCast();
        const marker = await page.getByTestId('point-rental-home').boundingBox(); expect(marker).not.toBeNull();
        expect(marker!.x).toBeGreaterThanOrEqual(0); expect(marker!.x + marker!.width).toBeLessThanOrEqual(viewport.width);
        for (const actor of await page.locator('.world-cast-sprite').all()) {
          const body = (await expectVisibleCast(page, actor, (await actor.getAttribute('data-cast-id'))!)).alpha;
          const overlap = Math.max(0, Math.min(body.right, marker!.x + marker!.width) - Math.max(body.left, marker!.x)) * Math.max(0, Math.min(body.bottom, marker!.y + marker!.height) - Math.max(body.top, marker!.y));
          expect(overlap, 'The complete44px marker clears the full visible cast.').toBe(0);
        }
        await capture(page, info, `rental-cast-clear-marker-${approach}`);
      }
      await mapTo(page,'luxury-home'); await openPoint(page,'luxury-home'); await closePoint(page); await checkCast(); await capture(page,info,'showroom-cast-after-inspection');
      await selectParty(page,'couple'); await expect(page.locator('.world-cast-sprite')).toHaveCount(0); await expect(page.locator('.world-sprite')).toHaveCount(2);
      await expect(player(page).locator('img')).toHaveAttribute('src', /\/art\/player\.webp$/); await expect(page.getByTestId('world-friend').locator('img')).toHaveAttribute('src', /\/art\/friend\.webp$/);
      await selectParty(page,party); await checkCast();
      await page.emulateMedia({ reducedMotion:'reduce' }); const beforeReduced = await position(page); await stage(page).focus(); await page.keyboard.press('ArrowRight');
      for (const pose of await page.locator('.world-cast-sprite .world-sprite-crop').all()) expect(await pose.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
      await expect(player(page)).toHaveAttribute('data-walking','false'); expect((await position(page)).x).toBeGreaterThan(beforeReduced.x);
      await checkCast(); expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}

test('failed cast art stays playable and changing people does not retain the old failure', async ({ page }) => {
  await page.route('**/art/older-adult-a.png', route => route.abort('failed'));
  await page.goto('/world.html'); await page.getByRole('button', { name:'Play',exact:true }).click(); await expectScene(page,'hk-home'); await selectParty(page,'older-couple');
  await expect(player(page)).toHaveAttribute('data-art-status','fallback'); await expect(player(page).locator('[data-cast-fallback="older-adult-a"]')).toBeVisible();
  await stage(page).focus(); const before = await position(page); await page.keyboard.press('ArrowLeft'); await expect(player(page)).toHaveAttribute('data-walking','false'); expect((await position(page)).x).toBeLessThan(before.x);
  await selectParty(page,'couple'); await expectVisibleSprite(page); await page.unroute('**/art/older-adult-a.png'); await selectParty(page,'older-couple'); await expectVisibleCast(page,player(page),'older-adult-a');
});

test('all three original cutouts decode from the standalone export with no network', async ({ browser }, info) => {
  const context = await browser.newContext({ viewport:{ width:390,height:844 }, offline:true }), requests: string[] = [];
  context.on('request', request => { if (/^https?:/i.test(request.url())) requests.push(request.url()); }); const page = await context.newPage();
  try {
    await page.goto(pathToFileURL(resolve('artifacts/crossing-lives-world.html')).href); await page.getByRole('button', { name:'Play',exact:true }).click(); await expectScene(page,'hk-home',true);
    await selectParty(page,'older-couple'); await expectVisibleCast(page,player(page),'older-adult-a'); await expectVisibleCast(page,page.getByTestId('world-friend'),'older-adult-b'); await capture(page,info,'offline-older-couple');
    await selectParty(page,'family'); await expectVisibleCast(page,page.getByTestId('world-child'),'child'); await expectVisibleFamilyBodies(page); await capture(page,info,'offline-family'); expect(requests).toEqual([]);
  } finally { await context.close(); }
});
