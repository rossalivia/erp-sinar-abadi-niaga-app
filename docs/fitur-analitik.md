# Spesifikasi Teknis: Analitik Pelanggan dan Performa Sales

Dokumen ini adalah spesifikasi implementasi otoritatif untuk fitur **Analitik Pelanggan dan Performa Sales** pada aplikasi ERP CV Sinar Abadi Niaga.  
Dokumen ini disusun oleh Tech Lead dan mematuhi seluruh panduan [`AGENTS.md`](../AGENTS.md), [`docs/00-spesifikasi.md`](00-spesifikasi.md), [`docs/02-matriks-akses.md`](02-matriks-akses.md), [`docs/03-test-plan.md`](03-test-plan.md), [`docs/04-asumsi-dan-celah.md`](04-asumsi-dan-celah.md), dan [`docs/16-peta-sistem-saat-ini.md`](16-peta-sistem-saat-ini.md).

---

## 1. Ringkasan Eksekutif & Tujuan Bisnis

### A. Latar Belakang
Manajer memerlukan visibilitas analitik yang lebih mendalam melampaui rekap omzet mingguan umum, yaitu:
1. **Evaluasi Kinerja Staf Penjualan (Sales Force Performance)**: Menilai produktivitas masing-masing staf penjualan (omzet, margin kotor yang dihasilkan, jumlah pesanan dikirim, dan outstanding piutang berjalan).
2. **Identifikasi Pelanggan Utama (Top Customers)**: Mengelompokkan pelanggan yang memberikan kontribusi omzet dan laba kotor terbesar bagi perusahaan.
3. **Penyelamatan Pelanggan Pasif (Dormant Customers)**: Mendeteksi pelanggan aktif yang sudah lama tidak melakukan pemesanan (at-risk churn) agar dapat ditindaklanjuti dengan penawaran khusus atau kunjungan sales.
4. **Optimalisasi Modal Kerja & Gudang (Dead Stock / Slow Moving)**: Mendeteksi persediaan barang yang mengendap di gudang tanpa penjualan dalam rentang waktu lama dan menghitung total modal tertahan (*dead capital*).

### B. Batasan & Prinsip Desain Utama
1. **Khusus Manajer (Strict Manager-Only)**: Halaman `/analitik`, seluruh fungsi RPC analitik, dan endpoint ekspor CSV dilindungi secara ketat. Staf Penjualan dan Gudang tidak memiliki izin akses (diberikan HTTP 403 / redirect `/tidak-berwenang` / error RPC `E0001`).
2. **Kerahasiaan Data Tingkat Tinggi (Zero-Leakage)**: Nilai HPP, harga pokok, modal tertahan, dan margin kotor **tidak boleh bocor** ke peran non-Manajer melalui bundle, API, atau jaringan.
3. **Konsistensi Definisi Finansial**: Definisi omzet, HPP, dan margin kotor wajib **100% identik** dengan modul Laporan yang sudah ada (`pj.status IN ('dikirim', 'lunas')`, berbasis tanggal pengiriman `dikirim_pada` Asia/Jakarta, dan HPP dari snapshot `item_pesanan_jual.hpp_satuan`).
4. **Logika Bisnis Otoritatif di Database**: Seluruh kalkulasi agregasi, filter hari tidak aktif, dan kalkulasi modal tertahan dijalankan di dalam fungsi RPC Postgres `SECURITY DEFINER`.

---

## 2. Aturan Bisnis & Keputusan Desain (N1 s.d. N10)

