import { test, expect } from '@playwright/test';

test.describe('TC-01 & TC-02: Autentikasi, Route Guard, dan Perlindungan Noindex', () => {
  test('TC-01a: Pengguna anonim membuka root diarahkan ke /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);

    // Form login ada, tanpa tautan daftar publik
    const formLogin = page.locator('form');
    await expect(formLogin).toBeVisible();

    const linkDaftar = page.locator('a:has-text("Daftar"), a:has-text("Register"), a:has-text("Sign up")');
    await expect(linkDaftar).toHaveCount(0);
  });

  test('TC-01b: Header X-Robots-Tag dan meta robots terpasang noindex', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response).not.toBeNull();

    // Periksa header response HTTP
    const headers = response!.headers();
    const xRobots = headers['x-robots-tag'];
    expect(xRobots).toBeDefined();
    expect(xRobots?.toLowerCase()).toContain('noindex');

    // Periksa meta tag HTML
    const metaRobots = page.locator('meta[name="robots"]');
    await expect(metaRobots).toHaveAttribute('content', /noindex/i);
  });

  test('TC-01c: File public robots.txt melarang perayapan (Disallow: /)', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('Disallow: /');
  });

  test('TC-02: Akun nonaktif ditolak masuk dengan pesan yang sesuai', async ({ page }) => {
    const nonaktifEmail = process.env.TEST_NONAKTIF_EMAIL || 'nonaktif@sinarabadi.test';
    const nonaktifPass = process.env.TEST_NONAKTIF_PASSWORD;

    test.skip(!nonaktifPass, 'TEST_NONAKTIF_PASSWORD belum diisi di .env.test.local');

    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', nonaktifEmail);
    await page.fill('input[type="password"], input[name="password"]', nonaktifPass!);
    await page.click('button[type="submit"]');

    // Harus menampilkan pesan penolakan akun dinonaktifkan
    const errorMessage = page.locator('text=dinonaktifkan, text=tidak aktif, text=E0030');
    await expect(errorMessage.first()).toBeVisible();
  });
});
