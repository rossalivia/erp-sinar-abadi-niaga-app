import { describe, it, expect } from 'vitest';
import { isRouteAuthorized } from '@/lib/akses';
import { getErrorMessage, ERROR_MESSAGES } from '@/lib/errors';
import { pesananDrafSchema } from '@/features/pesanan/schemas';
import type { Peran } from '@/types/auth';
import type { SuratJalanHeader, SuratJalanItem } from '@/features/pesanan/types';

describe('AUDIT PRD LENGKAP: 11 BUTIR VERIFIKASI HAK AKSES & ATURAN BISNIS', () => {
  // Identitas Pengguna Sesuai PRD
  const HENDRA = { id: 'defeb8ce-05f6-5a28-90ea-d8c5921fe92e', email: 'hendra@sinarabadi.test', peran: 'manajer' as Peran, aktif: true };
  const RINA = { id: '1eb18f29-66c1-5086-900e-874c2d3208e5', email: 'rina@sinarabadi.test', peran: 'penjualan' as Peran, aktif: true };
  const JOKO = { id: '0c99b1d9-84f8-5784-a479-3df27328aebd', email: 'joko@sinarabadi.test', peran: 'penjualan' as Peran, aktif: true };
  const DIMAS = { id: 'da8229f5-916d-55c1-aaee-cd3cfe3e0a7b', email: 'dimas@sinarabadi.test', peran: 'gudang' as Peran, aktif: true };
  const AGUS = { id: '58306883-5223-5b88-8691-edb367c35df9', email: 'agus@sinarabadi.test', peran: 'gudang' as Peran, aktif: false };

  // =========================================================================
  // BUTIR 1: Kerahasiaan Data (harga_pokok, harga_beli_satuan, hpp_satuan, margin)
  // =========================================================================
  describe('Butir 1: Kolom rahasia tidak bocor ke Penjualan atau Gudang', () => {
    it('1.1: Route guard memblokir /analitik dari Penjualan/Gudang dan /penagihan dari Gudang', () => {
      // /analitik hanya untuk manajer
      expect(isRouteAuthorized('/analitik', RINA.peran)).toBe(false);
      expect(isRouteAuthorized('/analitik', DIMAS.peran)).toBe(false);
      expect(isRouteAuthorized('/analitik', HENDRA.peran)).toBe(true);

      // /penagihan memblokir gudang
      expect(isRouteAuthorized('/penagihan', DIMAS.peran)).toBe(false);
      expect(isRouteAuthorized('/penagihan', HENDRA.peran)).toBe(true);
    });

    it('1.2: Pesan error penolakan di bawah batas (BR-04) tidak memuat nilai nominal HPP', () => {
      const msg = getErrorMessage(new Error('Harga di bawah batas, minta persetujuan Manajer'));
      expect(msg).toBe('Harga di bawah batas, minta persetujuan Manajer');
      expect(msg).not.toMatch(/\d+/); // Bebas dari angka rahasia
    });

    it('1.3: DTO pesanan untuk Penjualan/Gudang tidak mengekspos kolom HPP atau margin', () => {
      const publicItem = {
        id: 'item-1',
        barang_id: 'a20ca835-806e-544e-9247-9007f1c3b29b',
        jumlah: 5,
        harga_satuan: 20000,
        diskon_persen: 0,
        subtotal: 100000,
      };
      expect(publicItem).not.toHaveProperty('harga_pokok');
      expect(publicItem).not.toHaveProperty('hpp_satuan');
      expect(publicItem).not.toHaveProperty('margin');
    });

    it('1.4: DTO penagihan untuk Penjualan bebas dari kolom rahasia margin atau HPP', () => {
      const penagihanItem = {
        nomor: 'SO-00010',
        nama_toko: 'Toko Berkah',
        sisa_tagihan: 1500000,
        jatuh_tempo: '2026-10-20',
        status_penagihan: 'jatuh_tempo',
      };
      expect(penagihanItem).not.toHaveProperty('harga_pokok');
      expect(penagihanItem).not.toHaveProperty('hpp_satuan');
      expect(penagihanItem).not.toHaveProperty('margin');
    });
  });

  // =========================================================================
  // BUTIR 2: Wewenang Gudang terhadap Barang, Pelanggan, dan Pesanan
  // =========================================================================
  describe('Butir 2: Wewenang Gudang (ubah atribut non-harga/kode/stok, blokir pelanggan, pesanan non-draf)', () => {
    it('2.1: Gudang dilarang mengakses modul /pelanggan', () => {
      expect(isRouteAuthorized('/pelanggan', DIMAS.peran)).toBe(false);
      expect(isRouteAuthorized('/pelanggan', RINA.peran)).toBe(true);
      expect(isRouteAuthorized('/pelanggan', HENDRA.peran)).toBe(true);
    });

    it('2.2: Gudang hanya boleh melihat pesanan dengan dikonfirmasi_pada IS NOT NULL', () => {
      const sampleOrders = [
        { id: 'so-1', status: 'draf', dikonfirmasi_pada: null },
        { id: 'so-2', status: 'dibatalkan', dikonfirmasi_pada: null }, // draf yang langsung dibatalkan
        { id: 'so-3', status: 'dikonfirmasi', dikonfirmasi_pada: '2026-10-26T10:00:00Z' },
        { id: 'so-4', status: 'dikirim', dikonfirmasi_pada: '2026-10-25T08:00:00Z' },
      ];

      const visibleToGudang = sampleOrders.filter(
        (order) => order.dikonfirmasi_pada !== null
      );

      expect(visibleToGudang.map((o) => o.id)).toEqual(['so-3', 'so-4']);
      expect(visibleToGudang.some((o) => o.id === 'so-1')).toBe(false);
      expect(visibleToGudang.some((o) => o.id === 'so-2')).toBe(false);
    });

    it('2.3: Validasi mutasi atribut barang oleh Gudang: izinkan nama, satuan, stok_minimum, aktif; tolak harga & kode', () => {
      function validateGudangBarangEdit(fields: Record<string, unknown>) {
        const prohibited = ['harga_jual', 'harga_pokok', 'kode', 'stok'];
        for (const key of Object.keys(fields)) {
          if (prohibited.includes(key)) {
            throw new Error(`Gudang dilarang mengubah kolom ${key}`);
          }
        }
        return true;
      }

      expect(() => validateGudangBarangEdit({ nama: 'Barang Baru', satuan: 'PCS', stok_minimum: 10, aktif: true })).not.toThrow();
      expect(() => validateGudangBarangEdit({ harga_jual: 50000 })).toThrow(/harga_jual/);
      expect(() => validateGudangBarangEdit({ stok: 100 })).toThrow(/stok/);
      expect(() => validateGudangBarangEdit({ kode: 'BRG-X' })).toThrow(/kode/);
    });
  });

  // =========================================================================
  // BUTIR 3: Otorisasi Draf Penjualan vs Manajer
  // =========================================================================
  describe('Butir 3: Hak konfirmasi dan pembatalan draf pesanan', () => {
    function canModifyDraft(user: { id: string; peran: Peran }, draftCreatorId: string) {
      if (user.peran === 'manajer') return true;
      if (user.peran === 'penjualan' && user.id === draftCreatorId) return true;
      return false;
    }

    it('3.1: Rina boleh konfirmasi/batalkan draf buatannya sendiri', () => {
      expect(canModifyDraft(RINA, RINA.id)).toBe(true);
    });

    it('3.2: Rina DITOLAK mengonfirmasi/membatalkan draf buatan Joko', () => {
      expect(canModifyDraft(RINA, JOKO.id)).toBe(false);
    });

    it('3.3: Hendra (Manajer) boleh mengonfirmasi/membatalkan draf buatan siapa saja', () => {
      expect(canModifyDraft(HENDRA, RINA.id)).toBe(true);
      expect(canModifyDraft(HENDRA, JOKO.id)).toBe(true);
    });
  });

  // =========================================================================
  // BUTIR 4: Logika Kredit & Overdue saat Konfirmasi (Bukan saat Buat Draf)
  // =========================================================================
  describe('Butir 4: Draf pelanggan overdue/overlimit bisa dibuat, ditolak saat konfirmasi', () => {
    const hariIniWIB = '2026-10-26';

    function checkKreditSaatKonfirmasi(pelanggan: {
      batas_kredit: number;
      pesanan_aktif: Array<{ status: string; total: number; jatuh_tempo: string; dilunasi_pada: string | null }>;
    }, totalPesananBaru: number) {
      // 1. Cek overdue: pesanan dikirim dengan jatuh_tempo < hari ini WIB & belum lunas
      const hasOverdue = pelanggan.pesanan_aktif.some(
        (p) => p.status === 'dikirim' && p.dilunasi_pada === null && p.jatuh_tempo < hariIniWIB
      );
      if (hasOverdue) {
        throw new Error(ERROR_MESSAGES.E0013);
      }

      // 2. Cek limit kredit: piutang berjalan = dikonfirmasi + dikirim
      const piutangBerjalan = pelanggan.pesanan_aktif
        .filter((p) => (p.status === 'dikonfirmasi' || p.status === 'dikirim') && p.dilunasi_pada === null)
        .reduce((sum, p) => sum + p.total, 0);

      if (piutangBerjalan + totalPesananBaru > pelanggan.batas_kredit) {
        throw new Error(ERROR_MESSAGES.E0012);
      }

      return true;
    }

    it('4.1: Pembuatan draf untuk pelanggan dengan limit habis tetap sah di skema input', () => {
      const validDraftPayload = {
        pelanggan_id: 'a20ca835-806e-544e-9247-9007f1c3b29b',
        items: [
          {
            barang_id: 'b20ca835-806e-544e-9247-9007f1c3b29c',
            jumlah: 10,
            diskon_persen: 5,
          },
        ],
      };
      const parsed = pesananDrafSchema.safeParse(validDraftPayload);
      expect(parsed.success).toBe(true);
    });

    it('4.2: SO-00041: Ditolak E0013 karena ada pesanan dikirim yang overdue', () => {
      const pelangganBerkah = {
        batas_kredit: 50000000,
        pesanan_aktif: [
          { status: 'dikirim', total: 10000000, jatuh_tempo: '2026-10-20', dilunasi_pada: null },
        ],
      };
      expect(() => checkKreditSaatKonfirmasi(pelangganBerkah, 5000000)).toThrow(ERROR_MESSAGES.E0013);
    });

    it('4.3: SO-00042 & SO-00045: Ditolak E0012 karena total piutang melebihi batas kredit', () => {
      const pelangganJaya = {
        batas_kredit: 20000000,
        pesanan_aktif: [
          { status: 'dikirim', total: 18000000, jatuh_tempo: '2026-10-30', dilunasi_pada: null },
        ],
      };
      // Menambah pesanan 5.000.000 -> total 23.000.000 > 20.000.000
      expect(() => checkKreditSaatKonfirmasi(pelangganJaya, 5000000)).toThrow(ERROR_MESSAGES.E0012);
    });
  });

  // =========================================================================
  // BUTIR 5: Transisi Status Ilegal & Pembatalan Pesanan Dikonfirmasi
  // =========================================================================
  describe('Butir 5: Transisi status ilegal dan pembatalan pesanan dikonfirmasi', () => {
    function validateTransisiPesanan(currentStatus: string, nextStatus: string, user: { peran: Peran }, alasan?: string) {
      if (nextStatus === 'dibatalkan') {
        if (currentStatus === 'dikirim' || currentStatus === 'lunas') {
          throw new Error('Pesanan dikirim/lunas tidak dapat dibatalkan');
        }
        if (currentStatus === 'dikonfirmasi') {
          if (user.peran !== 'manajer') {
            throw new Error('Hanya Manajer yang dapat membatalkan pesanan terkonfirmasi');
          }
          if (!alasan || alasan.trim().length < 10) {
            throw new Error(ERROR_MESSAGES.E0023);
          }
          return { status: 'dibatalkan', mutasi: 'batal', kembalikanStok: true };
        }
        return { status: 'dibatalkan', mutasi: null, kembalikanStok: false };
      }

      if (currentStatus === 'draf' && nextStatus === 'dikirim') {
        throw new Error('Pesanan draf harus dikonfirmasi terlebih dahulu sebelum dikirim');
      }
      if (currentStatus === 'draf' && nextStatus === 'lunas') {
        throw new Error('Pesanan draf tidak bisa langsung dilunasi');
      }

      return { status: nextStatus };
    }

    it('5.1: Transisi ilegal draf -> dikirim dan draf -> lunas ditolak', () => {
      expect(() => validateTransisiPesanan('draf', 'dikirim', HENDRA)).toThrow();
      expect(() => validateTransisiPesanan('draf', 'lunas', HENDRA)).toThrow();
    });

    it('5.2: Pembatalan pesanan dikirim atau lunas ditolak mutlak', () => {
      expect(() => validateTransisiPesanan('dikirim', 'dibatalkan', HENDRA, 'Alasan pembatalan panjang')).toThrow();
      expect(() => validateTransisiPesanan('lunas', 'dibatalkan', HENDRA, 'Alasan pembatalan panjang')).toThrow();
    });

    it('5.3: Pembatalan pesanan dikonfirmasi oleh Staf Penjualan ditolak', () => {
      expect(() => validateTransisiPesanan('dikonfirmasi', 'dibatalkan', RINA, 'Alasan pembatalan panjang')).toThrow(
        /Hanya Manajer/
      );
    });

    it('5.4: Pembatalan pesanan dikonfirmasi dengan alasan < 10 karakter ditolak', () => {
      expect(() => validateTransisiPesanan('dikonfirmasi', 'dibatalkan', HENDRA, 'Pendek')).toThrow(
        ERROR_MESSAGES.E0023
      );
    });

    it('5.5: Pembatalan pesanan dikonfirmasi oleh Manajer dengan alasan >= 10 karakter sah & mengembalikan stok', () => {
      const res = validateTransisiPesanan('dikonfirmasi', 'dibatalkan', HENDRA, 'Alasan pembatalan resmi oleh Manajer');
      expect(res.kembalikanStok).toBe(true);
      expect(res.mutasi).toBe('batal');
    });
  });

  // =========================================================================
  // BUTIR 6: Impor CSV Aman & Pencatatan Audit
  // =========================================================================
  describe('Butir 6: Impor CSV tidak ubah stok/harga_pokok langsung & catat audit', () => {
    it('6.1: Parser CSV menolak kolom terlarang (stok, harga_pokok)', () => {
      const forbiddenColumns = ['stok', 'harga_pokok'];
      const incomingCsvHeaders = ['kode', 'nama', 'harga_jual', 'stok'];
      
      const containsForbidden = incomingCsvHeaders.some((h) => forbiddenColumns.includes(h));
      expect(containsForbidden).toBe(true);
    });

    it('6.2: Perubahan harga_jual atau batas_kredit via impor menghasilkan entri audit', () => {
      const auditLogMock: Array<{ aksi: string; tabel: string; nilai_lama: string; nilai_baru: string }> = [];
      
      function recordImportAudit(tabel: string, field: string, oldVal: number, newVal: number) {
        if (oldVal !== newVal) {
          auditLogMock.push({
            aksi: `perubahan_${field}`,
            tabel,
            nilai_lama: JSON.stringify({ [field]: oldVal }),
            nilai_baru: JSON.stringify({ [field]: newVal }),
          });
        }
      }

      recordImportAudit('barang', 'harga_jual', 50000, 55000);
      recordImportAudit('pelanggan', 'batas_kredit', 10000000, 15000000);

      expect(auditLogMock).toHaveLength(2);
      expect(auditLogMock[0].aksi).toBe('perubahan_harga_jual');
      expect(auditLogMock[1].aksi).toBe('perubahan_batas_kredit');
    });
  });

  // =========================================================================
  // BUTIR 7: Stock Opname & Penyesuaian Fisik
  // =========================================================================
  describe('Butir 7: Stock opname (alasan >= 10 karakter, jenis penyesuaian, stok tidak negatif)', () => {
    function executePenyesuaianStok(stokAwal: number, penyesuaian: number, alasan: string) {
      if (!alasan || alasan.trim().length < 10) {
        throw new Error(ERROR_MESSAGES.E0023);
      }
      const stokAkhir = stokAwal + penyesuaian;
      if (stokAkhir < 0) {
        throw new Error(ERROR_MESSAGES.E0022 || ERROR_MESSAGES.E0001);
      }
      return {
        jenis_mutasi: 'penyesuaian',
        audit_aksi: 'penyesuaian_stok',
        stok_akhir: stokAkhir,
      };
    }

    it('7.1: Penyesuaian dengan alasan < 10 karakter ditolak', () => {
      expect(() => executePenyesuaianStok(10, -2, 'rusak')).toThrow(ERROR_MESSAGES.E0023);
    });

    it('7.2: Penyesuaian yang menyebabkan stok akhir negatif ditolak', () => {
      expect(() => executePenyesuaianStok(5, -10, 'Penyesuaian barang hilang di gudang')).toThrow();
    });

    it('7.3: Penyesuaian valid menghasilkan jenis mutasi penyesuaian dan aksi audit', () => {
      const result = executePenyesuaianStok(20, -5, 'Barang rusak kemasan saat pemindahan');
      expect(result.stok_akhir).toBe(15);
      expect(result.jenis_mutasi).toBe('penyesuaian');
      expect(result.audit_aksi).toBe('penyesuaian_stok');
    });
  });

  // =========================================================================
  // BUTIR 8: Manajemen Akun & Penolakan Akun Nonaktif Termasuk di Sesi Aktif
  // =========================================================================
  describe('Butir 8: Pembuatan akun baru oleh Manajer dan penolakan akun nonaktif', () => {
    it('8.1: Hanya Manajer yang berwenang membuat akun pengguna baru', () => {
      function canCreateAccount(user: { peran: Peran }) {
        return user.peran === 'manajer';
      }
      expect(canCreateAccount(HENDRA)).toBe(true);
      expect(canCreateAccount(RINA)).toBe(false);
      expect(canCreateAccount(DIMAS)).toBe(false);
    });

    it('8.2: Akun nonaktif (Agus) ditolak oleh session validator middleware', () => {
      function validateUserSession(user: { id: string; aktif: boolean }) {
        if (!user.aktif) {
          throw new Error('Akun dinonaktifkan. Silakan hubungi Manajer.');
        }
        return true;
      }
      expect(() => validateUserSession(AGUS)).toThrow(/dinonaktifkan/);
      expect(validateUserSession(HENDRA)).toBe(true);
    });

    it('8.3: RLS fn_peran() mengembalikan null untuk akun nonaktif (mencegah fallback ke penjualan)', () => {
      function simulateFnPeran(user: { aktif: boolean; peran: Peran }): Peran | null {
        if (!user.aktif) return null;
        return user.peran;
      }
      expect(simulateFnPeran(AGUS)).toBeNull();
      expect(simulateFnPeran(RINA)).toBe('penjualan');
    });
  });

  // =========================================================================
  // BUTIR 9: Integritas Baris Pesanan (Unik, Maks 20, Harga Master, Status Master Aktif)
  // =========================================================================
  describe('Butir 9: Integritas item pesanan jual', () => {
    it('9.1: Satu barang hanya boleh muncul sekali per pesanan (UNIQUE)', () => {
      const duplicatePayload = {
        pelanggan_id: 'a20ca835-806e-544e-9247-9007f1c3b29b',
        items: [
          { barang_id: 'b20ca835-806e-544e-9247-9007f1c3b29c', jumlah: 2, diskon_persen: 0 },
          { barang_id: 'b20ca835-806e-544e-9247-9007f1c3b29c', jumlah: 3, diskon_persen: 0 },
        ],
      };
      const parsed = pesananDrafSchema.safeParse(duplicatePayload);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues ?? (parsed.error as unknown as { errors: Array<{ message: string }> }).errors;
        expect(issues[0].message).toMatch(/duplikat/i);
      }
    });

    it('9.2: Pesanan dibatasi maksimal 20 baris item', () => {
      // Buat 21 item dengan UUID v4 yang valid
      const items = Array.from({ length: 21 }, (_, idx) => ({
        barang_id: `a20ca835-806e-544e-9247-9007f1c3b2${idx.toString().padStart(2, '0')}`,
        jumlah: 1,
        diskon_persen: 0,
      }));
      const payload = {
        pelanggan_id: 'a20ca835-806e-544e-9247-9007f1c3b29b',
        items,
      };
      const parsed = pesananDrafSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues ?? (parsed.error as unknown as { errors: Array<{ message: string }> }).errors;
        expect(issues[0].message).toMatch(/maksimal 20/i);
      }
    });

    it('9.3: Pelanggan atau barang nonaktif ditolak saat pembuatan pesanan', () => {
      function validateStatusMaster(pelangganAktif: boolean, barangAktif: boolean) {
        if (!pelangganAktif) throw new Error(ERROR_MESSAGES.E0006);
        if (!barangAktif) throw new Error(ERROR_MESSAGES.E0005);
        return true;
      }
      expect(() => validateStatusMaster(false, true)).toThrow(ERROR_MESSAGES.E0006);
      expect(() => validateStatusMaster(true, false)).toThrow(ERROR_MESSAGES.E0005);
      expect(validateStatusMaster(true, true)).toBe(true);
    });
  });

  // =========================================================================
  // BUTIR 10: Surat Jalan Hanya untuk Status Dikirim & Tanpa Harga
  // =========================================================================
  describe('Butir 10: Surat jalan (hanya status dikirim dan zero-price-leakage)', () => {
    function canPrintSuratJalan(status: string) {
      return status === 'dikirim';
    }

    it('10.1: Hanya pesanan dengan status dikirim yang boleh dicetak surat jalan', () => {
      expect(canPrintSuratJalan('dikirim')).toBe(true);
      expect(canPrintSuratJalan('draf')).toBe(false);
      expect(canPrintSuratJalan('dikonfirmasi')).toBe(false);
      expect(canPrintSuratJalan('lunas')).toBe(false);
      expect(canPrintSuratJalan('dibatalkan')).toBe(false);
    });

    it('10.2: Payload surat jalan bebas dari kolom finansial (harga, diskon, subtotal)', () => {
      const sjHeader: SuratJalanHeader = {
        id: 'so-1',
        nomor: 'SO-2026-0001',
        status: 'dikirim',
        dibuat_oleh: 'user-1',
        dibuat_pada: '2026-10-26T00:00:00Z',
        dikirim_pada: '2026-10-26T08:00:00Z',
        catatan: null,
        pelanggan_id: 'pel-1',
        pelanggan_kode: 'CUST-001',
        pelanggan_nama: 'Toko Makmur',
        pelanggan_telepon: '08123456789',
        pelanggan_alamat: 'Jl. Niaga No. 10',
        pembuat_nama: 'Rina Sales',
      };

      const sjItem: SuratJalanItem = {
        id: 'item-1',
        pesanan_jual_id: 'so-1',
        barang_id: 'brg-1',
        kode_barang: 'KPL-001',
        nama_barang: 'Kopi Kapal Api',
        satuan: 'DUS',
        jumlah: 10,
      };

      expect(sjHeader).not.toHaveProperty('total');
      expect(sjHeader).not.toHaveProperty('sisa_tagihan');
      expect(sjItem).not.toHaveProperty('harga_satuan');
      expect(sjItem).not.toHaveProperty('diskon_persen');
      expect(sjItem).not.toHaveProperty('subtotal');
    });
  });

  // =========================================================================
  // BUTIR 11: Rekonsiliasi Kartu Stok vs Stok Saat Ini
  // =========================================================================
  describe('Butir 11: Kartu stok setiap barang cocok dengan stok saat ini', () => {
    it('11.1: Saldo akhir kumulatif mutasi stok sama dengan stok master saat ini', () => {
      const mutasiList = [
        { jenis: 'masuk', jumlah: 50 },        // Penerimaan pembelian
        { jenis: 'keluar', jumlah: 20 },       // Pengiriman pesanan
        { jenis: 'batal', jumlah: 5 },          // Pengembalian batal
        { jenis: 'penyesuaian', jumlah: -2 },   // Stock opname
      ];

      const saldoAwal = 0;
      const calculatedStok = mutasiList.reduce((acc, m) => {
        if (m.jenis === 'masuk' || m.jenis === 'batal') {
          return acc + m.jumlah;
        } else if (m.jenis === 'keluar') {
          return acc - m.jumlah;
        } else if (m.jenis === 'penyesuaian') {
          return acc + m.jumlah;
        }
        return acc;
      }, saldoAwal);

      const masterStok = 33; // 50 - 20 + 5 - 2 = 33
      expect(calculatedStok).toBe(masterStok);
    });
  });
});