| Kode | Aturan Bisnis & Keputusan Desain | Rasional & Detail Penegakan |
|---|---|---|
| **N1** | **Konsistensi Definisi Finansial Transaksional** | Omzet hanya diakui dari pesanan berstatus `'dikirim'` atau `'lunas'`. Pesanan status `'draf'`, `'dikonfirmasi'`, atau `'batal'` tidak diakui sebagai omzet/laba. HPP dihitung dari `item_pesanan_jual.hpp_satuan * item_pesanan_jual.jumlah` (snapshot saat konfirmasi, bukan harga pokok master barang saat ini). Margin = Omzet - Total HPP. Margin % = `(Margin / Omzet) * 100`. |
| **N2** | **Proteksi Akses Berlapis Tiga (3-Tier RBAC Guard)** | Akses ke modul analitik dilindungi 3 lapis mandiri: (1) Lapisan Route Guard / Middleware (`src/lib/akses.ts`), (2) Lapisan Server Component UI (`getProfil()` redirect `/tidak-berwenang`), dan (3) Lapisan Otorisasi Database RPC (`fn_is_manajer()` raise `E0001`). |
| **N3** | **Kerahasiaan Modal Tertahan & HPP (Zero Leakage)** | Kolom `harga_pokok`, `nilai_stok_mengendap`, `total_hpp`, dan `total_margin` tidak pernah di-grant ke `authenticated` secara umum. RPC analitik mengeksekusi pemeriksaan `IF NOT public.fn_is_manajer()` di baris paling pertama. |
| **N4** | **Zona Waktu Bisnis Asia/Jakarta (WIB)** | Semua batas rentang tanggal, penentuan "hari ini", serta kalkulasi selisih hari keterlambatan/inaktivitas wajib menggunakan ekspresi `(now() AT TIME ZONE 'Asia/Jakarta')::date` untuk mencegah penyimpangan penanggalan UTC server. |
| **N5** | **Aturan Pengelompokan Performa Sales** | Pesanan dikaitkan dengan staf penjualan berdasarkan kolom `pesanan_jual.dibuat_oleh`. Hanya akun pengguna aktif/nonaktif dengan peran `'penjualan'` yang ditampilkan dalam tabel performa. Staf dengan 0 penjualan tetap ditampilkan dengan metrik 0 agar Manajer dapat mengevaluasi staf yang tidak produktif. |
| **N6** | **Definisi Pelanggan Tidak Aktif (Dormant Customer)** | Pelanggan berstatus `aktif = true` diklasifikasikan sebagai tidak aktif jika tidak memiliki pesanan berstatus `'dikirim'` atau `'lunas'` dalam $\ge X$ hari terakhir (parameter `p_ambang_hari`, default 30 hari). Jika pelanggan belum pernah memesan sama sekali sejak terdaftar, pesanan terakhir bernilai `NULL` dan hari inaktivitas dihitung sejak tanggal pendaftaran (`pelanggan.dibuat_pada`). |
| **N7** | **Definisi Barang Tidak Bergerak (Slow Moving / Dead Stock)** | Barang berstatus `aktif = true` diklasifikasikan sebagai barang tidak bergerak jika memiliki stok fisik positif di gudang (`barang.stok > 0`), namun tidak ada item pesanan berstatus `'dikirim'`/`'lunas'` dalam $\ge X$ hari terakhir (parameter `p_ambang_hari`, default 30 hari). Barang dengan `stok = 0` tidak dihitung sebagai dead stock karena tidak ada modal yang tertahan. |
| **N8** | **Kalkulasi Nilai Modal Tertahan (Dead Capital Value)** | Nilai modal tertahan pada barang tidak bergerak dihitung dengan rumus: `stok_saat_ini * barang.harga_pokok`. Angka ini merepresentasikan uang tunai perusahaan yang beku di rak gudang. |
| **N9** | **Preset Periode & Opsi Ambang Batas Seragam** | Periode transaksi (untuk performa sales & top customer) menyediakan preset: 4 Minggu, 8 Minggu (Default), 12 Minggu, dan Rentang Kustom (Dari - Sampai). Ambang batas hari inaktivitas (untuk dormant customer & dead stock) menyediakan preset: 30 Hari (Default), 60 Hari, 90 Hari, dan 180 Hari. |
| **N10** | **Standar Ekspor CSV & Batasan Query (Safe Query Guard)** | Ekspor CSV menggunakan format standar RFC 4180 dengan UTF-8 BOM (`\uFEFF`) agar terbaca sempurna di Microsoft Excel Indonesia. Nilai limit top pelanggan dibatasi maksimal 50 baris untuk menjaga performa rendering. Parameter ambang batas inaktivitas dibatasi minimal 7 hari untuk mencegah full-table overload. |

---

## 3. Rancangan Arsitektur Basis Data & Fungsi RPC

Seluruh fungsi analitik ditempatkan di skema `public`, menggunakan atribut `SECURITY DEFINER`, mengatur `SET search_path = public, pg_temp`, dan memvalidasi `public.fn_is_manajer()`.

### A. Fungsi 1: `rpc_analitik_performa_sales`
Mengagregasi performa seluruh staf penjualan pada rentang tanggal pengiriman tertentu.

