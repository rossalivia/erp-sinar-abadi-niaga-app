import { describe, expect, it } from 'vitest';
import {
  formatWaktuCetak,
  gabungNomorPesanan,
  getWidgetsTugasHarian,
  hitungUmurHariJakarta,
  parsePickingListResult,
  parseTugasHarian,
  toneEfektif,
  toneUmurPesanan,
} from '../utils';
import type {
  PickingListResult,
  TugasHarianGudang,
  TugasHarianManajer,
  TugasHarianPenjualan,
} from '../types';

const tugasPenjualan: TugasHarianPenjualan = {
  peran: 'penjualan',
  draf_saya: 3,
  menunggu_kirim_saya: 2,
  persetujuan_harga_menunggu_saya: 1,
  tagihan_tempo_hari_ini_saya: 0,
  tagihan_overdue_saya: 4,
};

const tugasGudang: TugasHarianGudang = {
  peran: 'gudang',
  pesanan_siap_kirim: 5,
  umur_pesanan_tertua_hari: 2,
  po_menunggu_penerimaan: 1,
  stok_menipis: 4,
  opname_draf: 0,
};

const tugasManajer: TugasHarianManajer = {
  peran: 'manajer',
  persetujuan_harga_menunggu: 2,
  po_menunggu_persetujuan: 1,
  opname_menunggu_persetujuan: 1,
  tagihan_overdue: 4,
  tagihan_tempo_hari_ini: 2,
  stok_menipis: 4,
  tinjau_limit_kredit: 3,
};

const hasilPicking: PickingListResult = {
  metadata: {
    total_pesanan: 2,
    total_item_barang: 2,
    total_kuantitas: 18,
    dibuat_pada: '2026-10-23T03:15:00+07:00',
    dibuat_oleh_nama: 'Staf Gudang',
    dibuat_oleh_peran: 'gudang',
  },
  ringkasan_barang: [
    {
      barang_id: '11111111-aaaa-aaaa-aaaa-111111111111',
      kode_barang: 'BRG-001',
      nama_barang: 'Beras Premium 5kg',
      satuan: 'karung',
      total_diambil: 15,
      stok_saat_ini: 10,
      stok_cukup: false,
    },
    {
      barang_id: '22222222-bbbb-bbbb-bbbb-222222222222',
      kode_barang: 'BRG-002',
      nama_barang: 'Minyak Goreng 2L',
      satuan: 'pouch',
      total_diambil: 3,
      stok_saat_ini: 100,
      stok_cukup: true,
    },
  ],
  rincian_pesanan: [
    {
      pesanan_id: '33333333-cccc-cccc-cccc-333333333333',
      nomor: 'SO-2026-000001',
      dikonfirmasi_pada: '2026-10-22T10:00:00+07:00',
      pelanggan_kode: 'PEL-001',
      pelanggan_nama: 'Toko Berkah Jaya',
      items: [
        {
          barang_id: '11111111-aaaa-aaaa-aaaa-111111111111',
          kode_barang: 'BRG-001',
          nama_barang: 'Beras Premium 5kg',
          satuan: 'karung',
          jumlah: 5,
        },
      ],
    },
    {
      pesanan_id: '44444444-dddd-dddd-dddd-444444444444',
      nomor: 'SO-2026-000002',
      dikonfirmasi_pada: '2026-10-23T09:00:00+07:00',
      pelanggan_kode: 'PEL-002',
      pelanggan_nama: 'Minimarket Sejahtera',
      items: [
        {
          barang_id: '11111111-aaaa-aaaa-aaaa-111111111111',
          kode_barang: 'BRG-001',
          nama_barang: 'Beras Premium 5kg',
          satuan: 'karung',
          jumlah: 10,
        },
        {
          barang_id: '22222222-bbbb-bbbb-bbbb-222222222222',
          kode_barang: 'BRG-002',
          nama_barang: 'Minyak Goreng 2L',
          satuan: 'pouch',
          jumlah: 3,
        },
      ],
    },
  ],
};

