import { describe, it, expect } from 'vitest';
import { pesananItemInputSchema } from '../schemas';
import { hitungSubtotal } from '../utils';

// Helper simulasi logika aturan bisnis BR-04 & batas diskon
interface ItemSimulasi {
  barang_id: string;
  kode: string;
  jumlah: number;
  harga_satuan: number;
  diskon_persen: number;
  hpp_satuan: number;
}

interface PesananSimulasi {
  nomor: string;
  pelanggan_id: string;
  status: string;
  items: ItemSimulasi[];
  persetujuan_status?: 'menunggu' | 'disetujui' | 'ditolak' | 'terpakai' | 'kedaluwarsa';
}

function simulasiValidasiDraf(
  peran: 'penjualan' | 'manajer' | 'gudang',
  items: Array<{ diskon_persen: number; jumlah: number; harga_satuan: number }>
) {
  if (peran !== 'penjualan' && peran !== 'manajer') {
    throw { code: 'E0001', message: 'Akses ditolak' };
  }

  for (const it of items) {
    if (it.jumlah < 1) {
      throw { code: 'E0004', message: 'Jumlah minimal 1' };
    }
    if (peran === 'penjualan' && it.diskon_persen > 10) {
      throw { code: 'E0009', message: 'Diskon harus 0% sampai 10%' };
    }
    if (it.diskon_persen > 25) {
      throw { code: 'E0010', message: 'Diskon harus 0% sampai 25%' };
    }
  }

  return { success: true };
}

function simulasiKonfirmasiPesanan(
  peran: 'penjualan' | 'manajer' | 'gudang',
  pesanan: PesananSimulasi
) {
  if (peran !== 'penjualan' && peran !== 'manajer') {
    throw { code: 'E0001', message: 'Akses ditolak' };
  }

  if (pesanan.status !== 'draf') {
    throw { code: 'E0015', message: 'Perpindahan status atau tindakan tidak diizinkan' };
  }

  // 1. Cek diskon per baris
  for (const item of pesanan.items) {
    if (peran === 'penjualan' && item.diskon_persen > 10) {
      throw { code: 'E0009', message: 'Diskon harus 0% sampai 10%' };
    }
    if (item.diskon_persen > 25) {
      throw { code: 'E0010', message: 'Diskon harus 0% sampai 25%' };
    }
  }

  // 2. Deteksi harga di bawah HPP
  let adaBawahHpp = false;
  for (const item of pesanan.items) {
    const subtotal = hitungSubtotal(item.jumlah, item.harga_satuan, item.diskon_persen);
    if (subtotal < item.hpp_satuan * item.jumlah) {
      adaBawahHpp = true;
      break;
    }
  }

  // PENEGASAN MUTLAK BR-04:
  // Staf Penjualan SELALU DITOLAK bila ada baris di bawah HPP dengan pesan persis
  // "Harga di bawah batas, minta persetujuan Manajer" (E0011).
  // Bahkan bila tiket persetujuan statusnya 'disetujui', Staf tidak boleh mengonfirmasi.
  if (peran === 'penjualan' && adaBawahHpp) {
    throw { code: 'E0011', message: 'Harga di bawah batas, minta persetujuan Manajer' };
  }

  // Jika Manajer yang mengonfirmasi:
  let persetujuanStatus = pesanan.persetujuan_status;
  if (peran === 'manajer' && pesanan.persetujuan_status === 'disetujui') {
    persetujuanStatus = 'terpakai';
  }

  return {
    success: true,
    status: 'dikonfirmasi',
    persetujuan_status: persetujuanStatus,
  };
}

