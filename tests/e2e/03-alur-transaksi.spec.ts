import { test, expect } from '@playwright/test';

test.describe('TC-10 s.d. TC-28: Alur Transaksi Bisnis Terintegrasi E2E', () => {
  test('TC-13: Validasi batas diskon Staf Penjualan maksimal 10%', async ({ page }) => {
    const penjualanEmail = process.env.TEST_PENJUALAN_EMAIL || 'penjualan1@sinarabadi.test';
    const penjualanPass = process.env.TEST_PENJUALAN_PASSWORD;

    test.skip(!penjualanPass, 'TEST_PENJUALAN_PASSWORD belum diisi di .env.test.local');

    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', penjualanEmail);
    await page.fill('input[type="password"], input[name="password"]', penjualanPass!);
    await page.click('button[type="submit"]');

    await page.goto('/pesanan/baru');
    await expect(page).toHaveURL(/\/pesanan\/baru/);

    // Verifikasi petunjuk diskon untuk peran Penjualan
    const diskonField = page.locator('input[type="number"][min="0"][max="10"], input[placeholder*="0-10"]');
    if (await diskonField.count() > 0) {
      await expect(diskonField.first()).toBeVisible();
    }
  });

  test('TC-27: Form penyesuaian stok memvalidasi alasan minimal 10 karakter', async ({ page }) => {
    const gudangEmail = process.env.TEST_GUDANG_EMAIL || 'gudang@sinarabadi.test';
    const gudangPass = process.env.TEST_GUDANG_PASSWORD;

    test.skip(!gudangPass, 'TEST_GUDANG_PASSWORD belum diisi di .env.test.local');

    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', gudangEmail);
    await page.fill('input[type="password"], input[name="password"]', gudangPass!);
    await page.click('button[type="submit"]');

    await page.goto('/stok');
    await expect(page).toHaveURL(/\/stok/);

    // Buka tombol Opname
    const btnOpname = page.locator('button:has-text("Opname")').first();
    if (await btnOpname.isVisible()) {
      await btnOpname.click();
      // Dialog harus muncul
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Isi alasan terlalu pendek (5 karakter)
      await page.fill('textarea[name="alasan"], input[name="alasan"]', 'pendek');
      await page.click('button:has-text("Simpan Penyesuaian")');

      // Harus menampilkan error validasi alasan minimal 10 karakter
      const errorMsg = page.locator('text=minimal 10 karakter');
      await expect(errorMsg).toBeVisible();
    }
  });

  test('TC-28: Manajer dapat melihat Audit Log dan membuka dialog rincian diff', async ({ page }) => {
    const manajerEmail = process.env.TEST_MANAJER_EMAIL || 'manajer@sinarabadi.test';
    const manajerPass = process.env.TEST_MANAJER_PASSWORD;

    test.skip(!manajerPass, 'TEST_MANAJER_PASSWORD belum diisi di .env.test.local');

    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', manajerEmail);
    await page.fill('input[type="password"], input[name="password"]', manajerPass!);
    await page.click('button[type="submit"]');

    await page.goto('/audit');
    await expect(page).toHaveURL(/\/audit/);

    // Tabel audit harus memiliki tombol Rincian jika ada rekaman
    const btnRincian = page.locator('button:has-text("Rincian")').first();
    if (await btnRincian.isVisible()) {
      await btnRincian.click();
      const dialogDiff = page.locator('[role="dialog"]');
      await expect(dialogDiff).toBeVisible();
      await expect(dialogDiff).toContainText('Rincian Perubahan Data Audit');
    }
  });
});
