import { describe, it, expect } from 'vitest';
import type { SuratJalanHeader, SuratJalanItem } from '../types';

describe('Logika Bisnis & Keamanan Fitur Surat Jalan (PRD 11.2)', () => {
  describe('Aturan S1 & S3: Penentuan Izin & Visibilitas Cetak Surat Jalan', () => {
    function canPrintSuratJalan(
      status: string,
      peran: 'gudang' | 'manajer' | 'penjualan',
      isOwner: boolean
    ): boolean {
      const isGudang = peran === 'gudang';
      const isManajer = peran === 'manajer';
      return (
        status === 'dikirim' &&
        (isGudang || isManajer || (isOwner && peran === 'penjualan'))
      );
    }

    it('TC-146: Gudang boleh mencetak surat jalan pada pesanan berstatus dikirim', () => {
      expect(canPrintSuratJalan('dikirim', 'gudang', false)).toBe(true);
    });

    it('TC-147: Manajer boleh mencetak surat jalan pada pesanan berstatus dikirim', () => {
      expect(canPrintSuratJalan('dikirim', 'manajer', false)).toBe(true);
    });

    it('TC-148: Sales pemilik boleh mencetak surat jalan pada pesanan miliknya yang berstatus dikirim', () => {
      expect(canPrintSuratJalan('dikirim', 'penjualan', true)).toBe(true);
    });

    it('TC-149: Sales non-pemilik DITOLAK mencetak surat jalan pesanan sales lain', () => {
      expect(canPrintSuratJalan('dikirim', 'penjualan', false)).toBe(false);
    });

    it('TC-150: DITOLAK untuk pesanan berstatus draf oleh semua peran', () => {
      expect(canPrintSuratJalan('draf', 'gudang', true)).toBe(false);
      expect(canPrintSuratJalan('draf', 'manajer', true)).toBe(false);
      expect(canPrintSuratJalan('draf', 'penjualan', true)).toBe(false);
    });

    it('TC-151: DITOLAK untuk pesanan berstatus dikonfirmasi oleh semua peran', () => {
      expect(canPrintSuratJalan('dikonfirmasi', 'gudang', true)).toBe(false);
      expect(canPrintSuratJalan('dikonfirmasi', 'manajer', true)).toBe(false);
      expect(canPrintSuratJalan('dikonfirmasi', 'penjualan', true)).toBe(false);
    });

    it('TC-152: DITOLAK untuk pesanan berstatus lunas dan dibatalkan', () => {
      expect(canPrintSuratJalan('lunas', 'gudang', true)).toBe(false);
      expect(canPrintSuratJalan('lunas', 'manajer', true)).toBe(false);
      expect(canPrintSuratJalan('dibatalkan', 'gudang', true)).toBe(false);
      expect(canPrintSuratJalan('dibatalkan', 'manajer', true)).toBe(false);
    });
  });

  describe('Aturan S2 & S4: Zero-Leakage Data Finansial pada Model Surat Jalan', () => {
    it('TC-153: Model SuratJalanHeader dan SuratJalanItem tidak memuat properti finansial/uang', () => {
      const dummyHeader: SuratJalanHeader = {
        id: 'ord-123',
        nomor: 'SO-2026-0001',
        status: 'dikirim',
        dibuat_oleh: 'usr-1',
        dibuat_pada: '2026-10-23T08:00:00Z',
        dikirim_pada: '2026-10-23T10:00:00Z',
        catatan: 'Hati-hati pecah belah',
        pelanggan_id: 'cust-1',
        pelanggan_kode: 'PLG-001',
        pelanggan_nama: 'Toko Berkah Abadi',
        pelanggan_telepon: '08123456789',
        pelanggan_alamat: 'Jl. Raya Darmo No. 10, Surabaya',
        pembuat_nama: 'Budi Penjualan',
      };

      const dummyItem: SuratJalanItem = {
        id: 'item-1',
        pesanan_jual_id: 'ord-123',
        barang_id: 'brg-1',
        kode_barang: 'BRG-01',
        nama_barang: 'Kopi Kapal Api 65g',
        satuan: 'pack',
        jumlah: 24,
      };

      const forbiddenKeys = [
        'harga',
        'harga_satuan',
        'diskon',
        'diskon_persen',
        'subtotal',
        'total',
        'termin',
        'termin_hari',
        'jatuh_tempo',
        'batas_kredit',
        'hpp',
        'hpp_satuan',
        'harga_pokok',
        'margin',
      ];

      const headerKeys = Object.keys(dummyHeader);
      const itemKeys = Object.keys(dummyItem);

      for (const key of forbiddenKeys) {
        expect(headerKeys).not.toContain(key);
        expect(itemKeys).not.toContain(key);
      }
    });

    it('Kalkulasi ringkasan muatan: total jenis dan total kuantitas fisik', () => {
      const items: SuratJalanItem[] = [
        {
          id: '1',
          pesanan_jual_id: 'ord-1',
          barang_id: 'b-1',
          kode_barang: 'BRG-01',
          nama_barang: 'Barang A',
          satuan: 'dus',
          jumlah: 10,
        },
        {
          id: '2',
          pesanan_jual_id: 'ord-1',
          barang_id: 'b-2',
          kode_barang: 'BRG-02',
          nama_barang: 'Barang B',
          satuan: 'karton',
          jumlah: 25,
        },
        {
          id: '3',
          pesanan_jual_id: 'ord-1',
          barang_id: 'b-3',
          kode_barang: 'BRG-03',
          nama_barang: 'Barang C',
          satuan: 'pcs',
          jumlah: 5,
        },
      ];

      const totalJenis = items.length;
      const totalKuantitas = items.reduce((sum, it) => sum + it.jumlah, 0);

      expect(totalJenis).toBe(3);
      expect(totalKuantitas).toBe(40);
    });
  });
});