describe('Pusat Tugas Harian — pemetaan widget per peran', () => {
  it('TC-111: memetakan lima widget Penjualan sesuai kontrak RPC', () => {
    const widgets = getWidgetsTugasHarian(tugasPenjualan);

    expect(widgets).toHaveLength(5);
    expect(widgets.map((widget) => widget.key)).toEqual([
      'draf_saya',
      'menunggu_kirim_saya',
      'persetujuan_harga_menunggu_saya',
      'tagihan_tempo_hari_ini_saya',
      'tagihan_overdue_saya',
    ]);
    expect(widgets.map((widget) => widget.nilai)).toEqual([3, 2, 1, 0, 4]);
    expect(widgets[0].href).toBe('/pesanan?status=draf');
    expect(widgets[1].href).toBe('/pesanan?status=dikonfirmasi');
    expect(widgets[2].href).toBe('/pesanan?status=draf');
    expect(widgets[3].href).toBe('/penagihan?klasifikasi=hari_ini');
    expect(widgets[4].href).toBe('/penagihan?klasifikasi=overdue');
    expect(widgets[2].tone).toBe('warning');
    expect(widgets[4].tone).toBe('danger');
  });

  it('TC-113: memetakan widget Gudang termasuk umur pesanan dan tautan picking', () => {
    const widgets = getWidgetsTugasHarian(tugasGudang);
    const umur = widgets.find(
      (widget) => widget.key === 'umur_pesanan_tertua_hari'
    );

    expect(widgets).toHaveLength(5);
    expect(widgets.map((widget) => widget.nilai)).toEqual([5, 2, 1, 4, 0]);
    expect(umur?.tone).toBe('danger');
    expect(umur?.satuan).toBe('hari');
    expect(widgets[0].href).toBe('/pesanan?status=dikonfirmasi');
    expect(widgets[2].href).toBe('/pembelian?status=disetujui');
    expect(widgets[3].href).toBe('/barang?menipis=true');
    expect(widgets[4].href).toBe('/stok/opname?status=draf');
  });

  it('TC-114: memetakan enam widget Manajer secara terpadu', () => {
    const widgets = getWidgetsTugasHarian(tugasManajer);

    expect(widgets).toHaveLength(7);
    expect(widgets.map((widget) => widget.key)).toEqual([
      'persetujuan_harga_menunggu',
      'po_menunggu_persetujuan',
      'opname_menunggu_persetujuan',
      'tagihan_overdue',
      'tagihan_tempo_hari_ini',
      'stok_menipis',
      'tinjau_limit_kredit',
    ]);
    expect(widgets.map((widget) => widget.nilai)).toEqual([2, 1, 1, 4, 2, 4, 3]);
    expect(widgets[0].href).toBe('/persetujuan');
    expect(widgets[1].href).toBe('/pembelian?status=diajukan');
    expect(widgets[2].href).toBe('/stok/opname?status=diajukan');
    expect(widgets[3].tone).toBe('danger');
    expect(widgets[6].href).toBe('/kredit');
  });
});

describe('Pusat Tugas Harian — netralitas angka nol & umur pesanan', () => {
  it('TC-125: nilai nol selalu memakai tone netral, berapa pun tone dasarnya', () => {
    expect(toneEfektif('danger', 0)).toBe('neutral');
    expect(toneEfektif('warning', 0)).toBe('neutral');
    expect(toneEfektif('info', 0)).toBe('neutral');
    expect(toneEfektif('danger', 1)).toBe('danger');
    expect(toneEfektif('warning', 3)).toBe('warning');
  });

  it('TC-113: ambang umur pesanan 0/1/≥2 hari sesuai spesifikasi', () => {
    expect(toneUmurPesanan(0)).toBe('neutral');
    expect(toneUmurPesanan(1)).toBe('warning');
    expect(toneUmurPesanan(2)).toBe('danger');
    expect(toneUmurPesanan(8)).toBe('danger');
  });

  it('TC-125: widget dengan nilai nol tidak memiliki alarm pada data gudang', () => {
    const widgets = getWidgetsTugasHarian(tugasGudang);
    const opname = widgets.find((widget) => widget.key === 'opname_draf');

    expect(opname?.nilai).toBe(0);
    expect(toneEfektif(opname?.tone ?? 'neutral', opname?.nilai ?? 0)).toBe(
      'neutral'
    );
  });
});

describe('Perhitungan tanggal bisnis Asia/Jakarta', () => {
  const sekarang = new Date('2026-10-23T03:00:00+07:00');

  it('TC-113: menghitung selisih hari kalender Jakarta', () => {
    expect(hitungUmurHariJakarta('2026-10-23T00:15:00+07:00', sekarang)).toBe(
      0
    );
    expect(hitungUmurHariJakarta('2026-10-22T23:59:00+07:00', sekarang)).toBe(
      1
    );
    expect(hitungUmurHariJakarta('2026-10-21T08:00:00+07:00', sekarang)).toBe(
      2
    );
  });

  it('TC-113: tidak terpengaruh pergantian tanggal UTC', () => {
    // 22 Okt 23:30 UTC = 23 Okt 06:30 WIB (bukan 1 hari).
    expect(
      hitungUmurHariJakarta(
        '2026-10-22T23:30:00+00:00',
        new Date('2026-10-23T01:00:00+00:00')
      )
    ).toBe(0);
  });

  it('TC-113: menjepit tanggal masa depan dan input tidak valid ke 0', () => {
    expect(hitungUmurHariJakarta('2026-10-25T10:00:00+07:00', sekarang)).toBe(
      0
    );
    expect(hitungUmurHariJakarta('bukan-tanggal', sekarang)).toBe(0);
  });
});

