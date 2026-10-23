import type {
  PickingItem,
  PickingListResult,
  PickingRincianPesanan,
  PickingRingkasanBarang,
  TugasHarianData,
  TugasHarianGudang,
  TugasHarianManajer,
  TugasHarianPenjualan,
  ToneTugas,
  WidgetTugas,
} from './types';

/* ------------------------------------------------------------------ */
/* Normalisasi angka & nama                                            */
/* ------------------------------------------------------------------ */

function keAngka(nilai: unknown): number {
  const angka = Number(nilai);
  return Number.isFinite(angka) ? Math.max(0, Math.trunc(angka)) : 0;
}

function keTeks(nilai: unknown, fallback = ''): string {
  return typeof nilai === 'string' ? nilai : fallback;
}

function keBoolean(nilai: unknown): boolean {
  return nilai === true;
}

function sebagaiObjek(nilai: unknown): Record<string, unknown> | null {
  if (nilai === null || typeof nilai !== 'object' || Array.isArray(nilai)) {
    return null;
  }
  return nilai as Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Parsing kontrak JSONB (whitelist field, buang kunci asing)          */
/* ------------------------------------------------------------------ */

/**
 * Mengubah JSONB RPC menjadi objek yang hanya memuat field yang diizinkan.
 * Kunci asing (termasuk potensi kebocoran finansial) tidak pernah diteruskan
 * ke komponen/klien.
 */
export function parseTugasHarian(nilai: unknown): TugasHarianData | null {
  const raw = sebagaiObjek(nilai);
  if (!raw) return null;

  if (raw.peran === 'penjualan') {
    const data: TugasHarianPenjualan = {
      peran: 'penjualan',
      draf_saya: keAngka(raw.draf_saya),
      menunggu_kirim_saya: keAngka(raw.menunggu_kirim_saya),
      persetujuan_harga_menunggu_saya: keAngka(
        raw.persetujuan_harga_menunggu_saya
      ),
      tagihan_tempo_hari_ini_saya: keAngka(raw.tagihan_tempo_hari_ini_saya),
      tagihan_overdue_saya: keAngka(raw.tagihan_overdue_saya),
    };
    return data;
  }

  if (raw.peran === 'gudang') {
    const data: TugasHarianGudang = {
      peran: 'gudang',
      pesanan_siap_kirim: keAngka(raw.pesanan_siap_kirim),
      umur_pesanan_tertua_hari: keAngka(raw.umur_pesanan_tertua_hari),
      po_menunggu_penerimaan: keAngka(raw.po_menunggu_penerimaan),
      stok_menipis: keAngka(raw.stok_menipis),
      opname_draf: keAngka(raw.opname_draf),
    };
    return data;
  }

  if (raw.peran === 'manajer') {
    const data: TugasHarianManajer = {
      peran: 'manajer',
      persetujuan_harga_menunggu: keAngka(raw.persetujuan_harga_menunggu),
      po_menunggu_persetujuan: keAngka(raw.po_menunggu_persetujuan),
      opname_menunggu_persetujuan: keAngka(
        raw.opname_menunggu_persetujuan
      ),
      tagihan_overdue: keAngka(raw.tagihan_overdue),
      tagihan_tempo_hari_ini: keAngka(raw.tagihan_tempo_hari_ini),
      stok_menipis: keAngka(raw.stok_menipis),
    };
    return data;
  }

  return null;
}

function parseRingkasanBarang(nilai: unknown): PickingRingkasanBarang | null {
  const raw = sebagaiObjek(nilai);
  if (!raw) return null;
  const barangId = keTeks(raw.barang_id);
  if (!barangId) return null;

  return {
    barang_id: barangId,
    kode_barang: keTeks(raw.kode_barang, '-'),
    nama_barang: keTeks(raw.nama_barang, '-'),
    satuan: keTeks(raw.satuan, 'pcs'),
    total_diambil: keAngka(raw.total_diambil),
    stok_saat_ini: keAngka(raw.stok_saat_ini),
    stok_cukup: keBoolean(raw.stok_cukup),
  };
}

function parseItem(nilai: unknown): PickingItem | null {
  const raw = sebagaiObjek(nilai);
  if (!raw) return null;
  const barangId = keTeks(raw.barang_id);
  if (!barangId) return null;

  return {
    barang_id: barangId,
    kode_barang: keTeks(raw.kode_barang, '-'),
    nama_barang: keTeks(raw.nama_barang, '-'),
    satuan: keTeks(raw.satuan, 'pcs'),
    jumlah: keAngka(raw.jumlah),
  };
}

function parseRincian(nilai: unknown): PickingRincianPesanan | null {
  const raw = sebagaiObjek(nilai);
  if (!raw) return null;
  const pesananId = keTeks(raw.pesanan_id);
  if (!pesananId) return null;

  const items = Array.isArray(raw.items)
    ? raw.items
        .map(parseItem)
        .filter((item): item is PickingItem => item !== null)
    : [];

  return {
    pesanan_id: pesananId,
    nomor: keTeks(raw.nomor, '-'),
    dikonfirmasi_pada: keTeks(raw.dikonfirmasi_pada) || null,
    pelanggan_kode: keTeks(raw.pelanggan_kode, '-'),
    pelanggan_nama: keTeks(raw.pelanggan_nama, '-'),
    items,
  };
}

/**
 * Memvalidasi & menyaring keluaran rpc_ambil_daftar_picking.
 * Hanya field operasional yang lolos; nominal uang tidak pernah ikut.
 */
export function parsePickingListResult(nilai: unknown): PickingListResult | null {
  const raw = sebagaiObjek(nilai);
  if (!raw) return null;

  const metadataRaw = sebagaiObjek(raw.metadata);
  if (!metadataRaw) return null;
  const peran = keTeks(metadataRaw.dibuat_oleh_peran);
  if (peran !== 'gudang' && peran !== 'manajer') return null;

  const ringkasan = Array.isArray(raw.ringkasan_barang)
    ? raw.ringkasan_barang
        .map(parseRingkasanBarang)
        .filter((item): item is PickingRingkasanBarang => item !== null)
    : [];

  const rincian = Array.isArray(raw.rincian_pesanan)
    ? raw.rincian_pesanan
        .map(parseRincian)
        .filter((item): item is PickingRincianPesanan => item !== null)
    : [];

  return {
    metadata: {
      total_pesanan: keAngka(metadataRaw.total_pesanan),
      total_item_barang: keAngka(metadataRaw.total_item_barang),
      total_kuantitas: keAngka(metadataRaw.total_kuantitas),
      dibuat_pada: keTeks(metadataRaw.dibuat_pada),
      dibuat_oleh_nama: keTeks(metadataRaw.dibuat_oleh_nama, 'Petugas'),
      dibuat_oleh_peran: peran,
    },
    ringkasan_barang: ringkasan,
    rincian_pesanan: rincian,
  };
}

/* ------------------------------------------------------------------ */
/* Widget Tugas Hari Ini                                               */
/* ------------------------------------------------------------------ */

export function toneEfektif(tone: ToneTugas, nilai: number): ToneTugas {
  return nilai > 0 ? tone : 'neutral';
}

export function toneUmurPesanan(hari: number): ToneTugas {
  if (hari >= 2) return 'danger';
  if (hari === 1) return 'warning';
  return 'neutral';
}

export function getWidgetsTugasHarian(data: TugasHarianData): WidgetTugas[] {
  if (data.peran === 'penjualan') {
    return [
      {
        key: 'draf_saya',
        judul: 'Draf Pesanan Saya',
        nilai: data.draf_saya,
        keterangan: 'Draf pesanan yang belum dikonfirmasi',
        indikator: 'Belum dikonfirmasi',
        tone: 'neutral',
        href: '/pesanan?status=draf',
      },
      {
        key: 'menunggu_kirim_saya',
        judul: 'Menunggu Pengiriman',
        nilai: data.menunggu_kirim_saya,
        keterangan: 'Pesanan terkonfirmasi menunggu diproses gudang',
        indikator: 'Siap diproses',
        tone: 'info',
        href: '/pesanan?status=dikonfirmasi',
      },
      {
        key: 'persetujuan_harga_menunggu_saya',
        judul: 'Pengajuan Harga Menunggu',
        nilai: data.persetujuan_harga_menunggu_saya,
        keterangan: 'Pengajuan menunggu keputusan Manajer',
        indikator: 'Menunggu Manajer',
        tone: 'warning',
        href: '/pesanan?status=draf',
      },
      {
        key: 'tagihan_tempo_hari_ini_saya',
        judul: 'Tagihan Tempo Hari Ini',
        nilai: data.tagihan_tempo_hari_ini_saya,
        keterangan: 'Faktur Anda yang jatuh tempo hari ini',
        indikator: 'Jatuh tempo',
        tone: 'warning',
        href: '/penagihan?klasifikasi=hari_ini',
      },
      {
        key: 'tagihan_overdue_saya',
        judul: 'Tagihan Menunggak',
        nilai: data.tagihan_overdue_saya,
        keterangan: 'Faktur Anda yang melewati jatuh tempo',
        indikator: 'Perlu ditagih',
        tone: 'danger',
        href: '/penagihan?klasifikasi=overdue',
      },
    ];
  }

  if (data.peran === 'gudang') {
    return [
      {
        key: 'pesanan_siap_kirim',
        judul: 'Pesanan Siap Kirim',
        nilai: data.pesanan_siap_kirim,
        keterangan: 'Antrean pesanan terkonfirmasi untuk disiapkan',
        indikator: 'Antrean gudang',
        tone: 'warning',
        href: '/pesanan?status=dikonfirmasi',
      },
      {
        key: 'umur_pesanan_tertua_hari',
        judul: 'Umur Pesanan Tertua',
        nilai: data.umur_pesanan_tertua_hari,
        keterangan: 'Hari sejak konfirmasi pesanan tertua',
        indikator: 'Prioritas',
        tone: toneUmurPesanan(data.umur_pesanan_tertua_hari),
        href: '/pesanan?status=dikonfirmasi',
        satuan: 'hari',
      },
      {
        key: 'po_menunggu_penerimaan',
        judul: 'PO Menunggu Penerimaan',
        nilai: data.po_menunggu_penerimaan,
        keterangan: 'PO disetujui yang barangnya belum diterima',
        indikator: 'Barang datang',
        tone: 'info',
        href: '/pembelian?status=disetujui',
      },
      {
        key: 'stok_menipis',
        judul: 'Barang Stok Menipis',
        nilai: data.stok_menipis,
        keterangan: 'Barang pada atau di bawah batas minimum',
        indikator: 'Perlu restock',
        tone: 'danger',
        href: '/barang?menipis=true',
      },
      {
        key: 'opname_draf',
        judul: 'Sesi Opname Draf',
        nilai: data.opname_draf,
        keterangan: 'Sesi stock opname yang belum diajukan',
        indikator: 'Belum diajukan',
        tone: 'neutral',
        href: '/stok/opname?status=draf',
      },
    ];
  }

  return [
    {
      key: 'persetujuan_harga_menunggu',
      judul: 'Persetujuan Harga Menunggu',
      nilai: data.persetujuan_harga_menunggu,
      keterangan: 'Pengajuan harga di bawah batas menunggu putusan',
      indikator: 'Perlu putusan',
      tone: 'warning',
      href: '/persetujuan',
    },
    {
      key: 'po_menunggu_persetujuan',
      judul: 'Pengadaan PO Diajukan',
      nilai: data.po_menunggu_persetujuan,
      keterangan: 'PO yang menunggu persetujuan Manajer',
      indikator: 'Perlu putusan',
      tone: 'warning',
      href: '/pembelian?status=diajukan',
    },
    {
      key: 'opname_menunggu_persetujuan',
      judul: 'Stock Opname Diajukan',
      nilai: data.opname_menunggu_persetujuan,
      keterangan: 'Sesi opname yang menunggu persetujuan',
      indikator: 'Perlu putusan',
      tone: 'warning',
      href: '/stok/opname?status=diajukan',
    },
    {
      key: 'tagihan_overdue',
      judul: 'Tagihan Overdue Toko',
      nilai: data.tagihan_overdue,
      keterangan: 'Faktur toko yang melewati jatuh tempo',
      indikator: 'Risiko piutang',
      tone: 'danger',
      href: '/penagihan?klasifikasi=overdue',
    },
    {
      key: 'tagihan_tempo_hari_ini',
      judul: 'Tagihan Jatuh Tempo Hari Ini',
      nilai: data.tagihan_tempo_hari_ini,
      keterangan: 'Faktur toko yang jatuh tempo hari ini',
      indikator: 'Jatuh tempo',
      tone: 'warning',
      href: '/penagihan?klasifikasi=hari_ini',
    },
    {
      key: 'stok_menipis',
      judul: 'Barang Stok Menipis',
      nilai: data.stok_menipis,
      keterangan: 'Barang pada atau di bawah batas minimum',
      indikator: 'Restock diperlukan',
      tone: 'danger',
      href: '/barang?menipis=true',
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Tanggal bisnis Asia/Jakarta                                         */
/* ------------------------------------------------------------------ */

interface BagianTanggal {
  tahun: number;
  bulan: number;
  hari: number;
}

function bagianTanggalJakarta(nilai: string | Date): BagianTanggal | null {
  const tanggal = typeof nilai === 'string' ? new Date(nilai) : nilai;
  if (Number.isNaN(tanggal.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(tanggal);

  const ambil = (tipe: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === tipe)?.value ?? NaN);

  const tahun = ambil('year');
  const bulan = ambil('month');
  const hari = ambil('day');

  if (!Number.isFinite(tahun) || !Number.isFinite(bulan) || !Number.isFinite(hari)) {
    return null;
  }
  return { tahun, bulan, hari };
}

/**
 * Selisih hari kalender bisnis Asia/Jakarta antara `sekarang` dan
 * `referensi`. Nilai negatif (referensi di masa depan) dijepit ke 0.
 */
export function hitungUmurHariJakarta(
  referensi: string | Date | null | undefined,
  sekarang: Date = new Date()
): number {
  if (!referensi) return 0;
  const bagianRef = bagianTanggalJakarta(referensi);
  const bagianKini = bagianTanggalJakarta(sekarang);
  if (!bagianRef || !bagianKini) return 0;

  const utcRef = Date.UTC(bagianRef.tahun, bagianRef.bulan - 1, bagianRef.hari);
  const utcKini = Date.UTC(
    bagianKini.tahun,
    bagianKini.bulan - 1,
    bagianKini.hari
  );

  return Math.max(0, Math.round((utcKini - utcRef) / 86_400_000));
}

/** Alias praktis untuk hitungUmurHariJakarta */
export const hitungUmurHariWib = hitungUmurHariJakarta;

/** Format kop cetak: "23 Oktober 2026, 03:15:00 WIB". */
export function formatWaktuCetak(nilai: string | Date): string {
  const tanggal = typeof nilai === 'string' ? new Date(nilai) : nilai;
  if (Number.isNaN(tanggal.getTime())) return '-';

  const parts = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(tanggal);

  const ambil = (tipe: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === tipe)?.value ?? '';

  return `${ambil('day')} ${ambil('month')} ${ambil('year')}, ${ambil(
    'hour'
  )}:${ambil('minute')}:${ambil('second')} WIB`;
}

/** Daftar nomor pesanan untuk kop cetak. */
export function gabungNomorPesanan(
  rincian: PickingRincianPesanan[]
): string {
  return rincian.map((item) => item.nomor).join(', ');
}