```sql
CREATE OR REPLACE FUNCTION public.rpc_analitik_performa_sales(
  p_dari   date DEFAULT NULL,
  p_sampai date DEFAULT NULL
)
RETURNS TABLE (
  sales_id           uuid,
  nama_sales         text,
  email              text,
  aktif              boolean,
  jumlah_pesanan     integer,
  pesanan_dikirim    integer,
  pesanan_lunas      integer,
  total_omzet        numeric,
  total_hpp          numeric,
  total_margin       numeric,
  margin_persen      numeric,
  piutang_berjalan   numeric,
  jumlah_draf        integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dari   date;
  v_sampai date;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_sampai := COALESCE(p_sampai, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_dari   := COALESCE(p_dari, v_sampai - interval '7 weeks');

  RETURN QUERY
  WITH sales_profiles AS (
    SELECT p.id, p.nama_lengkap, u.email, p.aktif
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE p.peran = 'penjualan'
  ),
  transaksi_periode AS (
    SELECT
      pj.dibuat_oleh AS sales_id,
      COUNT(pj.id)::integer AS jumlah_pesanan,
      COUNT(CASE WHEN pj.status = 'dikirim' THEN 1 END)::integer AS pesanan_dikirim,
      COUNT(CASE WHEN pj.status = 'lunas' THEN 1 END)::integer AS pesanan_lunas,
      COALESCE(SUM(pj.total), 0) AS total_omzet,
      COALESCE(SUM(ip_agregat.total_hpp_pesanan), 0) AS total_hpp
    FROM public.pesanan_jual pj
    LEFT JOIN LATERAL (
      SELECT SUM(COALESCE(ip.hpp_satuan, 0) * ip.jumlah) AS total_hpp_pesanan
      FROM public.item_pesanan_jual ip
      WHERE ip.pesanan_jual_id = pj.id
    ) ip_agregat ON true
    WHERE pj.status IN ('dikirim', 'lunas')
      AND pj.dikirim_pada IS NOT NULL
      AND (pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_dari AND v_sampai
    GROUP BY pj.dibuat_oleh
  ),
  status_terkini AS (
    SELECT
      pj.dibuat_oleh AS sales_id,
      COALESCE(SUM(CASE WHEN pj.status = 'dikirim' THEN pj.total ELSE 0 END), 0) AS piutang_berjalan,
      COUNT(CASE WHEN pj.status = 'draf' THEN 1 END)::integer AS jumlah_draf
    FROM public.pesanan_jual pj
    GROUP BY pj.dibuat_oleh
  )
  SELECT
    sp.id AS sales_id,
    sp.nama_lengkap AS nama_sales,
    COALESCE(sp.email, '-') AS email,
    sp.aktif,
    COALESCE(tp.jumlah_pesanan, 0) AS jumlah_pesanan,
    COALESCE(tp.pesanan_dikirim, 0) AS pesanan_dikirim,
    COALESCE(tp.pesanan_lunas, 0) AS pesanan_lunas,
    COALESCE(tp.total_omzet, 0) AS total_omzet,
    COALESCE(tp.total_hpp, 0) AS total_hpp,
    (COALESCE(tp.total_omzet, 0) - COALESCE(tp.total_hpp, 0)) AS total_margin,
    CASE
      WHEN COALESCE(tp.total_omzet, 0) > 0 THEN
        round(((COALESCE(tp.total_omzet, 0) - COALESCE(tp.total_hpp, 0)) / tp.total_omzet * 100.0), 2)
      ELSE 0
    END AS margin_persen,
    COALESCE(st.piutang_berjalan, 0) AS piutang_berjalan,
    COALESCE(st.jumlah_draf, 0) AS jumlah_draf
  FROM sales_profiles sp
  LEFT JOIN transaksi_periode tp ON tp.sales_id = sp.id
  LEFT JOIN status_terkini st ON st.sales_id = sp.id
  ORDER BY total_omzet DESC, total_margin DESC, sp.nama_lengkap ASC;
END;
$$;
```

---

### B. Fungsi 2: `rpc_analitik_top_pelanggan`
Mengagregasi pelanggan teratas dengan kontribusi persentase terhadap total omzet dan status limit kredit terkini.

