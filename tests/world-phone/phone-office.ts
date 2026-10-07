import { expect, type Page } from '@playwright/test';
import type { TouchDriver } from './phone-touch';
export async function recordPhoneOffice(page: Page, touch: TouchDriver, read: (label: string, ms: number) => Promise<void>) {
  const panel = page.getByTestId('world-insight-office-floor');
  const numbers = async (hk: string, sz: string) => {
    await expect(panel.locator('[data-world-number="Hong Kong home"] strong')).toHaveText(hk);
    await expect(panel.locator('[data-world-number="Shenzhen home"] strong')).toHaveText(sz);
  };
  await expect(panel).toHaveAttribute('data-choice', '2'); await expect(panel).toHaveAttribute('data-measure', 'time');
  await numbers('12', '28');
  const four = panel.getByRole('radio', { name: '4 days / week', exact: true });
  await touch.visible(panel.getByRole('radio', { name: '2 days / week', exact: true }).locator('..'), 'Initial two-day office choice', 44, true);
  await touch.visible(four.locator('..'), 'Initial four-day office choice', 44, true);
  await touch.visible(panel.getByRole('combobox', { name: 'Compare travel', exact: true }), 'Initial office measure chooser', 44, true);
  for (const name of ['Hong Kong home', 'Shenzhen home']) await touch.visible(panel.locator(`[data-world-number="${name}"]`), `Initial office total: ${name}`);
  await read('Office: two days weekly; compare both fictional four-week time totals.', 8_000);
  await touch.tap(four.locator('..'), 'Four office days per week'); await expect(four).toBeChecked(); await numbers('24', '56');
  await read('Office: four days weekly doubles the return journeys and time.', 8_000);
  const summary = panel.getByText('Calendar & route comparison', { exact: true });
  await touch.reveal(summary, 'Office optional route comparison'); await touch.tap(summary, 'Open office calendar and route comparison');
  const diagram = panel.locator('[data-mechanism=office-workweek]');
  await touch.reveal(diagram, 'Office calendar and routes');
  await expect(panel.locator('[data-office-cell]')).toHaveCount(28); await expect(panel.locator('[data-office-return=true]')).toHaveCount(16);
  await expect(panel.locator('[data-office-route]')).toHaveCount(2);
  await read('Office: inspect the sixteen return days and the two fictional routes.', 6_000);
  await touch.close();
}
