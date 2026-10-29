import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import {
  MockMayarClient,
  HttpMayarClient,
  DisabledMayarClient,
  getMayarClient,
  isMayarConfigured,
} from '../mayar-client';
import {
  prosesWebhookMayarService,
  getAppBaseUrl,
} from '../service';
import { GET as webhookGet, PUT as webhookPut, POST as webhookPost } from '@/app/api/webhooks/mayar/[token]/route';

// Mock Supabase admin client
const mockRpc = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: mockRpc,
  }),
}));

// Mock Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: 'tagihan_test_123',
              pesanan_jual_id: 'pesanan_test_123',
              mayar_invoice_id: 'inv_mayar_test_123',
              status: 'dibuat',
              jumlah: 500000,
              total: 500000,
            },
            error: null,
          }),
        }),
      }),
    }),
    rpc: mockRpc,
  }),
}));

function setNodeEnv(val: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = val;
}

describe('Modul Tautan Bayar Piutang lewat Mayar (PRD 11.3)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockRpc.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('1. MockMayarClient, HttpMayarClient & Fail-Closed Guard (Butir 2)', () => {
    it('TC-173a: MockMayarClient hanya aktif jika NODE_ENV != production DAN MAYAR_MOCK=true', () => {
      delete process.env.MAYAR_API_KEY;
      setNodeEnv('test');
      process.env.MAYAR_MOCK = 'true';

      expect(isMayarConfigured()).toBe(true);
      const client = getMayarClient();
      expect(client).toBeInstanceOf(MockMayarClient);
    });

    it('TC-173b: Jika MAYAR_MOCK bukan true di test/development tanpa API key, gunakan DisabledMayarClient', () => {
      delete process.env.MAYAR_API_KEY;
      setNodeEnv('test');
      delete process.env.MAYAR_MOCK;

      expect(isMayarConfigured()).toBe(false);
      const client = getMayarClient();
      expect(client).toBeInstanceOf(DisabledMayarClient);
    });

    it('TC-173c: Di production tanpa API key, gagal tertutup dan melempar error jelas', async () => {
      delete process.env.MAYAR_API_KEY;
      setNodeEnv('production');
      process.env.MAYAR_MOCK = 'true'; // mock tetap diabaikan di production

      expect(isMayarConfigured()).toBe(false);
      const client = getMayarClient();
      expect(client).toBeInstanceOf(DisabledMayarClient);

      await expect(
        client.createInvoice({
          name: 'Toko',
          email: 'toko@example.com',
          mobile: '08123',
          description: 'Test',
          expiredAt: '2026-10-27T00:00:00Z',
          redirectUrl: 'http://localhost:3000',
          items: [{ description: 'Test', quantity: 1, rate: 100000 }],
          extraData: { noCustomer: 'CUST-001', idProd: 'SO-001' },
        })
      ).rejects.toThrow('Integrasi pembayaran Mayar belum dikonfigurasi (MAYAR_API_KEY tidak ditemukan)');
    });

    it('TC-173d: HttpMayarClient digunakan jika MAYAR_API_KEY valid', () => {
      process.env.MAYAR_API_KEY = 'valid_secret_key_123';
      expect(isMayarConfigured()).toBe(true);
      const client = getMayarClient();
      expect(client).toBeInstanceOf(HttpMayarClient);
    });
  });

  describe('2. Validasi Token Webhook (Constant-Time & 401)', () => {
    it('TC-179: Menolak token salah atau tidak disediakan dengan HTTP 401 Unauthorized', async () => {
      process.env.MAYAR_WEBHOOK_TOKEN = 'secret_webhook_token_xyz_12345';

      const hasilSalah = await prosesWebhookMayarService(
        'token_salah_tidak_cocok',
        JSON.stringify({ event: 'payment.received' })
      );

      expect(hasilSalah.status).toBe(401);
      expect(hasilSalah.message).toContain('Unauthorized');
    });

    it('TC-179b: Constant-time digest SHA-256 membandingkan dengan konsisten', () => {
      const secret = 'super_secret_webhook_token_abc';
      const hash1 = crypto.createHash('sha256').update(secret).digest();
      const hash2 = crypto.createHash('sha256').update(secret).digest();
      const hashDiff = crypto.createHash('sha256').update('different_token').digest();

      expect(crypto.timingSafeEqual(hash1, hash2)).toBe(true);
      expect(crypto.timingSafeEqual(hash1, hashDiff)).toBe(false);
    });

    it('TC-191: Di production tanpa MAYAR_API_KEY, webhook membalas 503 Service Unavailable', async () => {
      const token = 'valid_token_xyz';
      process.env.MAYAR_WEBHOOK_TOKEN = token;
      setNodeEnv('production');
      delete process.env.MAYAR_API_KEY;

      const hasil = await prosesWebhookMayarService(
        token,
        JSON.stringify({ event: 'payment.received' })
      );

      expect(hasil.status).toBe(503);
      expect(hasil.message).toContain('Layanan Mayar belum dikonfigurasi di lingkungan produksi');
    });

    it('TC-181: Menolak HTTP method selain POST dengan 405 Method Not Allowed', async () => {
      const resGet = await webhookGet();
      expect(resGet.status).toBe(405);
      expect(resGet.headers.get('Allow')).toBe('POST');

      const resPut = await webhookPut();
      expect(resPut.status).toBe(405);
      expect(resPut.headers.get('Allow')).toBe('POST');
    });

    it('TC-182: Menolak muatan webhook melebihi batas 100 KB dengan 413 Payload Too Large', async () => {
      const token = 'valid_token_1234567890';
      process.env.MAYAR_WEBHOOK_TOKEN = token;
      setNodeEnv('development');

      const bigPayload = 'x'.repeat(105 * 1024);
      const hasil = await prosesWebhookMayarService(token, bigPayload);

      expect(hasil.status).toBe(413);
      expect(hasil.message).toContain('Ukuran muatan webhook melebihi batas 100 KB');
    });

    it('TC-183: Menolak muatan JSON rusak dengan 400 Bad Request', async () => {
      const token = 'valid_token_1234567890';
      process.env.MAYAR_WEBHOOK_TOKEN = token;
      setNodeEnv('development');

      const brokenJson = '{ event: "payment.received", broken ';
      const hasil = await prosesWebhookMayarService(token, brokenJson);

      expect(hasil.status).toBe(400);
      expect(hasil.message).toContain('Format JSON muatan webhook rusak');
    });
  });

  describe('3. Alur Idempotensi, Pengecekan Ulang Gateway & Pelunasan (Butir 1 & 4)', () => {
    const validToken = 'my_secure_webhook_token';

    beforeEach(() => {
      process.env.MAYAR_WEBHOOK_TOKEN = validToken;
      setNodeEnv('development');
      process.env.MAYAR_MOCK = 'true';
    });

    it('TC-185: Webhook palsu (cek ulang getInvoice menunjukkan status unpaid) -> status tidak berubah', async () => {
      const mockClient = new MockMayarClient();
      mockClient.simulatedStatus = 'unpaid';

      // Mock DB: cari tagihan ditemukan
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'rpc_sistem_cari_tagihan_mayar') {
          return Promise.resolve({
            data: [
              {
                id: 'tagihan_001',
                pesanan_jual_id: 'pesanan_001',
                mayar_invoice_id: 'inv_mayar_001',
                mayar_transaction_id: null,
                tautan: 'https://pay.mayar.club/p/inv_mayar_001',
                jumlah: 500000,
                status: 'dibuat',
                berlaku_sampai: '2026-11-01T00:00:00Z',
              },
            ],
            error: null,
          });
        }
        if (fn === 'rpc_sistem_cek_webhook_event_selesai') {
          return Promise.resolve({ data: false, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const payload = JSON.stringify({
        event: 'payment.received',
        data: {
          id: 'inv_mayar_001',
          status: 'paid', // payload palsu mengaku paid
          amount: 500000,
        },
      });

      const res = await prosesWebhookMayarService(validToken, payload, mockClient);

      expect(res.status).toBe(200);
      expect(res.message).toContain('Invoice Not Paid on Gateway');
      // Pastikan pelunasan TIDAK dipanggil ke database
      expect(mockRpc).not.toHaveBeenCalledWith(
        'rpc_sistem_lunaskan_dari_mayar',
        expect.anything()
      );
    });

    it('TC-186: Webhook ganda -> event kedua dibalas 200 duplikat dan tidak memproses ulang', async () => {
      const mockClient = new MockMayarClient();
      mockClient.simulatedStatus = 'paid';

      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'rpc_sistem_cari_tagihan_mayar') {
          return Promise.resolve({
            data: [
              {
                id: 'tagihan_001',
                pesanan_jual_id: 'pesanan_001',
                mayar_invoice_id: 'inv_mayar_001',
                jumlah: 500000,
                status: 'dibuat',
              },
            ],
            error: null,
          });
        }
        if (fn === 'rpc_sistem_cek_webhook_event_selesai') {
          // Event sudah tercatat selesai sebelumnya
          return Promise.resolve({ data: true, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const payload = JSON.stringify({
        event: 'payment.received',
        data: {
          id: 'inv_mayar_001',
          status: 'paid',
          amount: 500000,
        },
      });

      const res = await prosesWebhookMayarService(validToken, payload, mockClient);

      expect(res.status).toBe(200);
      expect(res.message).toContain('Duplicate Event Already Processed');
      // Gateway getInvoice dan rpc_sistem_lunaskan TIDAK dipanggil ulang
      expect(mockRpc).not.toHaveBeenCalledWith(
        'rpc_sistem_lunaskan_dari_mayar',
        expect.anything()
      );
    });

    it('TC-187: getInvoice timeout -> membalas 500 dan event tidak selesai; retry berikutnya berhasil', async () => {
      const mockClient = new MockMayarClient();
      mockClient.shouldFailNetwork = true; // Simulasi timeout gateway

      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'rpc_sistem_cari_tagihan_mayar') {
          return Promise.resolve({
            data: [
              {
                id: 'tagihan_001',
                pesanan_jual_id: 'pesanan_001',
                mayar_invoice_id: 'inv_mayar_001',
                jumlah: 500000,
                status: 'dibuat',
              },
            ],
            error: null,
          });
        }
        if (fn === 'rpc_sistem_cek_webhook_event_selesai') {
          return Promise.resolve({ data: false, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const payload = JSON.stringify({
        event: 'payment.received',
        data: { id: 'inv_mayar_001', amount: 500000 },
      });

      // 1. Percobaan Pertama: Gateway Timeout
      const res1 = await prosesWebhookMayarService(validToken, payload, mockClient);
      expect(res1.status).toBe(500);
      expect(res1.message).toContain('Gateway Verification Timeout');

      // 2. Percobaan Kedua (Retry): Gateway pulih
      mockClient.shouldFailNetwork = false;
      mockClient.simulatedStatus = 'paid';
      mockClient.simulatedAmount = 500000;

      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'rpc_sistem_cari_tagihan_mayar') {
          return Promise.resolve({
            data: [{ id: 'tagihan_001', pesanan_jual_id: 'pesanan_001', mayar_invoice_id: 'inv_mayar_001', jumlah: 500000 }],
            error: null,
          });
        }
        if (fn === 'rpc_sistem_cek_webhook_event_selesai') {
          return Promise.resolve({ data: false, error: null });
        }
        if (fn === 'rpc_sistem_lunaskan_dari_mayar') {
          return Promise.resolve({
            data: { success: true, status: 'lunas', message: 'Pesanan berhasil dilunasi via Mayar' },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const res2 = await prosesWebhookMayarService(validToken, payload, mockClient);
      expect(res2.status).toBe(200);
      expect(res2.message).toContain('Pesanan berhasil dilunasi via Mayar');
    });

    it('TC-188: Anomali nominal tidak cocok -> ditandai perlu_tinjau dan pesanan tidak berubah', async () => {
      const mockClient = new MockMayarClient();
      mockClient.simulatedStatus = 'paid';
      mockClient.simulatedAmount = 400000; // Nominal beda dengan tagihan 500000

      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'rpc_sistem_cari_tagihan_mayar') {
          return Promise.resolve({
            data: [{ id: 'tagihan_001', pesanan_jual_id: 'pesanan_001', mayar_invoice_id: 'inv_mayar_001', jumlah: 500000 }],
            error: null,
          });
        }
        if (fn === 'rpc_sistem_cek_webhook_event_selesai') {
          return Promise.resolve({ data: false, error: null });
        }
        if (fn === 'rpc_sistem_lunaskan_dari_mayar') {
          // RPC mengembalikan status perlu_tinjau
          return Promise.resolve({
            data: { success: false, status: 'perlu_tinjau', message: 'Nominal terverifikasi tidak sesuai' },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const payload = JSON.stringify({
        event: 'payment.received',
        data: { id: 'inv_mayar_001', amount: 400000 },
      });

      const res = await prosesWebhookMayarService(validToken, payload, mockClient);
      expect(res.status).toBe(200);
      expect(res.message).toContain('Nominal terverifikasi tidak sesuai');
    });

    it('TC-189: Pesanan bukan status dikirim / sudah lunas -> dialihkan ke perlu_tinjau', async () => {
      const mockClient = new MockMayarClient();
      mockClient.simulatedStatus = 'paid';
      mockClient.simulatedAmount = 500000;

      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'rpc_sistem_cari_tagihan_mayar') {
          return Promise.resolve({
            data: [{ id: 'tagihan_001', pesanan_jual_id: 'pesanan_001', mayar_invoice_id: 'inv_mayar_001', jumlah: 500000 }],
            error: null,
          });
        }
        if (fn === 'rpc_sistem_cek_webhook_event_selesai') {
          return Promise.resolve({ data: false, error: null });
        }
        if (fn === 'rpc_sistem_lunaskan_dari_mayar') {
          return Promise.resolve({
            data: { success: false, status: 'perlu_tinjau', message: 'Pesanan sudah berstatus lunas (potensi pembayaran ganda)' },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const payload = JSON.stringify({
        event: 'payment.received',
        data: { id: 'inv_mayar_001', amount: 500000 },
      });

      const res = await prosesWebhookMayarService(validToken, payload, mockClient);
      expect(res.status).toBe(200);
      expect(res.message).toContain('Pesanan sudah berstatus lunas');
    });

    it('TC-190: Dua webhook paralel untuk tagihan yang sama -> ditangani idempoten', async () => {
      const mockClient = new MockMayarClient();
      mockClient.simulatedStatus = 'paid';
      mockClient.simulatedAmount = 500000;

      let callCount = 0;
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'rpc_sistem_cari_tagihan_mayar') {
          return Promise.resolve({
            data: [{ id: 'tagihan_001', pesanan_jual_id: 'pesanan_001', mayar_invoice_id: 'inv_mayar_001', jumlah: 500000 }],
            error: null,
          });
        }
        if (fn === 'rpc_sistem_cek_webhook_event_selesai') {
          callCount++;
          // Panggilan pertama belum selesai (false), panggilan kedua sudah selesai (true)
          return Promise.resolve({ data: callCount > 1, error: null });
        }
        if (fn === 'rpc_sistem_lunaskan_dari_mayar') {
          return Promise.resolve({
            data: { success: true, status: 'lunas', message: 'Pesanan berhasil dilunasi via Mayar' },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const payload = JSON.stringify({
        event: 'payment.received',
        data: { id: 'inv_mayar_001', amount: 500000 },
      });

      // Jalankan paralel
      const [res1, res2] = await Promise.all([
        prosesWebhookMayarService(validToken, payload, mockClient),
        prosesWebhookMayarService(validToken, payload, mockClient),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      // Salah satu melunasi, yang satu mengidentifikasi duplikat
      const messages = [res1.message, res2.message];
      expect(messages).toContain('Pesanan berhasil dilunasi via Mayar');
      expect(messages).toContain('Duplicate Event Already Processed');
    });
  });

  describe('4. Webhook Route Integration (TC-184)', () => {
    it('TC-184: Route POST /api/webhooks/mayar/[token] mengembalikan respons JSON terstruktur', async () => {
      const token = 'route_test_token_123';
      process.env.MAYAR_WEBHOOK_TOKEN = token;
      setNodeEnv('development');

      const req = new NextRequest(`http://localhost:3000/api/webhooks/mayar/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'unhandled.event' }),
      });

      const response = await webhookPost(req, {
        params: Promise.resolve({ token }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.ok).toBe(true);
      expect(json.pesan).toContain('Event diabaikan');
    });
  });

  describe('5. Dinamisasi Domain Produksi & Redirect URL Mayar (TC-247)', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      delete process.env.APP_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.URL;
      delete process.env.DEPLOY_PRIME_URL;
    });

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('TC-247.1: Menggunakan clientOrigin peramban (window.location.origin) saat aksi dipicu di live Netlify', () => {
      const liveOrigin = 'https://erp-sinar-abadi-niaga.rossalivia.site';
      const baseUrl = getAppBaseUrl(liveOrigin);
      expect(baseUrl).toBe('https://erp-sinar-abadi-niaga.rossalivia.site');
    });

    it('TC-247.2: Menggunakan domain produksi Netlify jika di lingkungan non-development tanpa env localhost', () => {
      setNodeEnv('production');
      const baseUrl = getAppBaseUrl();
      expect(baseUrl).toBe('https://erp-sinar-abadi-niaga.rossalivia.site');
    });

    it('TC-247.3: Menghormati variabel lingkungan URL (Netlify site URL) jika tersedia', () => {
      process.env.URL = 'https://custom-deploy.netlify.app';
      const baseUrl = getAppBaseUrl();
      expect(baseUrl).toBe('https://custom-deploy.netlify.app');
    });

    it('TC-247.4: Tidak membocorkan localhost ke URL redirect di lingkungan produksi Netlify', () => {
      setNodeEnv('production');
      process.env.APP_URL = 'http://localhost:3000'; // Kasus tertinggal di .env
      const baseUrl = getAppBaseUrl();
      expect(baseUrl).not.toContain('localhost');
      expect(baseUrl).toBe('https://erp-sinar-abadi-niaga.rossalivia.site');
    });

    it('TC-247.5: HttpMayarClient menyertakan redirectUrl, redirect_url, dan success_url secara serentak ke API Mayar', async () => {
      let capturedBody: Record<string, unknown> | null = null;
      const originalFetch = global.fetch;

      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedBody = JSON.parse(options.body as string);
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'inv_mock_123',
              link: 'https://pay.mayar.io/p/inv_mock_123',
            },
          }),
        };
      });

      try {
        const client = new HttpMayarClient('test_api_key', 'https://api.mayar.io/hl/v1');
        const expectedRedirect = 'https://erp-sinar-abadi-niaga.rossalivia.site/pembayaran/selesai';

        await client.createInvoice({
          name: 'Toko Test',
          email: 'toko@example.com',
          mobile: '08123456789',
          redirectUrl: expectedRedirect,
          description: 'Test Tagihan',
          expiredAt: '2026-10-30T00:00:00Z',
          items: [{ description: 'Barang A', quantity: 1, rate: 100000 }],
          extraData: { noCustomer: 'PEL-01', idProd: 'SO-01' },
        });

        expect(capturedBody).not.toBeNull();
        const payload = capturedBody as unknown as Record<string, unknown>;
        expect(payload.redirectUrl).toBe(expectedRedirect);
        expect(payload.redirect_url).toBe(expectedRedirect);
        expect(payload.success_url).toBe(expectedRedirect);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