```sql
CREATE OR REPLACE FUNCTION public.rpc_analitik_top_pelanggan(
  p_dari   date DEFAULT NULL,
  p_sampai date DEFAULT NULL,
  p_limit  integer DEFAULT 10
)
RETURNS TABLE (
  pelanggan_id            uuid,
  kode                    text,
  nama_toko               text,
  telepon                 text,
  jumlah_pesanan          integer,
  total_omzet             numeric,
  total_hpp               numeric,
  total_margin            numeric,
  margin_persen           numeric,
  kontribusi_omzet_persen numeric,
  batas_kredit            numeric,
  sisa_kredit             numeric,
  status_kredit           text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dari        date;
  v_sampai      date;
  v_total_semua numeric;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_sampai := COALESCE(p_sampai, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_dari   := COALESCE(p_dari, v_sampai - interval '7 weeks');

  -- Hitung total keseluruhan omzet pada periode ini untuk pembagi kontribusi %
  SELECT COALESCE(SUM(pj.total), 0)
  INTO v_total_semua
  FROM public.pesanan_jual pj
  WHERE pj.status IN ('dikirim', 'lunas')
    AND pj.dikirim_pada IS NOT NULL
    AND (pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_dari AND v_sampai;

  RETURN QUERY
  WITH pelanggan_omzet AS (
    SELECT
      pj.pelanggan_id,
      COUNT(DISTINCT pj.id)::integer AS jml_pesanan,
      COALESCE(SUM(pj.total), 0) AS omzet_cust,
      COALESCE(SUM(ip_sub.hpp_total), 0) AS hpp_cust
    FROM public.pesanan_jual pj
    LEFT JOIN LATERAL (
      SELECT SUM(COALESCE(ip.hpp_satuan, 0) * ip.jumlah) AS hpp_total
      FROM public.item_pesanan_jual ip
      WHERE ip.pesanan_jual_id = pj.id
    ) ip_sub ON true
    WHERE pj.status IN ('dikirim', 'lunas')
      AND pj.dikirim_pada IS NOT NULL
      AND (pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_dari AND v_sampai
    GROUP BY pj.pelanggan_id
  )
  SELECT
    p.id AS pelanggan_id,
    p.kode,
    p.nama_toko,
    p.telepon,
    po.jml_pesanan AS jumlah_pesanan,
    po.omzet_cust AS total_omzet,
    po.hpp_cust AS total_hpp,
    (po.omzet_cust - po.hpp_cust) AS total_margin,
    CASE
      WHEN po.omzet_cust > 0 THEN
        round(((po.omzet_cust - po.hpp_cust) / po.omzet_cust * 100.0), 2)
      ELSE 0
    END AS margin_persen,
    CASE
      WHEN v_total_semua > 0 THEN
        round((po.omzet_cust / v_total_semua * 100.0), 2)
      ELSE 0
    END AS kontribusi_omzet_persen,
    p.batas_kredit,
    kr.sisa_kredit,
    CASE
      WHEN kr.faktur_overdue_count > 0 THEN 'overdue'
      WHEN kr.sisa_kredit <= 0 AND p.batas_kredit > 0 THEN 'overlimit'
      ELSE 'lancar'
    END AS status_kredit
  FROM pelanggan_omzet po
  JOIN public.pelanggan p ON p.id = po.pelanggan_id
  CROSS JOIN LATERAL public.fn_hitung_kredit_pelanggan(p.id) kr
  ORDER BY po.omzet_cust DESC, total_margin DESC
  LIMIT LEAST(GREATEST(1, p_limit), 50);
END;
$$;
```

---

### C. Fungsi 3: `rpc_analitik_pelanggan_tidak_aktif`
Mengidentifikasi pelanggan aktif yang tidak melakukan pemesanan dalam $\ge X$ hari terakhir.

```sql
CREATE OR REPLACE FUNCTION public.rpc_analitik_pelanggan_tidak_aktif(
  p_ambang_hari integer DEFAULT 30
)
RETURNS TABLE (
  pelanggan_id             uuid,
  kode                     text,
  nama_toko                text,
  telepon                  text,
  alamat                   text,
  terdaftar_pada           timestamptz,
  pesanan_terakhir_pada    timestamptz,
  nomor_pesanan_terakhir   text,
  hari_tidak_aktif         integer,
  total_pesanan_historis   integer,
  total_omzet_historis     numeric,
  piutang_berjalan         numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hari_ini   date;
  v_ambang     integer;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_ambang := GREATEST(7, COALESCE(p_ambang_hari, 30));
  v_hari_ini := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  RETURN QUERY
  WITH order_terakhir AS (
    SELECT DISTINCT ON (pj.pelanggan_id)
      pj.pelanggan_id,
      pj.nomor,
      pj.dikirim_pada,
      (pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date AS tgl_kirim
    FROM public.pesanan_jual pj
    WHERE pj.status IN ('dikirim', 'lunas')
      AND pj.dikirim_pada IS NOT NULL
    ORDER BY pj.pelanggan_id, pj.dikirim_pada DESC
  ),
  rekap_historis AS (
    SELECT
      pj.pelanggan_id,
      COUNT(pj.id)::integer AS total_order,
      COALESCE(SUM(pj.total), 0) AS total_omzet,
      COALESCE(SUM(CASE WHEN pj.status = 'dikirim' THEN pj.total ELSE 0 END), 0) AS outstanding_piutang
    FROM public.pesanan_jual pj
    WHERE pj.status IN ('dikirim', 'lunas')
    GROUP BY pj.pelanggan_id
  )
  SELECT
    p.id AS pelanggan_id,
    p.kode,
    p.nama_toko,
    p.telepon,
    p.alamat,
    p.dibuat_pada AS terdaftar_pada,
    ot.dikirim_pada AS pesanan_terakhir_pada,
    ot.nomor AS nomor_pesanan_terakhir,
    CASE
      WHEN ot.tgl_kirim IS NOT NULL THEN (v_hari_ini - ot.tgl_kirim)::integer
      ELSE (v_hari_ini - (p.dibuat_pada AT TIME ZONE 'Asia/Jakarta')::date)::integer
    END AS hari_tidak_aktif,
    COALESCE(rh.total_order, 0) AS total_pesanan_historis,
    COALESCE(rh.total_omzet, 0) AS total_omzet_historis,
    COALESCE(rh.outstanding_piutang, 0) AS piutang_berjalan
  FROM public.pelanggan p
  LEFT JOIN order_terakhir ot ON ot.pelanggan_id = p.id
  LEFT JOIN rekap_historis rh ON rh.pelanggan_id = p.id
  WHERE p.aktif = true
    AND (
      ot.tgl_kirim IS NULL
      OR (v_hari_ini - ot.tgl_kirim) >= v_ambang
    )
  ORDER BY hari_tidak_aktif DESC, total_omzet_historis DESC;
END;
$$;
```

