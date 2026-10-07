import { expect, type CDPSession, type Locator, type Page } from '@playwright/test';
import { geometryProblems, revealSwipe } from './phone-contract.mjs';
import { exitFor, pointFor } from '../world-browser/world-fixtures';
import { expectScene, insight, player, position, world } from '../world-browser/world-helpers';
import type { SceneId } from '../../src/world/types';

export type Geometry = { label: string; rect: { left: number; top: number; right: number; bottom: number }; clips: { left: number; top: number; right: number; bottom: number; x: boolean; y: boolean }[]; hit?: boolean };
export type TouchDriver = ReturnType<typeof touchDriver>;
export function touchDriver(page: Page, geometry: Geometry[]) {
  let session: CDPSession | undefined;
  const sample = async (target: Locator, label: string, hit = true, position?: { x: number; y: number }): Promise<Geometry> => target.evaluate((el, options) => {
    const rect = el.getBoundingClientRect();
    const clips = [{ left: 0, top: 0, right: innerWidth, bottom: innerHeight, x: true, y: true }];
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p), r = p.getBoundingClientRect();
      const x = /auto|scroll|hidden|clip/.test(s.overflowX), y = /auto|scroll|hidden|clip/.test(s.overflowY);
      if (x || y) clips.push({ left: r.left + p.clientLeft, top: r.top + p.clientTop, right: r.left + p.clientLeft + p.clientWidth, bottom: r.top + p.clientTop + p.clientHeight, x, y });
    }
    const px = rect.left + (options.position?.x ?? rect.width / 2), py = rect.top + (options.position?.y ?? rect.height / 2);
    const top = document.elementFromPoint(px, py);
    return { label: options.label, rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }, clips,
      ...(options.hit ? { hit: top !== null && (el === top || el.contains(top)) } : {}) };
  }, { label, hit, position });
  const visible = async (target: Locator, label: string, minimum = 0, hit = false, position?: { x: number; y: number }) => {
    await expect(target).toBeVisible();
    const value = await sample(target, label, hit, position); geometry.push(value);
    expect(geometryProblems(value, minimum), `${label}: geometry is measured before a touch can auto-scroll`).toEqual([]);
    return value;
  };
  const tap = async (target: Locator, label: string, position?: { x: number; y: number }) => {
    await visible(target, label, 44, true, position);
    await target.tap(position ? { position } : {});
  };
  // Chromium native touch dispatch is a physical touchscreen gesture, not DOM event injection.
  const swipe = async (body: Locator, direction: 'up' | 'down', requestedDistance?: number) => {
    const r = await body.boundingBox(); expect(r).not.toBeNull();
    const distance = Math.min(requestedDistance ?? r!.height * .55, r!.height * .55);
    const x = r!.x + r!.width * .85, start = r!.y + r!.height * (direction === 'up' ? .8 : .25), end = start + (direction === 'up' ? -distance : distance);
    const hit = await body.evaluate((el, point) => { const top = document.elementFromPoint(point.x, point.y); return !!top && el.contains(top); }, { x, y: start });
    expect(hit, 'Swipe starts inside the actual scroll surface').toBe(true);
    session ??= await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: start }] });
    for (let i = 1; i <= 12; i++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: start + (end - start) * i / 12 }] });
      await page.waitForTimeout(35);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(500);
  };
  const reveal = async (target: Locator, label: string) => {
    for (let i = 0; i < 14; i++) {
      const value = await sample(target, label, false); geometry.push(value);
      if (geometryProblems(value).length === 0) return;
      const plan = revealSwipe(value);
      await swipe(page.locator('.world-modal-scroll'), plan.direction, plan.distance);
    }
    await visible(target, label);
  };
  const close = async () => {
    await tap(page.getByRole('dialog').getByRole('button', { name: /^Close / }), 'Close dialog');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  };
  const open = async (id: SceneId) => {
    const control = page.locator('.world-inspect-control');
    if (await control.getAttribute('data-action') === 'enter') {
      await tap(page.getByRole('button', { name: 'Walk right', exact: true }), 'Step away from entrance');
      await expect(player(page)).toHaveAttribute('data-walking', 'false');
    }
    await expect(control).toHaveAccessibleName(`Explore ${pointFor(id).label.toLowerCase()}`);
    await tap(control, `Inspect ${id}`); await expect(insight(page, id)).toBeVisible();
  };
  const enterFirst = async () => {
    const exit = exitFor('hk-home', 'metro-carriage'), marker = page.getByTestId('exit-metro-carriage');
    for (let i = 0; i < 18 && await marker.getAttribute('data-nearby') !== 'true'; i++) {
      const before = await position(page), dx = exit.x - before.x, dy = exit.y - before.y;
      const name = Math.abs(dx) > 90 ? dx > 0 ? 'Walk right' : 'Walk left' : dy > 0 ? 'Walk forward' : 'Walk further back';
      await tap(page.getByRole('button', { name, exact: true }), `D-pad ${name}`);
      await expect(player(page)).toHaveAttribute('data-walking', 'false');
      const after = await position(page);
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(0);
      await expect(world(page)).toHaveAttribute('data-scene', 'hk-home');
    }
    await expect(marker).toHaveAttribute('data-nearby', 'true');
    await page.waitForTimeout(3_000);
    const enter = page.locator('.world-inspect-control'); await expect(enter).toHaveAttribute('data-action', 'enter');
    await tap(enter, 'Nearby Enter to the MTR'); await expectScene(page, 'metro-carriage');
  };
  const door = async (from: SceneId, to: SceneId) => {
    const candidates = page.getByRole('button', { name: `Walk to ${exitFor(from, to).label}`, exact: true });
    let selected: Locator | undefined;
    for (const candidate of await candidates.all()) {
      const measurement = await sample(candidate, `Door ${from} to ${to}`); geometry.push(measurement);
      if (geometryProblems(measurement, 44).length === 0) { selected = candidate; break; }
    }
    expect(selected, `An ordinary visible physical door must lead to ${to}`).toBeDefined();
    await tap(selected!, `Door ${from} to ${to}`); await expectScene(page, to);
  };
  return { visible, tap, swipe, reveal, close, open, enterFirst, door };
}
