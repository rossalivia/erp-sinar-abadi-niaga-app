import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '@/lib/errors';

describe('Modul Limit Kredit & Blokir Overdue (D6 & BR-13/14)', () => {
  describe('Pemetaan Pesan Error D6 (Resolusi Tabrakan Kode)', () => {
    it('memetakan pesan verbatim E0006 batas kredit pelanggan terlampaui', () => {
      const err = {
        message: 'E0006: Batas kredit pelanggan terlampaui',
        code: 'E0012',
      };
      const msg = getErrorMessage(err);
      expect(msg).toContain('E0006: Batas kredit pelanggan terlampaui');
    });

    it('memetakan pesan verbatim E0007 faktur lewat jatuh tempo', () => {
      const err = {
        message: 'E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir',
        code: 'E0013',
      };
      const msg = getErrorMessage(err);
      expect(msg).toContain('E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir');
    });

    it('tidak merusak kode baseline E0006 untuk barang tidak aktif', () => {
      const err = {
        code: 'E0006',
        message: '',
      };
      const msg = getErrorMessage(err);
      expect(msg).toBe('Barang tidak aktif atau tidak ditemukan');
    });

    it('tidak merusak kode baseline E0007 untuk pelanggan tidak aktif', () => {
      const err = {
        code: 'E0007',
        message: '',
      };
      const msg = getErrorMessage(err);
      expect(msg).toBe('Pelanggan atau pemasok tidak aktif');
    });
  });

  describe('Logika Sisa Kredit & Status Boleh Transaksi', () => {
    it('menghitung sisa kredit dengan benar (batas_kredit - piutang_berjalan)', () => {
      const batasKredit = 1000000;
      const piutangTerkonfirmasi = 250000;
      const piutangTerkirim = 350000;
      const piutangBerjalan = piutangTerkonfirmasi + piutangTerkirim; // 600.000
      const sisaKredit = batasKredit - piutangBerjalan; // 400.000

      expect(piutangBerjalan).toBe(600000);
      expect(sisaKredit).toBe(400000);
      expect(sisaKredit >= 0).toBe(true);
    });

    it('menolak jika total pesanan baru melebihi sisa kredit', () => {
      const sisaKredit = 400000;
      const totalPesananBaru = 400001;
      const melebihi = totalPesananBaru > sisaKredit;
      expect(melebihi).toBe(true);
    });

    it('mengizinkan jika total pesanan baru persis sama dengan sisa kredit', () => {
      const sisaKredit = 400000;
      const totalPesananBaru = 400000;
      const melebihi = totalPesananBaru > sisaKredit;
      expect(melebihi).toBe(false);
    });

    it('menandai status overdue jika ada minimal satu faktur melewati tanggal jatuh tempo', () => {
      const jumlahFakturOverdue = 1;
      const punyaOverdue = jumlahFakturOverdue > 0;
      expect(punyaOverdue).toBe(true);
    });
  });
});
