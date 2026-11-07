import { expect, test } from '@playwright/test';
import { installApiFixture, proposal, villages } from './api-fixture';

test('server village IDs drive the map, sources and replay context', async ({ page }) => {
  const api = await installApiFixture(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.village-marker')).toHaveCount(5);
  for (const village of villages) await expect(page.locator(`.village-marker[data-village-id="${village.id}"]`)).toHaveCount(1);
  const marker = page.locator(`.village-marker[data-village-id="${villages[0].id}"]`);
  await marker.press('Enter');
  const preview = page.getByRole('dialog', { name: 'Desa Talio', exact: true });
  await expect(preview).toBeVisible();
  await preview.getByRole('button', { name: 'Buka detail desa' }).click();
  await expect(page.locator('.village-heading')).toContainText('Talio');
  await expect(page.locator('.backend-source').first()).toContainText('fixture');
  await expect(page.locator('.backend-source').first()).toContainText('stale / tersimpan');
  await page.getByRole('button', { name: 'Replay 2019', exact: true }).click();
  const slider = page.getByRole('slider', { name: 'Hari replay' });
  await expect(slider).toHaveAttribute('max', '61');
  await expect(page.locator('.replay-controls')).toContainText('15 Jun');
  await slider.fill('61');
  await expect(page.locator('.replay-controls')).toContainText('15 Agu');
  await expect.poll(() => api.requests.some(r => r.path === '/map/risk' && new URLSearchParams(r.search).get('mode') === 'replay' && new URLSearchParams(r.search).get('day') === '61')).toBe(true);
  expect(errors).toEqual([]);
});

test('report requires standalone YA, decisions require confirmation and survive reload from server', async ({ page }) => {
  const api = await installApiFixture(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Simulasikan kenaikan risiko', exact: true }).click();
  await page.getByRole('tab', { name: 'Telepon-SMS' }).click();
  await page.getByRole('button', { name: 'AIR 61 ASAP YA dekat kanal 4', exact: true }).click();
  await expect(page.locator('.confirmation-hint')).toBeVisible();
  expect(api.actions).toHaveLength(0);
  await expect(page.locator('#panel-messages')).toContainText('Bacaan ulang: AIR 61');
  await page.getByRole('button', { name: 'YA', exact: true }).click();
  await page.getByRole('button', { name: 'Setujui', exact: true }).click();
  expect(api.actions[0].status).toBe('proposed');
  await page.getByRole('button', { name: 'Konfirmasi persetujuan', exact: true }).click();
  await expect.poll(() => api.actions[0].status).toBe('approved');
  await page.reload();
  await expect(page.locator('.backend-row').filter({ hasText: 'Sekat Kanal empat A1' }).first()).toContainText('approved');
  api.actions.push(proposal('A2'));
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Muat ulang data', exact: true }).click();
  await page.getByRole('button', { name: 'Tolak', exact: true }).click();
  await page.getByLabel('Alasan penolakan').fill('Perlu pemeriksaan kanal');
  await page.getByRole('button', { name: 'Konfirmasi penolakan', exact: true }).click();
  await expect.poll(() => api.actions[1].status).toBe('rejected');
  expect(api.requests.find(r => r.path === '/actions/A2/reject')?.body).toEqual({ reason: 'Perlu pemeriksaan kanal' });
  await page.reload();
  await expect(page.locator('.backend-row').filter({ hasText: 'Sekat Kanal empat A2' }).first()).toContainText('rejected');
});

test('simulation keeps lower bounds and unknown metrics explicit', async ({ page }) => {
  const api = await installApiFixture(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Hitung dengan engine', exact: true }).click();
  await expect(page.locator('.backend-benefit')).toContainText('Setidaknya 8 hari tambahan');
  await expect(page.locator('.backend-benefit')).toContainText('Belum tersedia');
  await expect(page.locator('.backend-benefit')).not.toContainText('0 cm');
  expect(api.requests.find(r => r.path.endsWith('/simulate'))?.body).toEqual({ mode: 'live', day: 0, type: 'canal_block', targets: ['K4'], delta_hc_cm: 60, days: 14 });
});

test('503 shows unavailable risk and 401 clears command data without fallback', async ({ page }) => {
  const api = await installApiFixture(page);
  api.failRisk();
  await page.goto('/');
  await expect(page.getByRole('alert').filter({ hasText: 'TEST engine unavailable' })).toBeVisible();
  await expect(page.locator('.summary-band')).toContainText('N/A');
  await expect(page.locator('.decision-card')).toHaveCount(0);
  await page.route('**/api/map/risk?**', route => route.fulfill({ status: 401, json: { error: { code: 'unauthorized', message: 'TEST session expired' } } }));
  await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sesi operator diperlukan' })).toBeVisible();
  await expect(page.locator('.village-marker')).toHaveCount(0);
});

test('field link only requests its scoped conversation and send endpoint', async ({ page }) => {
  const calls: string[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    calls.push(path);
    expect(['/api/field/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/messages', '/api/field/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/send']).toContain(path);
    await route.fulfill({ json: { items: [], responder: { name: 'Petugas Talio', village_id: villages[0].id }, state: 'collect', browser_voice_supported: false } });
  });
  await page.goto('/f/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  await expect(page.getByText('Petugas Talio', { exact: true })).toBeVisible();
  await page.getByLabel('Pesan kepada Warden', { exact: true }).fill('Air 61 cm, asap terlihat, kanal empat');
  await page.getByRole('button', { name: 'Kirim pesan', exact: true }).click();
  await expect.poll(() => calls.includes('/api/field/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/send')).toBe(true);
  await expect(page.locator('.command-room')).toHaveCount(0);
});
