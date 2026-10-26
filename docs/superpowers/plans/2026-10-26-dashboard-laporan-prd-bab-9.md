# Dashboard dan Laporan Manajer Sesuai PRD Bab 9 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyesuaikan Dashboard Manajer dan modul `/laporan` agar 100% patuh pada PRD Bab 9 (omzet & margin bulan berjalan, piutang berjalan dikonfirmasi+dikirim, stok menipis aktif, grafik 8 minggu terakhir, daftar PO menunggu, tabel 5 barang margin terkecil, tepat 3 kelompok aging piutang, format baku Rp1.250.000, dan zero-leakage untuk Penjualan & Gudang).

**Architecture:** Logika perhitungan agregat keuangan dan aging piutang diimplementasikan di fungsi basis data PostgreSQL (`SECURITY DEFINER` dengan pengaman peran `fn_is_manajer()`). Frontend Next.js (App Router Server Components) memanggil RPC tersebut dan merender tampilan enterprise yang padat, presisi, dan aman.

**Tech Stack:** Next.js 15 (App Router), Supabase (PostgreSQL 15 PL/pgSQL RPC), TypeScript (strict), Tailwind CSS, Recharts, Vitest.

**Spec:** [`docs/PRD_ERP.md`](file:///c:/Users/ASUS/Documents/Bootcamp%20Web%20Pro%20PLAN/erp-sinar-abadi-niaga-app/erp-sinar-abadi-niaga-app/docs/PRD_ERP.md) (Bab 9), [`docs/00-spesifikasi.md`](file:///c:/Users/ASUS/Documents/Bootcamp%20Web%20Pro%20PLAN/erp-sinar-abadi-niaga-app/erp-sinar-abadi-niaga-app/docs/00-spesifikasi.md), [`AGENTS.md`](file:///c:/Users/ASUS/Documents/Bootcamp%20Web%20Pro%20PLAN/erp-sinar-abadi-niaga-app/erp-sinar-abadi-niaga-app/AGENTS.md).

## Global Constraints

- Semua logika bisnis dan agregasi finansial berada di fungsi database (RPC Postgres), bukan di kode klien Next.js.
- Nilai rahasia (`harga_pokok`, `harga_beli_satuan`, `hpp_satuan`, `margin`) tidak boleh muncul di respons API, log, pesan error, atau kode/bundle klien non-Manajer (Penjualan & Gudang).
- Perhitungan tanggal bisnis berbasis zona waktu Asia/Jakarta: `(now() AT TIME ZONE 'Asia/Jakarta')::date`.
- Piutang berjalan mencakup total pesanan berstatus `dikonfirmasi` dan `dikirim`.
- Total aging piutang harus 100% sama dengan piutang berjalan, terbagi tepat dalam 3 kelompok: belum jatuh tempo, lewat 1–30 hari, lewat >30 hari. Jatuh tempo "lewat" berarti `jatuh_tempo < hari ini (WIB)`.
- Format uang rupiah baku tanpa spasi: `Rp1.250.000`.

## Review Focus

1. `Total Aging vs Piutang Berjalan`: Pesanan `dikonfirmasi` belum memiliki tanggal kirim/jatuh tempo; wajib dimasukkan ke kelompok "belum jatuh tempo" sehingga total aging identik dengan piutang berjalan.
2. `Zero Data Leakage`: Dashboard Penjualan dan Gudang tidak boleh menerima prop atau membaca kolom finansial rahasia (HPP/margin).
3. `Stok Menipis Aktif`: Barang nonaktif (`aktif = false`) dengan `stok <= stok_minimum` tidak boleh dihitung dalam metrik peringatan stok menipis.
4. `Grafik 8 Minggu Independen`: Grafik performa mingguan selalu menampilkan 8 minggu terakhir terlepas dari filter bulan berjalan pada kartu KPI.
5. `5 Barang Margin Terkecil`: Query produk dengan margin terkecil harus mengurutkan `total_margin ASC` untuk produk yang terjual pada periode laporan.

---

### Task 1: Migrasi Database RPC Laporan & Aging Piutang (PRD Bab 9)

**Files:**
- Create: `supabase/migrations/20261026160000_dashboard_laporan_prd_bab_9.sql`
- Test: `supabase/tests/17_laporan_prd_bab_9.sql`

**Interfaces:**
- Produces:
  - `rpc_laporan_bottom_barang(p_dari date, p_sampai date, p_limit integer DEFAULT 5)`
  - `rpc_laporan_aging_piutang()` (mengembalikan `total_piutang_berjalan`, `belum_jatuh_tempo`, `lewat_1_30_hari`, `lewat_gt_30_hari`, `jumlah_pesanan_lewat_tempo`, `total_pesanan`)
  - `rpc_laporan_piutang()` (menambahkan `piutang_lewat_1_30` dan `piutang_lewat_gt_30`)
  - `rpc_laporan_piutang_pesanan(p_pelanggan_id uuid)` (mendukung pesanan `dikonfirmasi` dan 3 kelompok aging)

- [ ] **Step 1: Buat file migrasi SQL baru untuk RPC laporan PRD Bab 9**
  Buat `supabase/migrations/20261026160000_dashboard_laporan_prd_bab_9.sql` dengan `DROP FUNCTION IF EXISTS` dan implementasi:
  - `rpc_laporan_bottom_barang`: agregasi `total_margin ASC` dari pesanan `dikirim` dan `lunas`.
  - `rpc_laporan_aging_piutang`: menghitung `total_piutang_berjalan`, `belum_jatuh_tempo`, `lewat_1_30_hari`, `lewat_gt_30_hari` dari pesanan `dikonfirmasi` dan `dikirim`.
  - `rpc_laporan_piutang`: breakdown 3 kelompok umur tagihan per pelanggan.
  - `rpc_laporan_piutang_pesanan`: menampilkan pesanan `dikonfirmasi` (belum jatuh tempo) dan `dikirim` dengan klasifikasi 3 kelompok aging.
  - Penegakan `SECURITY DEFINER SET search_path = public, pg_temp`, cek `fn_is_manajer()`, dan izin hak akses `REVOKE FROM PUBLIC, anon; GRANT TO authenticated;`.

- [ ] **Step 2: Buat berkas uji SQL `supabase/tests/17_laporan_prd_bab_9.sql`**
  Memverifikasi:
  1. `rpc_laporan_bottom_barang` mengembalikan barang urut margin terendah.
  2. `rpc_laporan_aging_piutang` menghasilkan `total_piutang_berjalan = belum_jatuh_tempo + lewat_1_30_hari + lewat_gt_30_hari`.
  3. Non-manajer (penjualan, gudang) ditolak dengan error `E0001` saat memanggil fungsi-fungsi ini.

- [ ] **Step 3: Jalankan verifikasi SQL dan perbarui database types jika diperlukan**
  Pastikan skema valid dan tidak ada konflik SQL.

---

### Task 2: Pembaruan Tipe Data & Unit Test Vitest

**Files:**
- Modify: `src/features/laporan/types.ts`
- Modify: `src/features/laporan/__tests__/laporan.test.ts`

**Interfaces:**
- Consumes: Tipe database dan antarmuka RPC
- Produces: Definisi tipe TypeScript yang selaras untuk komponen UI laporan & dashboard

- [ ] **Step 1: Perbarui tipe di `src/features/laporan/types.ts`**
  - Perbarui `LaporanAgingPiutang` memuat `total_piutang_berjalan`, `belum_jatuh_tempo`, `lewat_1_30_hari`, `lewat_gt_30_hari`, `jumlah_pesanan_lewat_tempo`, `total_pesanan`.
  - Perbarui `LaporanPiutangPelangganItem` memuat `piutang_lewat_1_30` dan `piutang_lewat_gt_30`.
  - Perbarui `LaporanPiutangPesananItem` memuat `kategori_aging: 'belum_jatuh_tempo' | '1-30_hari' | '>30_hari'`.
  - Tambahkan antarmuka `BottomBarangItem` (atau alias ke `TopBarangItem`).

- [ ] **Step 2: Perbarui unit test di `src/features/laporan/__tests__/laporan.test.ts`**
  - Tambahkan pengujian pemetaan tepat 3 kelompok aging: `belum_jatuh_tempo`, `1-30_hari`, `>30_hari`.
  - Tambahkan pengujian invarian: `total_piutang_berjalan === belum_jatuh_tempo + lewat_1_30_hari + lewat_gt_30_hari`.
  - Tambahkan pengujian format uang `formatRupiah` tidak boleh mengandung spasi atau singkatan `jt`.

- [ ] **Step 3: Jalankan Vitest untuk memverifikasi tes lulus**
  Jalankan: `npx vitest run src/features/laporan/__tests__/laporan.test.ts`

---

### Task 3: Komponen Tabel 5 Barang Margin Terkecil di `/laporan`

**Files:**
- Create: `src/features/laporan/components/bottom-barang-table.tsx` (atau update `top-barang-table.tsx`)
- Modify: `src/app/(dashboard)/laporan/page.tsx`

**Interfaces:**
- Consumes: `rpc_laporan_bottom_barang`
- Produces: Komponen tabel 5 barang margin terkecil yang tampil di samping tabel 10 terbesar

- [ ] **Step 1: Buat komponen `BottomBarangTable` di `src/features/laporan/components/bottom-barang-table.tsx`**
  Menampilkan tabel rapi bergaya enterprise dengan judul "5 Barang Margin Terkecil", kolom: nomor urut (#), nama & kode barang, jumlah terjual, omzet, HPP, margin kotor, dan margin %.

- [ ] **Step 2: Perbarui `src/app/(dashboard)/laporan/page.tsx`**
  - Panggil `supabase.rpc('rpc_laporan_bottom_barang', { p_dari: dari, p_sampai: sampai, p_limit: 5 })` bersamaan dengan `rpc_laporan_top_barang`.
  - Letakkan `TopBarangTable` (10 terbesar) dan `BottomBarangTable` (5 terkecil) berdampingan dalam grid:
    `<div className="grid grid-cols-1 lg:grid-cols-2 gap-5"><TopBarangTable items={topBarang} /><BottomBarangTable items={bottomBarang} /></div>`.
  - Letakkan `TopPelangganTable` di baris berikutnya.

---

### Task 4: Pembaruan Tepat 3 Kelompok Aging Piutang di `/laporan/piutang`

**Files:**
- Modify: `src/features/laporan/components/piutang-aging-cards.tsx`
- Modify: `src/features/laporan/components/piutang-pelanggan-table.tsx`
- Modify: `src/features/laporan/components/piutang-pesanan-table.tsx`
- Modify: `src/app/(dashboard)/laporan/piutang/page.tsx`
- Modify: `src/app/api/laporan/piutang/csv/route.ts`

**Interfaces:**
- Consumes: `LaporanAgingPiutang`, `LaporanPiutangPelangganItem`, `LaporanPiutangPesananItem`
- Produces: Tampilan ringkasan aging dengan tepat 3 kelompok yang totalnya sama persis dengan piutang berjalan

- [ ] **Step 1: Perbarui `PiutangAgingCards` di `src/features/laporan/components/piutang-aging-cards.tsx`**
  - Ubah menjadi 4 kartu:
    1. Total Piutang Berjalan (`formatRupiah(aging.total_piutang_berjalan)`)
    2. Belum Jatuh Tempo (`formatRupiah(aging.belum_jatuh_tempo)`)
    3. Lewat 1–30 Hari (`formatRupiah(aging.lewat_1_30_hari)`)
    4. Lewat >30 Hari (`formatRupiah(aging.lewat_gt_30_hari)`)
  - Pastikan keterangan visual menegaskan bahwa ketiga kelompok aging menjumlahkan total piutang berjalan.

- [ ] **Step 2: Perbarui `PiutangPelangganTable` di `src/features/laporan/components/piutang-pelanggan-table.tsx`**
  - Tampilkan rincian umur tagihan per pelanggan: Belum Tempo, Lewat 1–30 Hari, dan Lewat >30 Hari.

- [ ] **Step 3: Perbarui `PiutangPesananTable` di `src/features/laporan/components/piutang-pesanan-table.tsx`**
  - Sesuaikan badge kategori aging ke 3 kelompok: `belum_jatuh_tempo` (Belum tempo), `1-30_hari` (Lewat X hr), `>30_hari` (Lewat X hr / Kritis).

- [ ] **Step 4: Perbarui rute CSV `src/app/api/laporan/piutang/csv/route.ts`**
  - Tambahkan kolom breakdown 3 kelompok umur tagihan: Belum Jatuh Tempo, Lewat 1-30 Hari, Lewat >30 Hari.

---

### Task 5: Penyesuaian Dashboard Manajer (PRD Bab 9)

**Files:**
- Modify: `src/app/(dashboard)/page.tsx`
- Modify: `src/features/dashboard/components/dashboard-kpi-row.tsx`
- Create: `src/features/dashboard/components/dashboard-po-menunggu.tsx`

**Interfaces:**
- Consumes: `rpc_laporan_ringkasan`, `rpc_laporan_margin_mingguan`, `rpc_laporan_aging_piutang`, `v_pembelian_manajer`
- Produces: Dashboard Manajer yang memuat omzet & margin bulan berjalan, piutang berjalan, stok menipis barang aktif, grafik 8 minggu terakhir, dan daftar PO menunggu

- [ ] **Step 1: Perbarui default filter ke Bulan Berjalan di `src/app/(dashboard)/page.tsx`**
  - Ubah default preset dari `minggu_ini` menjadi `bulan_ini`.
  - Hitung tanggal awal bulan dan hari ini berbasis zona waktu Asia/Jakarta.
  - Ganti label default menjadi "Bulan Berjalan".
  - Pastikan kueri stok menipis menambahkan `.eq("aktif", true)` agar hanya menghitung barang aktif.

- [ ] **Step 2: Ambil data grafik 8 minggu terakhir secara independen**
  - Hitung rentang 8 minggu terakhir (`dari8Minggu` s.d. `todayStr`).
  - Panggil `supabase.rpc("rpc_laporan_margin_mingguan", { p_dari: dari8Minggu, p_sampai: todayStr })` untuk data grafik batang 8 minggu terakhir.

- [ ] **Step 3: Ambil dan tampilkan Daftar Pengajuan Pembelian yang Menunggu**
  - Kueri `v_pembelian_manajer` dengan `.eq("status", "diajukan").order("diajukan_pada", { ascending: false })`.
  - Buat komponen `DashboardPoMenunggu` di `src/features/dashboard/components/dashboard-po-menunggu.tsx` untuk menampilkan daftar PO yang menunggu persetujuan Manajer dengan tautan/tombol cepat menuju halaman persetujuan.
  - Tampilkan komponen ini di dalam area khusus Manajer di `src/app/(dashboard)/page.tsx`.

- [ ] **Step 4: Standarisasi format uang di `src/features/dashboard/components/dashboard-kpi-row.tsx`**
  - Hapus format hardcoded `'Rp 284,5 jt'`, `'Rp 38,4 jt'`, atau `.replace('Rp', 'Rp ')`. Gunakan fungsi baku `formatRupiah(nilai)` (`Rp1.250.000`).
  - Verifikasi bahwa pada peran Staf Penjualan dan Staf Gudang, angka omzet, HPP, dan margin tidak pernah dikirim atau ditampilkan.

---

### Task 6: Verifikasi Regresi Menyeluruh & Dokumentasi

**Files:**
- Create: `docs/fitur-dashboard-laporan-prd-bab-9.md`
- Modify: `docs/03-test-plan.md`
- Modify: `docs/16-peta-sistem-saat-ini.md`

- [ ] **Step 1: Daftarkan Test Case baru TC-234 s.d. TC-238 di `docs/03-test-plan.md`**
  - TC-234: Omzet & margin bulan berjalan Manajer berbasis `dikirim_pada` Asia/Jakarta.
  - TC-235: Piutang berjalan mencakup pesanan dikonfirmasi + dikirim dan identik dengan total 3 kelompok aging.
  - TC-236: Perhitungan stok menipis hanya mencakup barang berstatus `aktif = true`.
  - TC-237: Tabel 5 barang margin terkecil tampil akurat berdampingan dengan 10 terbesar.
  - TC-238: Zero-leakage nilai finansial dan HPP pada dashboard Penjualan dan Gudang.

- [ ] **Step 2: Jalankan suite regresi lengkap**
  - `npx vitest run`
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm run build`

- [ ] **Step 3: Buat dokumentasi fitur `docs/fitur-dashboard-laporan-prd-bab-9.md` dan perbarui `docs/16-peta-sistem-saat-ini.md`**