---

### D. Fungsi 4: `rpc_analitik_barang_tidak_bergerak`
Mendeteksi barang aktif yang memiliki stok fisik di gudang namun tidak ada penjualan selama $\ge X$ hari terakhir, beserta perhitungan modal tertahan (*dead capital*).

```sql
CREATE OR REPLACE FUNCTION public.rpc_analitik_barang_tidak_bergerak(
  p_ambang_hari integer DEFAULT 30
)
RETURNS TABLE (
  barang_id                uuid,
  kode                     text,
  nama                     text,
  satuan                   text,
  stok_saat_ini            integer,
  stok_minimum             integer,
  harga_pokok              numeric,
  harga_jual               numeric,
  nilai_stok_mengendap     numeric,
  penjualan_terakhir_pada  timestamptz,
  nomor_pesanan_terakhir   text,
  hari_mengendap           integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hari_ini   date;
  v_ambang     integer;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_ambang := GREATEST(7, COALESCE(p_ambang_hari, 30));
  v_hari_ini := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  RETURN QUERY
  WITH penjualan_terakhir AS (
    SELECT DISTINCT ON (ip.barang_id)
      ip.barang_id,
      pj.nomor,
      pj.dikirim_pada,
      (pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date AS tgl_kirim
    FROM public.item_pesanan_jual ip
    JOIN public.pesanan_jual pj ON pj.id = ip.pesanan_jual_id
    WHERE pj.status IN ('dikirim', 'lunas')
      AND pj.dikirim_pada IS NOT NULL
    ORDER BY ip.barang_id, pj.dikirim_pada DESC
  )
  SELECT
    b.id AS barang_id,
    b.kode,
    b.nama,
    b.satuan,
    b.stok AS stok_saat_ini,
    b.stok_minimum,
    b.harga_pokok,
    b.harga_jual,
    (b.stok * b.harga_pokok) AS nilai_stok_mengendap,
    pt.dikirim_pada AS penjualan_terakhir_pada,
    pt.nomor AS nomor_pesanan_terakhir,
    CASE
      WHEN pt.tgl_kirim IS NOT NULL THEN (v_hari_ini - pt.tgl_kirim)::integer
      ELSE (v_hari_ini - (b.dibuat_pada AT TIME ZONE 'Asia/Jakarta')::date)::integer
    END AS hari_mengendap
  FROM public.barang b
  LEFT JOIN penjualan_terakhir pt ON pt.barang_id = b.id
  WHERE b.aktif = true
    AND b.stok > 0
    AND (
      pt.tgl_kirim IS NULL
      OR (v_hari_ini - pt.tgl_kirim) >= v_ambang
    )
  ORDER BY nilai_stok_mengendap DESC, hari_mengendap DESC;
END;
$$;
```

---

## 4. Perlindungan Keamanan 3 Lapis (3-Tier Protection)

```
[Permintaan HTTP / Browser]
           │
           ▼
┌────────────────────────────────────────────────────────┐
│ Lapisan 1: Route Guard & Middleware (src/lib/akses.ts)  │
│ - Memeriksa token sesi & peran aktif                   │
│ - Rute /analitik & /api/analitik/* DIBLOKIR untuk      │
│   Penjualan dan Gudang -> 403 / Redirect               │
└────────────────────────────────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────────────────────┐
│ Lapisan 2: Server Component (src/app/analitik/page.tsx) │
│ - Eksekusi getProfil() di lingkungan server           │
│ - if (profil.peran !== 'manajer') redirect('/tidak-    │
│   berwenang')                                          │
│ - Data rahasia HPP/margin TIDAK PERNAH dikirim via     │
│   props ke komponen non-Manajer                        │
└────────────────────────────────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────────────────────┐
│ Lapisan 3: Database RPC Postgres (SECURITY DEFINER)    │
│ - IF NOT public.fn_is_manajer() THEN                   │
│     RAISE EXCEPTION 'Akses ditolak' (E0001)            │
│   END IF;                                              │
│ - Kebijakan RLS & Column Grants tetap aktif            │
└────────────────────────────────────────────────────────┘
```

---

## 5. Rancangan Antarmuka Pengguna (UI/UX) di `/analitik`

