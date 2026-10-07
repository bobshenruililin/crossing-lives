import { expect, type Page } from '@playwright/test';

/** Reads the actual DOM coordinate plane before input. Never scrolls,
 * focuses, clicks, taps, or substitutes viewport visibility for crop visibility. */
export async function expectProjectedObjectTarget(page: Page, id: string) {
  await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-camera-moving', 'false');
  const target = page.locator(`#decision-object-${id}`);
  await expect(target).toBeVisible();
  await expect.poll(async () => target.evaluate(button => {
    const frame = document.querySelector<HTMLElement>('[data-testid="decision-journey-frame"]')!;
    const plane = document.querySelector<HTMLElement>('[data-testid="decision-journey-plane"]')!;
    const box = button.getBoundingClientRect(), crop = frame.getBoundingClientRect(), world = plane.getBoundingClientRect();
    const x = Number(button.getAttribute('data-source-x')), y = Number(button.getAttribute('data-source-y'));
    const within = box.left >= Math.max(0, crop.left) && box.right <= Math.min(window.innerWidth, crop.right)
      && box.top >= Math.max(0, crop.top) && box.bottom <= Math.min(window.innerHeight, crop.bottom);
    const aligned = Math.abs(box.left + box.width / 2 - (world.left + world.width * x)) < 1
      && Math.abs(box.top + box.height / 2 - (world.top + world.height * y)) < 1;
    const points = [[box.left + 1, box.top + 1], [box.right - 1, box.top + 1], [box.left + 1, box.bottom - 1], [box.right - 1, box.bottom - 1], [box.left + box.width / 2, box.top + box.height / 2]];
    const uncovered = points.every(([px, py]) => { const hit = document.elementFromPoint(px, py); return hit === button || !!hit && button.contains(hit); });
    return { within, aligned, uncovered, fullSize: box.width >= 44 && box.height >= 44, unscrolled: frame.scrollLeft === 0 && frame.scrollTop === 0 };
  }), 'The whole physical44px target must be inside the scene, source-aligned and unobscured before input.').toEqual({ within: true, aligned: true, uncovered: true, fullSize: true, unscrolled: true });
}

export async function expectAllDisplayedObjectTargets(page: Page) {
  await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-camera-moving', 'false');
  const ids = await page.locator('.decision-journey-object-targets button:visible').evaluateAll(buttons => buttons.map(button => button.getAttribute('data-object-id')!));
  for (const id of ids) await expectProjectedObjectTarget(page, id);
}

export async function expectPhysicalInputIfPresent(page: Page, name: string) {
  if (!await page.getByTestId('decision-journey').count()) return;
  const target = page.getByRole('button', { name, exact: true });
  const id = await target.getAttribute('data-object-id');
  if (id) await expectProjectedObjectTarget(page, id);
}

/** Read-only animation-frame probe. It records the first browser frame whose
 * DOM says arrived; it neither seeds state nor waits for an image/transition. */
export async function observeFirstArrivalFrame(page: Page) {
  await page.evaluate(() => {
    const target = window as typeof window & { __crossingArrivalFrame?: unknown };
    delete target.__crossingArrivalFrame;
    const sample = () => {
      const journey = document.querySelector<HTMLElement>('[data-testid="decision-journey"]');
      if (journey?.dataset.phase !== 'arrived') { requestAnimationFrame(sample); return; }
      const frame = document.querySelector<HTMLElement>('[data-testid="decision-journey-frame"]')!;
      const plane = document.querySelector<HTMLElement>('[data-testid="decision-journey-plane"]')!;
      const player = document.querySelector<HTMLElement>('[data-testid="decision-player"]')!;
      const crop = frame.getBoundingClientRect(), body = player.getBoundingClientRect();
      target.__crossingArrivalFrame = {
        phase: journey.dataset.phase, art: journey.dataset.artStatus,
        playerInside: body.left >= crop.left && body.right <= crop.right && body.top >= crop.top && body.bottom <= crop.bottom,
        cameraDurations: getComputedStyle(plane).transitionDuration.split(',').map(Number.parseFloat),
        playerDurations: getComputedStyle(player).transitionDuration.split(',').map(Number.parseFloat),
      };
    };
    requestAnimationFrame(sample);
  });
}
export async function expectFirstArrivalFrame(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __crossingArrivalFrame?: unknown }).__crossingArrivalFrame)).toEqual({
    phase: 'arrived', art: 'ready', playerInside: true, cameraDurations: [0], playerDurations: [0],
  });
}
