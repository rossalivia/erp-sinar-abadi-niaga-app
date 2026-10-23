import type { Config } from '@netlify/functions';

declare const Netlify:
  | {
      env: {
        get: (key: string) => string | undefined;
      };
    }
  | undefined;

/**
 * Netlify Scheduled Function: Pemicu Notifikasi Email Stok Menipis Harian.
 * Berjalan otomatis setiap hari pukul 00.00 UTC (07.00 WIB).
 * Berperan sebagai pemicu tipis yang memanggil route handler Next.js dengan CRON_SECRET.
 */
const handler = async () => {
  // Hanya membaca URL dan CRON_SECRET lewat Netlify.env.get / process.env
  const siteUrl =
    (typeof Netlify !== 'undefined' ? Netlify.env.get('URL') : null) ||
    process.env.URL ||
    'http://localhost:3000';

  const cronSecret =
    (typeof Netlify !== 'undefined' ? Netlify.env.get('CRON_SECRET') : null) ||
    process.env.CRON_SECRET ||
    '';

  if (!cronSecret) {
    throw new Error('CRON_SECRET belum dikonfigurasi di variabel lingkungan Netlify');
  }

  const endpoint = `${siteUrl.replace(/\/+$/, '')}/api/cron/notifikasi-stok`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // Batas 25 detik (E3)

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    const responseBody = await res.text();

    if (!res.ok) {
      throw new Error(
        `Panggilan cron ke ${endpoint} gagal dengan status HTTP ${res.status}: ${responseBody}`
      );
    }

    return new Response(responseBody, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : 'Kegagalan pemicu Scheduled Function Netlify';
    // Melempar error agar tampak jelas pada log Netlify Functions (E3)
    throw new Error(errorMsg);
  } finally {
    clearTimeout(timeoutId);
  }
};

export const config: Config = {
  schedule: '0 0 * * *', // 00.00 UTC = 07.00 WIB setiap hari
};

export default handler;