### A. Tata Letak Tab & Header Halaman
- **Header Halaman**:
  - Judul: `"Analitik Pelanggan & Performa Sales"`
  - Deskripsi: `"Evaluasi performa penjualan, loyalitas pelanggan, akun pasif, dan persediaan lambat bergerak."`
  - Tombol Aksi: `"Ekspor CSV"` (sesuai tab aktif).
- **Tab Navigasi**:
  1. `Tab 1: Performa Sales` (Kinerja tim penjualan)
  2. `Tab 2: Pelanggan Teratas` (Kontribusi omzet & margin pelanggan)
  3. `Tab 3: Pelanggan Tidak Aktif` (Dormant customers / At-risk churn)
  4. `Tab 4: Barang Tidak Bergerak` (Dead stock & modal tertahan)

### B. Filter Bar Interaktif
- **Untuk Tab 1 & Tab 2 (Berbasis Periode Transaksi)**:
  - Preset: `4 Minggu`, `8 Minggu (Default)`, `12 Minggu`, `Kustom`.
  - DatePicker `Dari` dan `Sampai`.
- **Untuk Tab 3 & Tab 4 (Berbasis Ambang Batas Hari Inaktivitas)**:
  - Preset Dropdown: `30 Hari Terakhir`, `60 Hari Terakhir`, `90 Hari Terakhir`, `180 Hari Terakhir`.

### C. Ringkasan Kartu KPI per Tab
- **Tab 1**: Total Omzet Tim, Total Margin Tim, Rata-rata Margin %, Total Piutang Berjalan Sales.
- **Tab 2**: Total Omzet Top 10, Total Laba Kotor Top 10, % Penguasaan Omzet dari Total Perusahaan.
- **Tab 3**: Jumlah Pelanggan Pasif, Total Riwayat Omzet yang Terancam, Total Piutang Masih Menggantung.
- **Tab 4**: Jumlah Barang Mengendap, Total Unit Fisik Tertahan, **Total Nilai Modal Tertahan (Rp)** (diberi penanda visual peringatan amber/danger).

---

## 6. Format Ekspor Berkas CSV (`/api/analitik/csv`)

Endpoint Route Handler: `/api/analitik/csv?tipe=[sales|pelanggan|dormant|deadstock]`
- Memeriksa otorisasi Manajer di server (`getProfil()`). Jika bukan manajer, mengembalikan response 403 Forbidden.
- Mengembalikan berkas CSV dengan header `Content-Type: text/csv; charset=utf-8` dan diawali UTF-8 BOM `\uFEFF`.
- Kolom CSV:
  1. **Sales**: `Nama Staf, Email, Status, Pesanan Selesai, Total Omzet (Rp), Total HPP (Rp), Margin Kotor (Rp), Margin (%), Piutang Berjalan (Rp), Draf Aktif`
  2. **Top Pelanggan**: `Kode, Nama Toko, Telepon, Jml Transaksi, Total Omzet (Rp), Total HPP (Rp), Margin Kotor (Rp), Margin (%), Kontribusi Omzet (%), Limit Kredit (Rp), Sisa Plafon (Rp), Status Kredit`
  3. **Dormant**: `Kode, Nama Toko, Telepon, Terdaftar Sejak, Pesanan Terakhir, No Pesanan Terakhir, Hari Tidak Aktif, Total Order Historis, Total Omzet Historis (Rp), Sisa Piutang (Rp)`
  4. **Dead Stock**: `Kode Barang, Nama Barang, Satuan, Stok Fisik, Stok Min, Harga Pokok (Rp), Harga Jual (Rp), Modal Tertahan (Rp), Penjualan Terakhir, No SO Terakhir, Hari Mengendap`

---

## 7. Rencana Pengujian Test Cases (TC-126 s.d. TC-145)

Melanjutkan penomoran resmi dari [`docs/03-test-plan.md`](03-test-plan.md):

