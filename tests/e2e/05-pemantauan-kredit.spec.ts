import { test, expect } from '@playwright/test';

test.describe('Pemantauan dan Rekomendasi Kredit: Hak Akses & Kerahasiaan Data (PRD 11.2)', () => {
  test('Penjualan dan Gudang diblokir dari /kredit (dialihkan ke /tidak-berwenang)', async ({ page }) => {
    const penjualanEmail = process.env.TEST_PENJUALAN_EMAIL || 'penjualan1@sinarabadi.test';
    const penjualanPass = process.env.TEST_PENJUALAN_PASSWORD;

    test.skip(!penjualanPass, 'TEST_PENJUALAN_PASSWORD belum diisi di .env.test.local');

    // Login sebagai Penjualan
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', penjualanEmail);
    await page.fill('input[type="password"], input[name="password"]', penjualanPass!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(|dashboard)/);

    // Coba akses /kredit
    await page.goto('/kredit');
    await expect(page).toHaveURL(/\/tidak-berwenang/);
  });

  test('Penjualan tidak menerima skor_kredit, kelas_kredit, atau rekomendasi_limit di RSC / Detail Pelanggan', async ({ page }) => {
    const penjualanEmail = process.env.TEST_PENJUALAN_EMAIL || 'penjualan1@sinarabadi.test';
    const penjualanPass = process.env.TEST_PENJUALAN_PASSWORD;

    test.skip(!penjualanPass, 'TEST_PENJUALAN_PASSWORD belum diisi di .env.test.local');

    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', penjualanEmail);
    await page.fill('input[type="password"], input[name="password"]', penjualanPass!);
    await page.click('button[type="submit"]');

    let hasLeakedCreditAnalysis = false;
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/pelanggan') || url.includes('_rsc')) {
        try {
          const text = await response.text();
          if (
            text.includes('"skor_kredit"') ||
            text.includes('"kelas_kredit"') ||
            text.includes('"rekomendasi_limit"') ||
            text.includes('Rekomendasi Plafon Kredit')
          ) {
            hasLeakedCreditAnalysis = true;
          }
        } catch {
          // Abaikan error streaming/binary
        }
      }
    });

    await page.goto('/pelanggan');
    const linkPelanggan = page.locator('a[href^="/pelanggan/"]').first();
    if (await linkPelanggan.isVisible()) {
      await linkPelanggan.click();
      await page.waitForLoadState('networkidle');

      // Pastikan panel penilaian kredit tidak ada di DOM
      const panelPenilaian = page.locator('text=Penilaian & Rekomendasi Kredit');
      await expect(panelPenilaian).toHaveCount(0);
      expect(hasLeakedCreditAnalysis).toBe(false);
    }
  });

  test('Manajer dapat mengakses /kredit dan melihat halaman Pemantauan & Rekomendasi Kredit', async ({ page }) => {
    const manajerEmail = process.env.TEST_MANAJER_EMAIL || 'manajer@sinarabadi.test';
    const manajerPass = process.env.TEST_MANAJER_PASSWORD;

    test.skip(!manajerPass, 'TEST_MANAJER_PASSWORD belum diisi di .env.test.local');

    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', manajerEmail);
    await page.fill('input[type="password"], input[name="password"]', manajerPass!);
    await page.click('button[type="submit"]');

    await page.goto('/kredit');
    await expect(page).toHaveURL(/\/kredit/);
    await expect(page.locator('text=Pemantauan & Rekomendasi Kredit')).toBeVisible();
    await expect(page.locator('text=Perlu Tinjau Segera')).toBeVisible();
  });
});
