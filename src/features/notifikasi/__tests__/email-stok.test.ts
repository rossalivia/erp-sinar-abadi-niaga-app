import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  escapeHtml,
  generateEmailStokMenipis,
} from '../templates';
import { MockEmailSender } from '../email-sender';
import { GET as cronGetHandler, POST as cronPostHandler } from '@/app/api/cron/notifikasi-stok/route';
import type { BarangStokMenipis } from '../types';

describe('Modul Notifikasi Email Stok Menipis (PRD 11.1)', () => {
  const dummyItems: BarangStokMenipis[] = [
    {
      kode: 'BRG-01',
      nama: 'Beras Premium <Setra Ramos> & Murah',
      satuan: 'karung',
      stok: 2,
      stok_minimum: 10,
      selisih: 8,
    },
    {
      kode: 'BRG-02',
      nama: 'Minyak "Bimoli" 2L',
      satuan: 'pouch',
      stok: 0,
      stok_minimum: 5,
      selisih: 5,
    },
  ];

  describe('1. Templates & Sanitasi HTML (TC-168, TC-169)', () => {
    it('TC-168: escapeHtml berhasil menyaring karakter berbahaya', () => {
      const raw = '<script>alert("XSS & Test \'hack\'")</script>';
      const sanitized = escapeHtml(raw);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
      expect(sanitized).toContain('&amp;');
      expect(sanitized).toContain('&quot;');
      expect(sanitized).toContain('&#039;');
    });

    it('TC-168: generateEmailStokMenipis memotong baris pada batas 100 dan meng-escape teks', () => {
      // Buat 105 barang
      const manyItems: BarangStokMenipis[] = Array.from({ length: 105 }, (_, i) => ({
        kode: `BRG-${i + 1}`,
        nama: `Barang <Test> #${i + 1}`,
        satuan: 'pcs',
        stok: i % 5,
        stok_minimum: 10,
        selisih: 10 - (i % 5),
      }));

      const res = generateEmailStokMenipis({
        items: manyItems,
        tanggalBisnis: '2026-10-23',
        isUji: false,
        isSandbox: false,
        appUrl: 'http://localhost:3000',
      });

      expect(res.subject).toBe('[ERP Sinar Abadi] 105 barang stok menipis (2026-10-23)');
      // Harus memuat pesan sisa 5 barang
      expect(res.html).toContain('dan <strong>5</strong> barang lainnya');
      expect(res.text).toContain('... dan 5 barang lainnya');
      // Tidak boleh bocor karakter mentah
      expect(res.html).not.toContain('<Test>');
      expect(res.html).toContain('&lt;Test&gt;');
    });

    it('TC-169: Zero-Leakage Data Keuangan pada Template Email', () => {
      const res = generateEmailStokMenipis({
        items: dummyItems,
        tanggalBisnis: '2026-10-23',
        isUji: false,
        isSandbox: false,
        appUrl: 'http://localhost:3000',
      });

      const forbiddenStrings = [
        'harga_pokok',
        'harga_jual',
        'subtotal',
        'diskon',
        'total',
        'hpp',
        'margin',
        'rp',
        'rupiah',
      ];

      const htmlLower = res.html.toLowerCase();
      const textLower = res.text.toLowerCase();

      for (const str of forbiddenStrings) {
        expect(htmlLower).not.toContain(` ${str} `);
        expect(textLower).not.toContain(` ${str} `);
      }
    });

    it('TC-166: Mode Sandbox memuat banner jelas dan tidak membocorkan email asli', () => {
      const res = generateEmailStokMenipis({
        items: dummyItems,
        tanggalBisnis: '2026-10-23',
        isUji: true,
        isSandbox: true,
        targetRoleSummary: '1 Manajer, 2 Staf Gudang (3 penerima)',
        appUrl: 'http://localhost:3000',
      });

      expect(res.subject).toContain('[UJI] [ERP Sinar Abadi]');
      expect(res.html).toContain('MODE UJI (SANDBOX)');
      expect(res.html).toContain('1 Manajer, 2 Staf Gudang (3 penerima)');
      expect(res.text).toContain('=== MODE UJI (SANDBOX) ===');
      // Tidak boleh membocorkan alamat email manajer@... di badan
      expect(res.html).not.toContain('@sinarabadi.test');
      expect(res.text).not.toContain('@sinarabadi.test');
    });
  });

  describe('2. Mock Email Sender (TC-167)', () => {
    it('MockEmailSender mencatat pengiriman email dan idempotency key', async () => {
      const sender = new MockEmailSender();
      const params = {
        from: 'onboarding@resend.dev',
        to: ['tester@example.com'],
        subject: 'Uji Coba',
        html: '<p>Halo</p>',
        text: 'Halo',
        idempotencyKey: 'stok-menipis/2026-10-23/tester',
      };

      const result = await sender.send(params);
      expect(result.success).toBe(true);
      expect(sender.sentEmails.length).toBe(1);
      expect(sender.sentEmails[0].idempotencyKey).toBe('stok-menipis/2026-10-23/tester');

      // Simulasi kegagalan
      sender.shouldFail = true;
      await expect(sender.send(params)).rejects.toThrow('Simulasi kegagalan koneksi SMTP Resend');
    });
  });

  describe('3. Route Handler Otentikasi Cron (TC-164, TC-165)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      process.env.CRON_SECRET = 'rahasia-cron-super-aman-12345';
    });

    it('TC-164: Request tanpa header Authorization ditolak 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/notifikasi-stok', {
        method: 'POST',
      });

      const res = await cronPostHandler(req);
      expect(res.status).toBe(401);
      expect(res.headers.get('X-Robots-Tag')).toContain('noindex');
    });

    it('TC-164: Request dengan Bearer token yang salah ditolak 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/notifikasi-stok', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token-yang-salah-dan-palsu',
        },
      });

      const res = await cronPostHandler(req);
      expect(res.status).toBe(401);
    });

    it('TC-165: Method GET ditolak dengan status 405', async () => {
      const res = await cronGetHandler();
      expect(res.status).toBe(405);
      expect(res.headers.get('Allow')).toBe('POST');
      expect(res.headers.get('X-Robots-Tag')).toContain('noindex');
    });
  });
});
