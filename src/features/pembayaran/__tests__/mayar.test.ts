import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import {
  MockMayarClient,
  HttpMayarClient,
  getMayarClient,
} from '../mayar-client';
import {
  prosesWebhookMayarService,
} from '../service';
import { GET as webhookGet, PUT as webhookPut, POST as webhookPost } from '@/app/api/webhooks/mayar/[token]/route';

describe('Modul Tautan Bayar Piutang lewat Mayar (PRD 11.3)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('1. MayarClient Abstraction & Mock Simulation (TC-173)', () => {
    it('TC-173: MockMayarClient dapat membuat, membaca, dan menutup tagihan tanpa third-party', async () => {
      const mock = new MockMayarClient();

      const created = await mock.createInvoice({
        name: 'Toko Berkah',
        email: 'toko@example.com',
        mobile: '081234567890',
        description: 'Pembayaran Pesanan SO-001',
        expiredAt: new Date(Date.now() + 86400000).toISOString(),
        redirectUrl: 'http://localhost:3000/pembayaran/selesai',
        items: [
          {
            description: 'Pembayaran Pesanan SO-001',
            quantity: 1,
            rate: 500000,
          },
        ],
        extraData: {
          noCustomer: 'CUST-001',
          idProd: 'SO-001',
        },
      });

      expect(created.id).toMatch(/^inv_sim_/);
      expect(created.link).toContain(created.id);
      expect(created.amount).toBe(500000);

      // Baca invoice
      const fetched = await mock.getInvoice(created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.status).toBe('unpaid');

      // Tutup invoice
      await mock.closeInvoice(created.id);
      const afterClose = await mock.getInvoice(created.id);
      expect(afterClose.status).toBe('closed');
    });

    it('TC-173: getMayarClient mengembalikan MockMayarClient saat MAYAR_API_KEY kosong', () => {
      delete process.env.MAYAR_API_KEY;
      const client = getMayarClient();
      expect(client).toBeInstanceOf(MockMayarClient);
    });

    it('TC-173: HttpMayarClient mengirim Bearer token dan header yang benar', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          statusCode: 200,
          data: {
            id: 'inv_real_123',
            link: 'https://sandbox.mayar.id/pay/inv_real_123',
            status: 'unpaid',
            amount: 750000,
          },
        }),
      });
      global.fetch = mockFetch;

      const client = new HttpMayarClient('test_api_key_secret');
      const invoice = await client.createInvoice({
        name: 'Pelanggan A',
        email: 'pelanggan@example.com',
        mobile: '08123456789',
        description: 'Tagihan Faktur #1',
        expiredAt: '2026-10-25T00:00:00Z',
        redirectUrl: 'http://localhost:3000/pembayaran/selesai',
        items: [
          {
            description: 'Tagihan Faktur #1',
            quantity: 1,
            rate: 750000,
          },
        ],
        extraData: {
          noCustomer: 'CUST-002',
          idProd: 'SO-002',
        },
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.mayar.club/hl/v1/invoice/create');
      expect(init.headers['Authorization']).toBe('Bearer test_api_key_secret');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(invoice.id).toBe('inv_real_123');
    });
  });

  describe('2. Keamanan & Validasi Route Webhook (TC-179, TC-180, TC-181, TC-182, TC-183)', () => {
    it('TC-181: Menolak HTTP method selain POST dengan 405 Method Not Allowed', async () => {
      const resGet = await webhookGet();
      expect(resGet.status).toBe(405);
      expect(resGet.headers.get('Allow')).toBe('POST');

      const resPut = await webhookPut();
      expect(resPut.status).toBe(405);
      expect(resPut.headers.get('Allow')).toBe('POST');
    });

    it('TC-179, TC-180: Menolak webhook token yang salah dengan 404 Not Found (constant-time)', async () => {
      process.env.MAYAR_WEBHOOK_TOKEN = 'secret_webhook_token_xyz_12345';

      const hasilSalah = await prosesWebhookMayarService(
        'token_salah_tidak_cocok',
        JSON.stringify({ event: 'payment.received' })
      );

      expect(hasilSalah.status).toBe(404);
      expect(hasilSalah.message).toContain('Endpoint webhook tidak valid');
    });

    it('TC-182: Menolak muatan webhook melebihi batas 100 KB dengan 413 Payload Too Large', async () => {
      const token = 'valid_token_1234567890';
      process.env.MAYAR_WEBHOOK_TOKEN = token;

      // Payload 105 KB
      const bigPayload = 'x'.repeat(105 * 1024);
      const hasil = await prosesWebhookMayarService(token, bigPayload);

      expect(hasil.status).toBe(413);
      expect(hasil.message).toContain('Ukuran muatan webhook melebihi batas 100 KB');
    });

    it('TC-183: Menolak muatan JSON rusak dengan 400 Bad Request', async () => {
      const token = 'valid_token_1234567890';
      process.env.MAYAR_WEBHOOK_TOKEN = token;

      const brokenJson = '{ event: "payment.received", broken ';
      const hasil = await prosesWebhookMayarService(token, brokenJson);

      expect(hasil.status).toBe(400);
      expect(hasil.message).toContain('Format JSON muatan webhook rusak');
    });

    it('TC-180: Mengabaikan event selain payment.received tanpa error sistem', async () => {
      const token = 'valid_token_1234567890';
      process.env.MAYAR_WEBHOOK_TOKEN = token;

      const payload = JSON.stringify({
        event: 'invoice.created',
        data: { id: 'inv_123' },
      });

      const hasil = await prosesWebhookMayarService(token, payload);
      expect(hasil.status).toBe(200);
      expect(hasil.message).toContain('Event diabaikan');
    });
  });

  describe('3. Constant-Time TimingSafeEqual Guard Logic (TC-179)', () => {
    it('TC-179: Memastikan timingSafeEqual bekerja konsisten pada panjang sama maupun beda', () => {
      const secret = 'super_secret_webhook_token_abc';
      const secretBuffer = Buffer.from(secret, 'utf8');

      function safeCompare(input: string): boolean {
        const inputBuffer = Buffer.from(input, 'utf8');
        if (inputBuffer.length !== secretBuffer.length) {
          crypto.timingSafeEqual(secretBuffer, secretBuffer); // dummy to equalize time
          return false;
        }
        return crypto.timingSafeEqual(inputBuffer, secretBuffer);
      }

      expect(safeCompare(secret)).toBe(true);
      expect(safeCompare(secret + 'x')).toBe(false);
      expect(safeCompare('short')).toBe(false);
      expect(safeCompare('super_secret_webhook_token_abd')).toBe(false);
    });
  });

  describe('4. Webhook Route Integration (TC-184)', () => {
    it('TC-184: Route POST /api/webhooks/mayar/[token] mengembalikan respons JSON terstruktur', async () => {
      const token = 'route_test_token_123';
      process.env.MAYAR_WEBHOOK_TOKEN = token;

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
});