| ID | Fokus Uji | Aktor | Media | Kriteria Evaluasi & Ekspektasi Hasil |
|---|---|---|---|---|
| **TC-126** | Akurasi Agregat Performa Sales (`rpc_analitik_performa_sales`) | M | SQL + Vitest | Omzet, HPP, margin kotor, dan jumlah pesanan per sales terhitung presisi sesuai pesanan dikirim/lunas. |
| **TC-127** | Penanganan Staf Penjualan dengan 0 Transaksi | M | SQL | Staf penjualan tanpa transaksi tetap muncul dengan omzet Rp0, margin Rp0, tanpa error pembagian nol (`margin_persen = 0`). |
| **TC-128** | Akurasi Perhitungan Piutang Berjalan per Sales | M | SQL | Nilai pesanan berstatus `'dikirim'` yang belum lunas terakumulasi presisi pada kolom `piutang_berjalan`. |
| **TC-129** | Akurasi Kontribusi Omzet Top Pelanggan (`rpc_analitik_top_pelanggan`) | M | SQL + Vitest | Persentase kontribusi omzet terhadap total periode terhitung akurat (`(omzet_pelanggan / total_omzet_semua) * 100`). |
| **TC-130** | Penentuan Status Kredit Dinamis Top Pelanggan | M | SQL | Pelanggan dengan faktur jatuh tempo mendapat status `'overdue'`, limit habis `'overlimit'`, lainnya `'lancar'`. |
| **TC-131** | Pembatasan Limit Baris Top Pelanggan (Safe Limit Guard) | M | SQL | Parameter `p_limit` dibatasi maksimal 50 baris meskipun pemanggil meminta nilai lebih besar. |
| **TC-132** | Deteksi Pelanggan Tidak Aktif $\ge 30$ Hari (`rpc_analitik_pelanggan_tidak_aktif`) | M | SQL + Vitest | Pelanggan dengan order terakhir $\ge 30$ hari lalu muncul terurut dari hari inaktivitas terlama. |
| **TC-133** | Penanganan Pelanggan Baru yang Belum Pernah Bertransaksi | M | SQL | Pelanggan dengan 0 riwayat order tetap muncul dengan `pesanan_terakhir_pada = NULL` dan hari inaktivitas dihitung sejak tanggal dibuat. |
| **TC-134** | Eksklusi Pelanggan Nonaktif (`aktif = false`) pada Dormant List | M | SQL | Pelanggan nonaktif tidak dimasukkan ke dalam daftar retensi pelanggan pasif. |
| **TC-135** | Deteksi Barang Tidak Bergerak $\ge 30$ Hari (`rpc_analitik_barang_tidak_bergerak`) | M | SQL + Vitest | Barang dengan stok $> 0$ yang tidak laku dalam $\ge 30$ hari terdeteksi akurat. |
| **TC-136** | Kalkulasi Nilai Modal Tertahan (Dead Capital) | M | SQL + Vitest | `nilai_stok_mengendap` terhitung presisi (`stok * harga_pokok`). |
| **TC-137** | Eksklusi Barang Stok Nol dari Analitik Dead Stock | M | SQL | Barang tanpa transaksi tetapi memiliki `stok = 0` tidak masuk ke daftar dead stock. |
| **TC-138** | Penanganan Barang Baru Belum Pernah Terjual | M | SQL | Barang belum pernah terjual memiliki `penjualan_terakhir_pada = NULL` dan hari mengendap dihitung dari tanggal registrasi barang. |
| **TC-139** | Pemblokiran Akses Staf Penjualan pada Semua RPC Analitik | P | SQL | Eksekusi seluruh 4 RPC analitik oleh Staf Penjualan ditolak tegas dengan kode error `E0001` (Akses ditolak). |
| **TC-140** | Pemblokiran Akses Staf Gudang pada Semua RPC Analitik | G | SQL | Eksekusi seluruh 4 RPC analitik oleh Staf Gudang ditolak tegas dengan kode error `E0001` (Akses ditolak). |
| **TC-141** | Pemblokiran Akses Pengguna Anonim | Anon | SQL | Pemanggilan tanpa token auth ditolak izin eksekusi (`permission denied`). |
| **TC-142** | Proteksi Route Guard & Middleware Halaman `/analitik` | P, G | Route Guard | Penjualan dan Gudang yang mengakses URL `/analitik` dialihkan ke `/tidak-berwenang` (HTTP 403). |
| **TC-143** | Proteksi Route Handler Ekspor CSV `/api/analitik/csv` | P, G | Server Route | Permintaan GET oleh non-Manajer menerima respon `403 Forbidden`. |
| **TC-144** | Zero-Leakage Data Rahasia HPP & Modal Tertahan | Network / DOM | Inspection | Verifikasi respon JSON jaringan browser pada akun non-Manajer tidak mengandung `harga_pokok`, `total_hpp`, atau `nilai_stok_mengendap`. |
| **TC-145** | Validasi Integritas Ekspor Berkas CSV (RFC 4180 & UTF-8 BOM) | M | Unit Test | Berkas CSV memuat BOM `\uFEFF`, baris header lengkap, pemisah koma ter-escape tanda kutip untuk teks nama/alamat. |

---

## 8. Manajemen Risiko & Pertanyaan Terbuka

### A. Analisis Risiko Teknis & Solusi Mitigasi
1. **Risiko Query Berat pada Tabel Item Pesanan Besar**:
   - *Mitigasi:* Menggunakan kueri berbasis indeks `dikirim_pada` dan filter awal `status IN ('dikirim', 'lunas')`. Menggunakan `DISTINCT ON` terindeks untuk mencari transaksi terakhir per pelanggan/barang.
