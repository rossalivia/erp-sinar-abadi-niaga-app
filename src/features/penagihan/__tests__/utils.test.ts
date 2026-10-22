import { describe, it, expect } from 'vitest';
import {
  normalisasiNomorTelepon,
  buatPesanWhatsApp,
  buatUrlWhatsApp,
  hitungRingkasanTagihan,
} from '../utils';
import { TagihanItem } from '../types';

describe('Modul Utilitas Penagihan Piutang & WhatsApp (TC-84 s.d. TC-86)', () => {
  describe('TC-84: Normalisasi Nomor Telepon Indonesia', () => {
    it('mengubah awalan 08 menjadi 628', () => {
      const res = normalisasiNomorTelepon('081234567891');
      expect(res.valid).toBe(true);
      expect(res.nomor).toBe('6281234567891');
    });

    it('membersihkan spasi, tanda hubung, dan kurung dari nomor +62', () => {
      const res = normalisasiNomorTelepon('+62 812-3456-7890');
      expect(res.valid).toBe(true);
      expect(res.nomor).toBe('6281234567890');
    });

    it('mempertahankan awalan 628 tanpa tanda plus', () => {
      const res = normalisasiNomorTelepon('6285712345678');
      expect(res.valid).toBe(true);
      expect(res.nomor).toBe('6285712345678');
    });

    it('membersihkan format titik: 0812.3456.7890', () => {
      const res = normalisasiNomorTelepon('0812.3456.7890');
      expect(res.valid).toBe(true);
      expect(res.nomor).toBe('6281234567890');
    });
  });

  describe('TC-85: Validasi Nomor Telepon Tidak Valid', () => {
    it('menolak nomor kosong, null, atau undefined', () => {
      expect(normalisasiNomorTelepon('').valid).toBe(false);
      expect(normalisasiNomorTelepon('   ').valid).toBe(false);
      expect(normalisasiNomorTelepon(null).valid).toBe(false);
      expect(normalisasiNomorTelepon(undefined).valid).toBe(false);
    });

    it('menolak nomor telepon kabel PSTN area 021', () => {
      const res = normalisasiNomorTelepon('021-8899001');
      expect(res.valid).toBe(false);
      expect(res.pesanError).toContain('bukan nomor seluler');
    });

    it('menolak nomor yang terlalu pendek (< 9 digit)', () => {
      const res = normalisasiNomorTelepon('081234');
      expect(res.valid).toBe(false);
      expect(res.pesanError).toContain('9-15 digit');
    });

    it('menolak nomor yang mengandung huruf atau simbol asing', () => {
      const res = normalisasiNomorTelepon('0812-CALL-NOW');
      expect(res.valid).toBe(false);
    });
  });

  describe('TC-86: Pembuatan Pesan & URL WhatsApp Resmi', () => {
    const paramsUji = {
      namaToko: 'Toko Berkah Mandiri',
      fakturList: [
        { nomor: 'SO-2026-000001', total: 1250000, jatuhTempo: '22 Oktober 2026' },
      ],
      totalTertagih: 1250000,
    };

    it('menghasilkan templat jenis menjelang dengan informasi lengkap', () => {
      const teks = buatPesanWhatsApp('menjelang', paramsUji);
      expect(teks).toContain('Toko Berkah Mandiri');
      expect(teks).toContain('CV Sinar Abadi Niaga');
      expect(teks).toContain('SO-2026-000001');
      expect(teks).toContain('Rp1.250.000');
      expect(teks).toContain('akan jatuh tempo');
    });

    it('menghasilkan templat jenis hari_ini dengan penekanan HARI INI', () => {
      const teks = buatPesanWhatsApp('hari_ini', paramsUji);
      expect(teks).toContain('jatuh tempo *HARI INI*');
    });

    it('menghasilkan templat jenis terlambat dengan peringatan menunggak', () => {
      const teks = buatPesanWhatsApp('terlambat', paramsUji);
      expect(teks).toContain('melewati jatuh tempo');
      expect(teks).toContain('Total tagihan menunggak');
    });

    it('membuat URL wa.me dengan encoding URL sempurna', () => {
      const teks = 'Halo Toko Berkah Mandiri & Rekan\nTotal: Rp1.250.000';
      const url = buatUrlWhatsApp('6281234567891', teks);

      expect(url.startsWith('https://wa.me/6281234567891?text=')).toBe(true);
      expect(url).not.toContain('\n'); // Harus ter-encode %0A
      expect(url).toContain('%0A');
      expect(url).toContain('%26'); // & ter-encode
      expect(decodeURIComponent(url.replace('https://wa.me/6281234567891?text=', ''))).toBe(teks);
    });
  });

  describe('Perhitungan Ringkasan Tagihan (KPI)', () => {
    it('menghitung metrik total tagihan, overdue, dan segera dengan tepat', () => {
      const items: TagihanItem[] = [
        {
          pesanan_id: '1',
          nomor_pesanan: 'SO-1',
          pelanggan_id: 'p1',
          kode_pelanggan: 'PLG-1',
          nama_toko: 'Toko A',
          telepon: '081234567891',
          alamat: null,
          termin_hari: 14,
          batas_kredit: 1000000,
          total: 500000,
          dibuat_oleh: 'u1',
          nama_sales: 'Sales 1',
          dibuat_pada: '2026-10-10',
          dikirim_pada: '2026-10-10',
          jatuh_tempo: '2026-10-24',
          hari_terlambat: 0,
          hari_menuju: 2,
          klasifikasi: 'segera',
          janji_bayar_tanggal: null,
          janji_catatan: null,
          status_janji: 'tidak_ada',
        },
        {
          pesanan_id: '2',
          nomor_pesanan: 'SO-2',
          pelanggan_id: 'p2',
          kode_pelanggan: 'PLG-2',
          nama_toko: 'Toko B',
          telepon: '081234567892',
          alamat: null,
          termin_hari: 7,
          batas_kredit: 1000000,
          total: 750000,
          dibuat_oleh: 'u1',
          nama_sales: 'Sales 1',
          dibuat_pada: '2026-10-01',
          dikirim_pada: '2026-10-01',
          jatuh_tempo: '2026-10-08',
          hari_terlambat: 14,
          hari_menuju: 0,
          klasifikasi: 'overdue_8_30',
          janji_bayar_tanggal: null,
          janji_catatan: null,
          status_janji: 'tidak_ada',
        },
      ];

      const kpi = hitungRingkasanTagihan(items);
      expect(kpi.totalFaktur).toBe(2);
      expect(kpi.totalTertagih).toBe(1250000);
      expect(kpi.totalOverdue).toBe(750000);
      expect(kpi.jumlahSegera).toBe(1);
      expect(kpi.jumlahOverdue).toBe(1);
      expect(kpi.jumlahHariIni).toBe(0);
    });
  });
});