describe('Penegasan Aturan BR-04 dan Pengetatan Diskon', () => {
  describe('1. Skema Input Zod & Dukungan Desimal (2,5%)', () => {
    it('menerima diskon dengan format koma "2,5" dan mengubahnya menjadi 2.5', () => {
      const parsed = pesananItemInputSchema.safeParse({
        barang_id: 'a20ca835-806e-544e-9247-9007f1c3b29b',
        jumlah: 5,
        diskon_persen: '2,5',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.diskon_persen).toBe(2.5);
      }
    });

    it('menerima diskon dengan format desimal titik "2.5"', () => {
      const parsed = pesananItemInputSchema.safeParse({
        barang_id: 'a20ca835-806e-544e-9247-9007f1c3b29b',
        jumlah: 5,
        diskon_persen: 2.5,
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.diskon_persen).toBe(2.5);
      }
    });

    it('menolak diskon > 25% untuk semua peran dengan pesan E0010', () => {
      const parsed = pesananItemInputSchema.safeParse({
        barang_id: 'a20ca835-806e-544e-9247-9007f1c3b29b',
        jumlah: 1,
        diskon_persen: 26,
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain('Diskon harus 0% sampai 25%');
      }
    });
  });

  describe('2. Perhitungan Subtotal dan Pembulatan Rupiah Terdekat (BR-03)', () => {
    it('menghitung subtotal dengan desimal 2,5% secara presisi', () => {
      // 10 unit * Rp100.000 * (100 - 2.5)% = Rp975.000
      const subtotal = hitungSubtotal(10, 100000, 2.5);
      expect(subtotal).toBe(975000);
    });

    it('membulatkan subtotal desimal ke rupiah terdekat', () => {
      // 1 unit * Rp100.005 * (100 - 2.5)% = Rp97.504,875 -> dibulatkan ke Rp97.505
      const subtotal = hitungSubtotal(1, 100005, 2.5);
      expect(subtotal).toBe(97505);
    });
  });

  describe('3. Penolakan Keras Diskon > 10% untuk Staf Penjualan (Bukan Clamp)', () => {
    it('staf penjualan mengirim diskon 11% ditolak dengan E0009', () => {
      expect(() => {
        simulasiValidasiDraf('penjualan', [
          { jumlah: 1, harga_satuan: 100000, diskon_persen: 11 },
        ]);
      }).toThrowError();

      try {
        simulasiValidasiDraf('penjualan', [
          { jumlah: 1, harga_satuan: 100000, diskon_persen: 11 },
        ]);
      } catch (err: unknown) {
        const error = err as { code: string; message: string };
        expect(error.code).toBe('E0009');
        expect(error.message).toBe('Diskon harus 0% sampai 10%');
      }
    });

    it('staf penjualan mengirim diskon 10% diterima', () => {
      const res = simulasiValidasiDraf('penjualan', [
        { jumlah: 1, harga_satuan: 100000, diskon_persen: 10 },
      ]);
      expect(res.success).toBe(true);
    });

    it('manajer diizinkan memberikan diskon hingga 25%', () => {
      const res = simulasiValidasiDraf('manajer', [
        { jumlah: 1, harga_satuan: 100000, diskon_persen: 20 },
      ]);
      expect(res.success).toBe(true);
    });
  });

  describe('4. Pengujian dengan Data Contoh: SO-00043 dan SO-00044', () => {
    // Data SO-00043 dari seed.sql:
    // Item 1: BRG-007 (Kecap Manis), qty: 2, harga: 186.000, diskon: 10%, HPP: 166.000
    // Harga net = 167.400 > 166.000 (di atas HPP)
    // Item 2: BRG-012 (Sabun Cuci), qty: 1, harga: 168.000, diskon: 10%, HPP: 148.000
    // Harga net = 151.200 > 148.000 (di atas HPP)
    const pesananSO43: PesananSimulasi = {
      nomor: 'SO-00043',
      pelanggan_id: 'ecb2b2af-b87c-51d7-8050-ca88d487c764',
      status: 'draf',
      items: [
        {
          barang_id: '75bc9358-ec31-57bc-a48e-112d0290fafa',
          kode: 'BRG-007',
          jumlah: 2,
          harga_satuan: 186000,
          diskon_persen: 10,
          hpp_satuan: 166000,
        },
        {
          barang_id: 'f546ffa5-cfb6-559b-b0f3-c68d26fa2b71',
          kode: 'BRG-012',
          jumlah: 1,
          harga_satuan: 168000,
          diskon_persen: 10,
          hpp_satuan: 148000,
        },
      ],
    };

    // Data SO-00044 dari seed.sql:
    // Item 1: BRG-002 (Gula Pasir 1 kg isi 20), qty: 1, harga: 362.000, diskon: 10%, HPP: 341.000
    // Harga net = 325.800 < 341.000 (DI BAWAH HPP!)
    const pesananSO44: PesananSimulasi = {
      nomor: 'SO-00044',
      pelanggan_id: 'ecb2b2af-b87c-51d7-8050-ca88d487c764',
      status: 'draf',
      items: [
        {
          barang_id: '671e7a37-5f79-5adc-a3b9-c9b01ac33e36',
          kode: 'BRG-002',
          jumlah: 1,
          harga_satuan: 362000,
          diskon_persen: 10,
          hpp_satuan: 341000,
        },
      ],
    };

    it('SO-00043: Staf Penjualan BERHASIL mengonfirmasi pesanan (tidak ada baris di bawah HPP)', () => {
      const res = simulasiKonfirmasiPesanan('penjualan', pesananSO43);
      expect(res.success).toBe(true);
      expect(res.status).toBe('dikonfirmasi');
    });

    it('SO-00044: Staf Penjualan DITOLAK dengan pesan persis "Harga di bawah batas, minta persetujuan Manajer" (E0011)', () => {
      try {
        simulasiKonfirmasiPesanan('penjualan', pesananSO44);
        expect.unreachable('Seharusnya melempar exception E0011');
      } catch (err: unknown) {
        const error = err as { code: string; message: string };
        expect(error.code).toBe('E0011');
        expect(error.message).toBe('Harga di bawah batas, minta persetujuan Manajer');
        // Pastikan tidak ada angka harga pokok yang bocor di pesan
        expect(error.message).not.toContain('341000');
        expect(error.message).not.toContain('hpp');
      }
    });

    it('SO-00044: Staf Penjualan TETAP DITOLAK meskipun tiket persetujuan sudah disetujui (BR-04 Ketat)', () => {
      const pesananSO44Disetujui: PesananSimulasi = {
        ...pesananSO44,
        persetujuan_status: 'disetujui',
      };

      try {
        simulasiKonfirmasiPesanan('penjualan', pesananSO44Disetujui);
        expect.unreachable('Staf tidak boleh mengonfirmasi pesanan di bawah HPP meskipun tiket disetujui');
      } catch (err: unknown) {
        const error = err as { code: string; message: string };
        expect(error.code).toBe('E0011');
        expect(error.message).toBe('Harga di bawah batas, minta persetujuan Manajer');
      }
    });

    it('SO-00044: Manajer BERHASIL mengonfirmasi pesanan dan menandai persetujuan terpakai', () => {
      const pesananSO44Disetujui: PesananSimulasi = {
        ...pesananSO44,
        persetujuan_status: 'disetujui',
      };

      const res = simulasiKonfirmasiPesanan('manajer', pesananSO44Disetujui);
      expect(res.success).toBe(true);
      expect(res.status).toBe('dikonfirmasi');
      expect(res.persetujuan_status).toBe('terpakai');
    });
  });

  describe('5. Usulan: Mencegah Draf yang Diedit Manajer Dikonfirmasi Staf', () => {
    // Skenario: Manajer membuat/mengedit draf dengan diskon 15% (sah untuk Manajer).
    // Jika kemudian Staf Penjualan memanggil rpc_konfirmasi_pesanan, harus DITOLAK dengan E0009.
    const pesananDiskon15: PesananSimulasi = {
      nomor: 'SO-DRAFT-MGR-DISCOUNT',
      pelanggan_id: 'ecb2b2af-b87c-51d7-8050-ca88d487c764',
      status: 'draf',
      items: [
        {
          barang_id: '75bc9358-ec31-57bc-a48e-112d0290fafa',
          kode: 'BRG-007',
          jumlah: 1,
          harga_satuan: 186000,
          diskon_persen: 15, // Diskon di atas batas staf (10%)
          hpp_satuan: 100000,
        },
      ],
    };

    it('konfirmasi oleh Staf Penjualan DITOLAK bila ada baris dengan diskon > 10%', () => {
      try {
        simulasiKonfirmasiPesanan('penjualan', pesananDiskon15);
        expect.unreachable('Staf Penjualan tidak boleh mengonfirmasi pesanan dengan diskon > 10%');
      } catch (err: unknown) {
        const error = err as { code: string; message: string };
        expect(error.code).toBe('E0009');
        expect(error.message).toBe('Diskon harus 0% sampai 10%');
      }
    });

    it('konfirmasi pesanan diskon 15% oleh Manajer BERHASIL', () => {
      const res = simulasiKonfirmasiPesanan('manajer', pesananDiskon15);
      expect(res.success).toBe(true);
      expect(res.status).toBe('dikonfirmasi');
    });
  });
});