2. **Risiko Kebocoran Informasi HPP Melalui Ekspor CSV**:
   - *Mitigasi:* Route handler ekspor CSV menerapkan pemeriksaan ganda peran `getProfil()` di level server runtime, dan memanfaatkan RPC `SECURITY DEFINER` yang otomatis menolak eksekusi jika bukan manajer.
3. **Risiko Ambiguitas Pesanan Dibatalkan Terhitung Penjualan**:
   - *Mitigasi:* Hanya status `'dikirim'` dan `'lunas'` yang diakui. Pesanan batal/draf diabaikan secara tegas di level SQL.

### B. Keputusan Desain Konservatif Terpilih
- **Q1:** Apakah Staf Penjualan diizinkan melihat performa dirinya sendiri di halaman `/analitik`?
  - *Keputusan Terpilih:* **Dilarang keras (Khusus Manajer).** Staf Penjualan sudah memiliki widget personal di dasbor utama ("Tugas Hari Ini"). Modul `/analitik` memuat perbandingan antar-sales, margin laba, dan modal tertahan yang merupakan rahasia manajerial tingkat tinggi.
- **Q2:** Bagaimana jika barang tidak bergerak memiliki `harga_pokok = 0` (belum diatur HPP-nya)?
  - *Keputusan Terpilih:* `nilai_stok_mengendap` menghasilkan 0 dan tetap ditampilkan agar Manajer sadar bahwa barang tersebut belum memiliki kalkulasi HPP yang valid.

---

## 9. Hasil Implementasi & Catatan Rilis

Fitur **Analitik Pelanggan dan Performa Sales** telah selesai diimplementasikan secara penuh sesuai spesifikasi otoritatif.

### A. Deliverable yang Telah Selesai:
1. **Database & Migrasi Supabase**:
   - Berkas migrasi: [`supabase/migrations/20261023043000_analitik.sql`](../supabase/migrations/20261023043000_analitik.sql)
   - Fungsi `public.rpc_analitik_performa_sales`: Agregasi omzet, HPP, margin kotor, pesanan selesai, piutang berjalan per sales, dan penanganan division-by-zero.
   - Fungsi `public.rpc_analitik_top_pelanggan`: Pareto pelanggan teratas dengan kontribusi omzet %, status limit kredit dinamis, dan safe limit guard maks 50 baris.
   - Fungsi `public.rpc_analitik_pelanggan_tidak_aktif`: Deteksi akun pasif $\ge X$ hari dan penanganan pelanggan baru tanpa riwayat transaksi.
   - Fungsi `public.rpc_analitik_barang_tidak_bergerak`: Deteksi dead stock $\ge X$ hari dengan modal tertahan (HPP) dan eksklusi barang stok 0.
2. **Keamanan & Otorisasi 3 Lapis**:
   - Lapisan 1: Route Guard di [`src/lib/akses.ts`](../src/lib/akses.ts) membatasi `/analitik` hanya untuk Manajer.
   - Lapisan 2: Server Component di [`src/app/(dashboard)/analitik/page.tsx`](../src/app/(dashboard)/analitik/page.tsx) me-redirect non-Manajer ke `/tidak-berwenang`.
   - Lapisan 3: Database RPC memvalidasi `fn_is_manajer()` dan melempar `E0001` (Akses ditolak).
3. **Ekspor CSV Aman dari Injeksi Rumus Spreadsheet**:
   - Utilitas sanitasi OWASP di [`src/features/analitik/utils.ts`](../src/features/analitik/utils.ts) (escape formula `=`, `+`, `-`, `@`, `\t`, `\r` dengan prefix petik tunggal `'`).
   - Route handler khusus Manajer di [`src/app/api/analitik/csv/route.ts`](../src/app/api/analitik/csv/route.ts) dengan UTF-8 BOM `\uFEFF`.
4. **Antarmuka Pengguna Next.js & Grafik Recharts**:
   - Modul antarmuka di [`src/features/analitik/`](../src/features/analitik/):
     * Tab Navigasi interaktif: Sales, Top Pelanggan, Dormant, Dead Stock.
     * Filter Bar: preset periode transaksi (4, 8, 12 minggu, kustom) dan preset ambang hari (30, 60, 90, 180 hari).
     * Grafik BarChart Recharts bergaya enterprise pada tab Sales dan Top Pelanggan.
     * KPI Cards dan DataTable padat dengan format rupiah dan persentase tabular.
     * Navigasi Sidebar terintegrasi di kategori *Keuangan & Laporan*.
5. **Suite Uji Lengkap (TC-126 s.d. TC-145)**:
   - `supabase/tests/10_analitik.sql`: 15 skenario SQL (TC-126 s.d. TC-140) 100% Lulus.
   - `src/features/analitik/__tests__/utils.test.ts`: 5 skenario Vitest sanitasi CSV dan formula injection (TC-145) 100% Lulus.