describe('Penyaringan keluaran RPC (zero-leakage)', () => {
  it('TC-123: parseTugasHarian membuang kunci finansial yang tidak dikenal', () => {
    const mentah = {
      peran: 'manajer',
      persetujuan_harga_menunggu: 2,
      po_menunggu_persetujuan: 1,
      opname_menunggu_persetujuan: 1,
      tagihan_overdue: 4,
      tagihan_tempo_hari_ini: 2,
      stok_menipis: 4,
      harga_pokok: 8000,
      total_margin: 1_000_000,
      hpp_satuan: 5000,
    };

    const hasil = parseTugasHarian(mentah);
    const teks = JSON.stringify(hasil);

    expect(hasil?.peran).toBe('manajer');
    expect(teks).not.toContain('harga_pokok');
    expect(teks).not.toContain('total_margin');
    expect(teks).not.toContain('hpp_satuan');
  });

  it('TC-123: parsePickingListResult hanya meneruskan kolom operasional', () => {
    const mentah = {
      ...hasilPicking,
      ringkasan_barang: hasilPicking.ringkasan_barang.map((barang) => ({
        ...barang,
        harga_satuan: 20_000,
        hpp_satuan: 15_000,
        margin: 5_000,
      })),
      rincian_pesanan: hasilPicking.rincian_pesanan.map((pesanan) => ({
        ...pesanan,
        total: 150_000,
        items: pesanan.items.map((item) => ({
          ...item,
          subtotal: 100_000,
          diskon_persen: 10,
        })),
      })),
    };

    const hasil = parsePickingListResult(mentah);
    const teks = JSON.stringify(hasil);

    expect(hasil).not.toBeNull();
    expect(teks).not.toContain('harga_satuan');
    expect(teks).not.toContain('hpp_satuan');
    expect(teks).not.toContain('margin');
    expect(teks).not.toContain('subtotal');
    expect(teks).not.toContain('diskon');
    expect(teks).not.toContain('"total"');
    expect(hasil?.metadata.total_kuantitas).toBe(18);
  });

  it('TC-117/TC-119: mempertahankan struktur picking list dan flag stok', () => {
    const hasil = parsePickingListResult(hasilPicking);

    expect(hasil?.metadata).toEqual(hasilPicking.metadata);
    expect(hasil?.ringkasan_barang).toHaveLength(2);
    expect(hasil?.ringkasan_barang[0].stok_cukup).toBe(false);
    expect(hasil?.ringkasan_barang[1].stok_cukup).toBe(true);
    expect(hasil?.rincian_pesanan[1].items).toHaveLength(2);
    expect(hasil?.rincian_pesanan[1].items[1].jumlah).toBe(3);
  });

  it('TC-116: menolak hasil dengan peran tidak berwenang', () => {
    const hasil = parsePickingListResult({
      ...hasilPicking,
      metadata: { ...hasilPicking.metadata, dibuat_oleh_peran: 'penjualan' },
    });

    expect(hasil).toBeNull();
  });

  it('menolak kontrak RPC yang tidak dikenali', () => {
    expect(parseTugasHarian(null)).toBeNull();
    expect(parseTugasHarian({ peran: 'admin' })).toBeNull();
    expect(parsePickingListResult(null)).toBeNull();
    expect(parsePickingListResult({ metadata: null })).toBeNull();
  });
});

describe('Format dokumen cetak picking list', () => {
  it('TC-124: memformat waktu cetak Asia/Jakarta dengan detik dan WIB', () => {
    expect(formatWaktuCetak('2026-10-23T03:15:00+07:00')).toBe(
      '23 Oktober 2026, 03:15:00 WIB'
    );
  });

  it('TC-124: menggabungkan nomor pesanan untuk kop dokumen', () => {
    expect(gabungNomorPesanan(hasilPicking.rincian_pesanan)).toBe(
      'SO-2026-000001, SO-2026-000002'
    );
  });
});
