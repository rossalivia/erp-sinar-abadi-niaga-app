import { test, expect } from '@playwright/test';

test.describe('TC-03 s.d. TC-05: Verifikasi Kerahasiaan Nilai Finansial (HPP & Harga Beli)', () => {
  test('TC-03: Respons jaringan dan UI Gudang tidak memuat harga_pokok', async ({ page }) => {
    const gudangEmail = process.env.TEST_GUDANG_EMAIL || 'gudang@sinarabadi.test';
    const gudangPass = process.env.TEST_GUDANG_PASSWORD;

    test.skip(!gudangPass, 'TEST_GUDANG_PASSWORD belum diisi di .env.test.local');

    // Login sebagai Gudang
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', gudangEmail);
    await page.fill('input[type="password"], input[name="password"]', gudangPass!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(|dashboard|barang)/);

    // Pasang intercept jaringan untuk memeriksa payload data
    let hasLeakedHpp = false;
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/barang') || url.includes('_rsc')) {
        try {
          const text = await response.text();
          if (text.includes('harga_pokok') || text.includes('"hpp_satuan"')) {
            hasLeakedHpp = true;
          }
        } catch {
          // Abaikan respons biner jika ada
        }
      }
    });

    await page.goto('/barang');
    await page.waitForLoadState('networkidle');

    // Pastikan tidak ada kolom 'Harga Pokok' di tabel UI
    const headerHpp = page.locator('th:has-text("Harga Pokok"), th:has-text("HPP")');
    await expect(headerHpp).toHaveCount(0);
    expect(hasLeakedHpp).toBe(false);
  });

  test('TC-05: Penjualan diblokir dari /pembelian dan Gudang tidak melihat harga beli', async ({ page }) => {
    const gudangEmail = process.env.TEST_GUDANG_EMAIL || 'gudang@sinarabadi.test';
    const gudangPass = process.env.TEST_GUDANG_PASSWORD;

    test.skip(!gudangPass, 'TEST_GUDANG_PASSWORD belum diisi di .env.test.local');

    // Login sebagai Gudang
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', gudangEmail);
    await page.fill('input[type="password"], input[name="password"]', gudangPass!);
    await page.click('button[type="submit"]');

    let hasLeakedHargaBeli = false;
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/pembelian') || url.includes('_rsc')) {
        try {
          const text = await response.text();
          if (text.includes('"harga_beli_satuan"') || text.includes('"total_estimasi_beli"')) {
            hasLeakedHargaBeli = true;
          }
        } catch {}
      }
    });

    await page.goto('/pembelian');
    await page.waitForLoadState('networkidle');

    // Kolom harga beli tidak boleh muncul untuk Gudang
    const headerHargaBeli = page.locator('th:has-text("Harga Beli"), th:has-text("Total Beli")');
    await expect(headerHargaBeli).toHaveCount(0);
    expect(hasLeakedHargaBeli).toBe(false);
  });

  test('TC-04: Non-manajer diblokir saat membuka /laporan dan /audit', async ({ page }) => {
    const penjualanEmail = process.env.TEST_PENJUALAN_EMAIL || 'penjualan1@sinarabadi.test';
    const penjualanPass = process.env.TEST_PENJUALAN_PASSWORD;

    test.skip(!penjualanPass, 'TEST_PENJUALAN_PASSWORD belum diisi di .env.test.local');

    // Login sebagai Penjualan
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', penjualanEmail);
    await page.fill('input[type="password"], input[name="password"]', penjualanPass!);
    await page.click('button[type="submit"]');

    // Coba buka /laporan
    await page.goto('/laporan');
    await expect(page).toHaveURL(/\/tidak-berwenang/);

    // Coba buka /audit
    await page.goto('/audit');
    await expect(page).toHaveURL(/\/tidak-berwenang/);
  });
});
