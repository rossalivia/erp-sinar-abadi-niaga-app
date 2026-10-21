import { test, expect } from '@playwright/test';

test.describe('TC-39 s.d. TC-40: Modul Limit Kredit & Blokir Overdue (Credit & Overdue Control)', () => {
  test('TC-39: Editor pesanan menampilkan Panel Kredit Dinamis dan estimasi sisa plafon live', async ({ page }) => {
    const penjualanEmail = process.env.TEST_PENJUALAN_EMAIL || 'penjualan1@sinarabadi.test';
    const penjualanPass = process.env.TEST_PENJUALAN_PASSWORD;

    test.skip(!penjualanPass, 'TEST_PENJUALAN_PASSWORD belum diisi di .env.test.local');

    // Login sebagai Staf Penjualan
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', penjualanEmail);
    await page.fill('input[type="password"], input[name="password"]', penjualanPass!);
    await page.click('button[type="submit"]');

    await page.goto('/pesanan/baru');
    await expect(page).toHaveURL(/\/pesanan\/baru/);

    // Pastikan Panel Kredit Dinamis muncul
    const panelKredit = page.locator('text=Status Batas Kredit & Keuangan Pelanggan');
    await expect(panelKredit).toBeVisible();

    // Verifikasi 4 kartu ringkasan kredit
    await expect(page.locator('text=Batas Kredit (Plafon)')).toBeVisible();
    await expect(page.locator('text=Total Piutang Berjalan')).toBeVisible();
    await expect(page.locator('text=Sisa Plafon Kredit')).toBeVisible();
    await expect(page.locator('text=Sisa Setelah Pesanan Ini')).toBeVisible();

    // Pastikan tombol Simpan Draf tetap aktif dan dapat ditekan (D3: non-blocking di UI)
    const btnSimpan = page.locator('button:has-text("Simpan Draf")');
    await expect(btnSimpan).toBeEnabled();
  });

  test('TC-40: Halaman Detail Pelanggan menampilkan rincian piutang dan Tabel Faktur Overdue', async ({ page }) => {
    const penjualanEmail = process.env.TEST_PENJUALAN_EMAIL || 'penjualan1@sinarabadi.test';
    const penjualanPass = process.env.TEST_PENJUALAN_PASSWORD;

    test.skip(!penjualanPass, 'TEST_PENJUALAN_PASSWORD belum diisi di .env.test.local');

    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', penjualanEmail);
    await page.fill('input[type="password"], input[name="password"]', penjualanPass!);
    await page.click('button[type="submit"]');

    await page.goto('/pelanggan');
    await expect(page).toHaveURL(/\/pelanggan/);

    // Klik pelanggan pertama di daftar
    const linkPelanggan = page.locator('a[href^="/pelanggan/"]').first();
    if (await linkPelanggan.isVisible()) {
      await linkPelanggan.click();
      await page.waitForURL(/\/pelanggan\/.+/);

      // Verifikasi ringkasan kredit
      await expect(page.locator('text=Batas Kredit (Plafon)')).toBeVisible();
      await expect(page.locator('text=Piutang Berjalan')).toBeVisible();
      await expect(page.locator('text=Sisa Kredit')).toBeVisible();
      await expect(page.locator('text=Status Jatuh Tempo')).toBeVisible();
    }
  });
});
