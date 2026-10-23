# Spesifikasi Teknis: Pusat Tugas Harian dan Daftar Ambil Barang (Picking List)

Dokumen ini adalah spesifikasi arsitektur dan implementasi teknis untuk fitur **Pusat Tugas Harian ("Tugas Hari Ini")** pada Dasbor Utama dan halaman operasional **Daftar Ambil Barang (*Picking List*)** untuk CV Sinar Abadi Niaga.

Rujukan Utama:
- [`docs/00-spesifikasi.md`](00-spesifikasi.md) (BR-01 s.d. BR-17)
- [`docs/02-matriks-akses.md`](02-matriks-akses.md)
- [`docs/03-test-plan.md`](03-test-plan.md) (TC-01 s.d. TC-110)
- [`docs/05-skema.md`](05-skema.md) & [`docs/16-peta-sistem-saat-ini.md`](16-peta-sistem-saat-ini.md)
- [`AGENTS.md`](../AGENTS.md) (Aturan Fitur Baru & Aturan Desain Sistem ERP)

---

## 1. Audit Kondisi Sistem Saat Ini (Fact & Gap Audit)

Berdasarkan inspeksi langsung terhadap skema basis data PostgreSQL (`supabase/migrations/`) dan struktur kode frontend (`src/`):

| No | Kebutuhan Fitur | Status di Sistem | Lokasi Otoritatif | Kesenjangan / Tindakan Diperlukan |
|---|---|---|---|---|
| 1 | **Penghitung Draf Milik Saya (Penjualan)** | Sudah ada data | Tabel `public.pesanan_jual` (`status = 'draf'`, `dibuat_oleh = auth.uid()`) | Belum ada RPC agregat satu pintu; saat ini frontend query ad-hoc atau tidak teragregasi. |
| 2 | **Penghitung Pesanan Menunggu Kirim (Penjualan)** | Sudah ada data | Tabel `public.pesanan_jual` (`status = 'dikonfirmasi'`, `dibuat_oleh = auth.uid()`) | Diperlukan agregasi di level basis data. |
| 3 | **Penghitung Pengajuan Harga Menunggu (Penjualan)** | Sudah ada data | Tabel `public.persetujuan_harga` (`status = 'menunggu'`, `diajukan_oleh = auth.uid()`) | Diperlukan kalkulasi di basis data. |
| 4 | **Penghitung Tagihan Tempo Hari Ini & Overdue (Penjualan)** | Sudah ada data | View `public.v_tagihan` (`klasifikasi = 'hari_ini'`, `klasifikasi LIKE 'overdue%'`, RLS `dibuat_oleh = auth.uid()`) | Perlu dimasukkan ke agregat dasbor per peran tanpa kalkulasi manual di komponen klien. |
| 5 | **Pesanan Dikonfirmasi Siap Kirim & Umur Tertua (Gudang)** | Sudah ada data | Tabel `public.pesanan_jual` (`status = 'dikonfirmasi'`) | Belum ada fungsi hitung selisih hari pesanan terkonfirmasi tertua berbasis `(now() AT TIME ZONE 'Asia/Jakarta')::date - dikonfirmasi_pada::date`. |
| 6 | **PO Disetujui Menunggu Penerimaan (Gudang)** | Sudah ada data | Tabel `public.pembelian` (`status = 'disetujui'`) | Belum diagregasi di dasbor gudang. |
| 7 | **Barang Stok Menipis (Gudang & Manajer)** | Sudah ada data | View `public.v_barang` (`stok_menipis = true`) | Perlu dihitung sebagai integer agregat di dasbor. |
| 8 | **Sesi Opname Berstatus Draf (Gudang)** | Sudah ada data | Tabel `public.opname_stok` (`status = 'draf'`) | Belum ada widget pemantau di dasbor gudang. |
| 9 | **Persetujuan Harga Menunggu Keputusan (Manajer)** | Sudah ada data | Tabel `public.persetujuan_harga` (`status = 'menunggu'`) | Sudah ada query ad-hoc di `src/app/(dashboard)/page.tsx`; perlu disatukan ke RPC agregat resmi. |
| 10 | **PO & Opname Menunggu Persetujuan (Manajer)** | Sudah ada data | Tabel `public.pembelian` (`status = 'diajukan'`) dan `public.opname_stok` (`status = 'diajukan'`) | Belum diagregasi dalam widget tugas terpadu manajer. |
| 11 | **Halaman Daftar Ambil Barang (`/gudang/picking`)** | **BELUM ADA** | - | Perlu dibuat halaman baru khusus Gudang dan Manajer dengan seleksi multi-pesanan terkonfirmasi. |
| 12 | **Fungsi Agregasi Picking List Multi-Pesanan** | **BELUM ADA** | - | Perlu fungsi RPC otoritatif `rpc_ambil_daftar_picking(p_pesanan_ids uuid[])` yang mengagregasikan barang tanpa data finansial/rahasia. |
| 13 | **Format Cetak Picking List (@media print)** | **BELUM ADA** | - | Perlu styling CSS print khusus dengan kop perusahaan, tanggal cetak Asia/Jakarta, dan kotak ceklis fisik. |

> **Catatan Audit Ketersediaan Fitur:** Seluruh tabel dan view yang dibutuhkan untuk widget telah tersedia lengkap di repositori (`pesanan_jual`, `pembelian`, `persetujuan_harga`, `opname_stok`, `v_tagihan`, `v_barang`). **Tidak ada widget yang dilewati**.

---

## 2. Prinsip Desain & Batasan Otoritas (T1 s.d. T7)

Sesuai arahan teknis dan aturan korporat:
1. **T1 (Murni Baca Data):** Fitur ini 100% read-only. Tidak membuat tabel baru, tidak mengubah state transaksi, dan tidak mengubah aturan bisnis yang berlaku. Seluruh kalkulasi agregat dihitung di dalam database engine PostgreSQL via RPC.
2. **T2 (Isolasi Visibilitas RLS & Zero-Leakage):**
   - Fungsi `rpc_get_tugas_harian` berjalan dengan identifikasi peran `public.fn_peran()` dan identitas pengguna `auth.uid()`.
   - Staf Penjualan **hanya menghitung pesanan dan tagihan miliknya sendiri**.
   - Gudang dan Penjualan sama sekali **tidak menerima nominal uang, HPP, harga jual, margin, atau diskon** di dasbor maupun di halaman picking list.
3. **T3 (Widget Tugas Hari Ini):** Ditampilkan di bagian atas Dasbor Utama (`/`).
   - Angka nol tampil netral (abu-abu/slate, tanpa alarm).
   - Angka $>0$ yang membutuhkan tindakan tampil dengan penanda visual tegas yang selaras dengan `BadgeStatus` (warning/amber untuk menunggu, danger/red untuk overdue/stok menipis, info/blue untuk siap kirim).
4. **T4 (Daftar Ambil Barang `/gudang/picking`):**
   - Hak Akses: Gudang dan Manajer. Staf Penjualan ditolak (HTTP 403 & RPC `E0001`/`E0065`).
   - Input: Array UUID pesanan terkonfirmasi (`p_pesanan_ids`).
   - Validasi: Minimal 1 pesanan terpilih (`E0063`). Semua pesanan wajib berstatus `dikonfirmasi` dan terlihat oleh pemanggil (`E0064`).
   - Output: Agregat kuantitas per barang (diurutkan `kode_barang ASC`) + rincian barang per pesanan.
   - Tanpa harga atau nilai uang apa pun.
   - Tampilan cetak profesional (@media print) mencakup kop CV Sinar Abadi Niaga, waktu cetak Asia/Jakarta, dan nama operator.
5. **T5 (Tanpa Kirim Massal):** Tidak ada pengiriman massal di halaman picking list. Pengiriman tetap dilakukan per pesanan melalui `rpc_kirim_pesanan` di halaman detail `/pesanan/[id]` (tersedia tautan langsung).
6. **T6 (Tanggal Bisnis Asia/Jakarta):** Seluruh perbandingan tanggal dan perhitungan umur pesanan menggunakan `(now() AT TIME ZONE 'Asia/Jakarta')::date`.
7. **T7 (Performa Tinggi & Tanpa Drift):** Seluruh ringkasan tugas harian diambil dalam **satu panggilan RPC tunggal** (`rpc_get_tugas_harian()`), bukan puluhan kueri individual. Komponen UI mengisolasi galat per widget tanpa menggagalkan seluruh halaman.

---

## 3. Rancangan Widget "Tugas Hari Ini" per Peran

Setiap widget memuat: Judul Tugas, Nilai Hitungan (Angka Tabular), Label Keterangan, Status Indikator Visual, dan Tautan Cepat terfilter.

### A. Peran Staf Penjualan (`penjualan`)
| Widget | Judul | Sumber Data & Kondisi SQL | Status Visual (Nilai > 0) | Tautan Tujuan |
|---|---|---|---|---|
| **W-P1** | Draf Pesanan Saya | `pesanan_jual WHERE dibuat_oleh = auth.uid() AND status = 'draf'` | Neutral / Slate | `/pesanan?status=draf` |
| **W-P2** | Menunggu Pengiriman | `pesanan_jual WHERE dibuat_oleh = auth.uid() AND status = 'dikonfirmasi'` | Info / Blue (Siap Diproses) | `/pesanan?status=dikonfirmasi` |
| **W-P3** | Pengajuan Harga Menunggu | `persetujuan_harga WHERE diajukan_oleh = auth.uid() AND status = 'menunggu'` | Warning / Amber (Menunggu Manajer) | `/pesanan?status=draf` |
| **W-P4** | Tagihan Tempo Hari Ini | `v_tagihan WHERE klasifikasi = 'hari_ini'` (milik sendiri via RLS) | Warning / Amber | `/penagihan?klasifikasi=hari_ini` |
| **W-P5** | Tagihan Menunggak (Overdue) | `v_tagihan WHERE klasifikasi LIKE 'overdue%'` (milik sendiri via RLS) | Danger / Red (Perlu Ditagih) | `/penagihan?klasifikasi=overdue` |

### B. Peran Staf Gudang (`gudang`)
| Widget | Judul | Sumber Data & Kondisi SQL | Status Visual (Nilai > 0) | Tautan Tujuan |
|---|---|---|---|---|
| **W-G1** | Pesanan Siap Kirim | `pesanan_jual WHERE status = 'dikonfirmasi'` | Warning / Amber (Antrean Gudang) | `/pesanan?status=dikonfirmasi`<br>*(tersedia tombol ke `/gudang/picking`)* |
| **W-G2** | Umur Pesanan Tertua | `MAX((now() AT TIME ZONE 'Asia/Jakarta')::date - dikonfirmasi_pada::date) WHERE status = 'dikonfirmasi'` | Danger jika $\ge 2$ hari, Amber jika 1 hari, Slate jika 0 hari | `/pesanan?status=dikonfirmasi` |
| **W-G3** | PO Menunggu Penerimaan | `pembelian WHERE status = 'disetujui'` | Info / Blue (Barang Datang) | `/pembelian?status=disetujui` |
| **W-G4** | Barang Stok Menipis | `v_barang WHERE stok_menipis = true` | Danger / Red (Perlu Restock) | `/barang?menipis=true` |
| **W-G5** | Sesi Opname Draf | `opname_stok WHERE status = 'draf'` | Neutral / Slate | `/stok/opname?status=draf` |

### C. Peran Manajer (`manajer`)
| Widget | Judul | Sumber Data & Kondisi SQL | Status Visual (Nilai > 0) | Tautan Tujuan |
|---|---|---|---|---|
| **W-M1** | Persetujuan Harga Menunggu | `persetujuan_harga WHERE status = 'menunggu'` | Warning / Amber (Perlu Putusan) | `/persetujuan` |
| **W-M2** | Pengadaan PO Diajukan | `pembelian WHERE status = 'diajukan'` | Warning / Amber (Perlu Putusan) | `/pembelian?status=diajukan` |
| **W-M3** | Stock Opname Diajukan | `opname_stok WHERE status = 'diajukan'` | Warning / Amber (Perlu Putusan) | `/stok/opname?status=diajukan` |
| **W-M4** | Tagihan Overdue Toko | `v_tagihan WHERE klasifikasi LIKE 'overdue%'` | Danger / Red (Risiko Piutang) | `/penagihan?klasifikasi=overdue` |
| **W-M5** | Tagihan Jatuh Tempo Hari Ini | `v_tagihan WHERE klasifikasi = 'hari_ini'` | Warning / Amber | `/penagihan?klasifikasi=hari_ini` |
| **W-M6** | Barang Stok Menipis | `v_barang WHERE stok_menipis = true` | Danger / Red (Restock Diperlukan) | `/barang?menipis=true` |

---

## 4. Rancangan Basis Data & Logika RPC

### A. Fungsi `public.rpc_get_tugas_harian()`
* **Sifat:** `SECURITY DEFINER`, `STABLE`, `SET search_path = public, pg_temp`.
* **Hak Eksekusi:** `GRANT EXECUTE TO authenticated`.
* **Prinsip Operasi:**
  1. Mengidentifikasi pemanggil via `v_peran := public.fn_peran();` dan `v_uid := auth.uid();`.
  2. Jika peran tidak dikenali, lemparkan `E0001` (Akses ditolak).
  3. Menghitung tanggal hari ini Asia/Jakarta: `v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;`.
  4. Menjalankan agregasi sesuai peran dalam satu query cepat dan mengembalikan JSONB murni.

```sql
-- Struktur JSONB Kembalian Penjualan:
{
  "peran": "penjualan",
  "draf_saya": 3,
  "menunggu_kirim_saya": 2,
  "persetujuan_harga_menunggu_saya": 1,
  "tagihan_tempo_hari_ini_saya": 1,
  "tagihan_overdue_saya": 2
}

-- Struktur JSONB Kembalian Gudang:
{
  "peran": "gudang",
  "pesanan_siap_kirim": 5,
  "umur_pesanan_tertua_hari": 2,
  "po_menunggu_penerimaan": 1,
  "stok_menipis": 4,
  "opname_draf": 1
}

-- Struktur JSONB Kembalian Manajer:
{
  "peran": "manajer",
  "persetujuan_harga_menunggu": 2,
  "po_menunggu_persetujuan": 1,
  "opname_menunggu_persetujuan": 1,
  "tagihan_overdue": 4,
  "tagihan_tempo_hari_ini": 2,
  "stok_menipis": 4
}
```

### B. Fungsi `public.rpc_ambil_daftar_picking(p_pesanan_ids uuid[])`
* **Sifat:** `SECURITY DEFINER`, `STABLE`, `SET search_path = public, pg_temp`.
* **Hak Eksekusi:** `GRANT EXECUTE TO authenticated` (Dicek di dalam fungsi: hanya Gudang dan Manajer).
* **Validasi Ketat:**
  1. Cek peran: Jika `v_peran NOT IN ('gudang', 'manajer')`, lemparkan `E0001` / `E0065`.
  2. Cek parameter array: Jika `p_pesanan_ids IS NULL OR array_length(p_pesanan_ids, 1) = 0`, lemparkan `E0063` (*"Pilih minimal satu pesanan untuk membuat daftar ambil barang"*).
  3. Validasi status pesanan:
     Hitung `v_valid_count` dari `pesanan_jual` di mana `id = ANY(p_pesanan_ids) AND status = 'dikonfirmasi'`.
     Jika `v_valid_count <> array_length(p_pesanan_ids, 1)`, lemparkan `E0064` (*"Terdapat pesanan yang tidak valid atau bukan berstatus dikonfirmasi"*).
* **Struktur Output JSONB (Zero-Leakage):**
```json
{
  "metadata": {
    "total_pesanan": 3,
    "total_item_barang": 5,
    "total_kuantitas": 120,
    "dibuat_pada": "2026-10-23T03:00:00+07:00",
    "dibuat_oleh_nama": "Budi Santoso",
    "dibuat_oleh_peran": "gudang"
  },
  "ringkasan_barang": [
    {
      "barang_id": "uuid-1",
      "kode_barang": "BRG-001",
      "nama_barang": "Beras Premium 5kg",
      "satuan": "karung",
      "total_diambil": 50,
      "stok_saat_ini": 120,
      "stok_cukup": true
    },
    {
      "barang_id": "uuid-2",
      "kode_barang": "BRG-002",
      "nama_barang": "Minyak Goreng 2L",
      "satuan": "pouch",
      "total_diambil": 70,
      "stok_saat_ini": 40,
      "stok_cukup": false
    }
  ],
  "rincian_pesanan": [
    {
      "pesanan_id": "uuid-so-1",
      "nomor": "SO-2026-000001",
      "dikonfirmasi_pada": "2026-10-22T10:00:00+07:00",
      "pelanggan_kode": "PEL-001",
      "pelanggan_nama": "Toko Berkah Jaya",
      "items": [
        {
          "barang_id": "uuid-1",
          "kode_barang": "BRG-001",
          "nama_barang": "Beras Premium 5kg",
          "satuan": "karung",
          "jumlah": 20
        }
      ]
    }
  ]
}
```

---

## 5. Rancangan Antarmuka Pengguna (UI & UX)

### A. Komponen Dasbor "Tugas Hari Ini" (`src/app/(dashboard)/page.tsx`)
1. **Tata Letak:**
   - Ditempatkan tepat di bawah Kartu Sambutan pengguna.
   - Header bagian: Judul `"Tugas Hari Ini"`, icon `CheckSquare` atau `ListTodo`, deskripsi singkat `"Antrean pekerjaan dan status operasional yang memerlukan perhatian Anda hari ini"`.
   - Grid Card responsif: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5`.
2. **Karakter Visual Card Widget:**
   - Card padat khas Enterprise ERP (`border-slate-200`, `rounded-md`, `p-3.5`).
   - Angka nol: Angka tabular abu-abu (`text-slate-400`), status netral.
   - Angka aktif:
     - Warning: Latar redup `bg-amber-50/50 border-amber-200`, angka `text-amber-800`.
     - Danger: Latar redup `bg-red-50/50 border-red-200`, angka `text-red-700`.
     - Info: Latar redup `bg-blue-50/50 border-blue-200`, angka `text-blue-800`.
   - Tombol/tautan cepat di bagian bawah card: `"Buka antrean →"` atau `"Lihat daftar →"`.
3. **Resiliensi & Error Handling:**
   - Menggunakan Suspense skeleton loader yang halus saat data memuat.
   - Jika fungsi tugas harian gagal, tampilkan banner alert redup tanpa mematikan komponen lain di dasbor.

### B. Halaman Daftar Ambil Barang (`/gudang/picking`)
1. **Navigasi & Akses:**
   - URL: `/gudang/picking`.
   - Ditambahkan pada menu Sidebar kategori **Inventory & Gudang** (khusus Gudang dan Manajer).
   - Tautan pintas dari widget Gudang/Manajer di Dasbor dan dari tombol di `/pesanan` (filter dikonfirmasi).
2. **Langkah 1: Seleksi Pesanan Dikonfirmasi**
   - Filter bar: Input pencarian nomor pesanan, dropdown pelanggan, filter rentang tanggal konfirmasi.
   - Tombol "Pilih Semua" (Select All) dan penghitung "X pesanan terpilih".
   - Tabel ringkas pesanan dikonfirmasi:
     - Kolom: Checkbox, Nomor Pesanan, Pelanggan, Tanggal Konfirmasi, Umur Pesanan (Hari), Total Item Barang.
     - *(Sama sekali tidak menampilkan kolom total rupiah/harga)*.
   - Tombol Aksi: `"Buat Daftar Ambil Barang"` (dinonaktifkan jika belum ada pesanan yang dipilih).
3. **Langkah 2: Tampilan Hasil Picking List (Interaktif & Cetak)**
   - **Tabel 1: Daftar Agregat Barang (Physical Pick List)**
     - Kolom: Checkbox Fisik `[ ]`, Kode Barang, Nama Barang, Satuan, Total Diambil, Stok Tersedia, Status Ketersediaan (`Cukup` hijau / `Kurang` merah).
     - Membantu petugas gudang mengumpulkan seluruh barang dari rak sekaligus dalam satu putaran.
   - **Tabel 2: Rincian per Pesanan (Packing / Dispatch Breakdown)**
     - Menampilkan accordion atau kartu per pesanan: Nomor SO, Nama Toko Pelanggan, Tanggal Konfirmasi, dan daftar itemnya.
     - Tautan langsung ke `/pesanan/[id]` untuk pengiriman resmi via `rpc_kirim_pesanan`.
   - **Tombol Aksi:**
     - Tombol `"Cetak Picking List"` (`window.print()`).
     - Tombol `"Pilih Ulang Pesanan"` untuk kembali ke mode seleksi.
4. **Desain Cetak (@media print):**
   - Sembunyikan sidebar, header, filter, dan tombol-tombol aksi (`@media print { .no-print { display: none !important; } }`).
   - Kop resmi:
     ```
     CV SINAR ABADI NIAGA
     DAFTAR AMBIL BARANG (PICKING LIST)
     Waktu Cetak : 23 Oktober 2026, 03:15:00 WIB
     Petugas     : [Nama Lengkap] ([Peran])
     Pesanan     : 3 Dokumen (SO-2026-000001, SO-2026-000002, SO-2026-000003)
     ```
   - Tabel cetak padat border hitam tipis, font hitam kontras tinggi, kolom ceklis fisik siap dicentang pena.

---

## 6. Pembaruan Matriks Akses (RBAC) & Rute

| Rute / Sumber Daya | Penjualan | Gudang | Manajer | Lapisan Penegak |
|---|---|---|---|---|
| Widget Dasbor: Draf & Menunggu Kirim Saya | Ya (milik sendiri) | Tidak | Tidak | RPC `rpc_get_tugas_harian` + RLS |
| Widget Dasbor: Antrean Siap Kirim Gudang | Tidak | Ya | Ya | RPC `rpc_get_tugas_harian` |
| Widget Dasbor: Persetujuan Harga Menunggu | Ya (milik sendiri) | Tidak | Ya (seluruhnya) | RPC `rpc_get_tugas_harian` |
| Widget Dasbor: PO & Opname Menunggu | Tidak | Ya (PO diterima, Opname draf) | Ya (PO diajukan, Opname diajukan) | RPC `rpc_get_tugas_harian` |
| Rute `/gudang/picking` (UI) | **Ditolak (403)** | **Diizinkan** | **Diizinkan** | `src/lib/akses.ts` & middleware |
| RPC `rpc_ambil_daftar_picking` | **Ditolak (E0001/E0065)** | **Diizinkan** | **Diizinkan** | Database Postgres (Security Check) |

---

## 7. Katalog Kode Error Baru

Melanjutkan penomoran kode bebas berikutnya di [`src/lib/errors.ts`](../src/lib/errors.ts):

| Kode | Pesan Resmi Bahasa Indonesia | Fungsi Database yang Melempar | Keterangan |
|---|---|---|---|
| **E0063** | Pilih minimal satu pesanan untuk membuat daftar ambil barang | `rpc_ambil_daftar_picking` | Parameter array pesanan kosong atau NULL. |
| **E0064** | Terdapat pesanan yang tidak valid atau bukan berstatus dikonfirmasi | `rpc_ambil_daftar_picking` | Pesanan berstatus selain dikonfirmasi atau ID tidak ditemukan. |
| **E0065** | Hanya Staf Gudang dan Manajer yang berwenang mengakses daftar ambil barang | `rpc_ambil_daftar_picking`, `actions.ts` | Staf Penjualan atau anonim mencoba mengakses fungsi picking. |

---

## 8. Rencana Pengujian Test Cases (TC-111 s.d. TC-125)

Melanjutkan penomoran pengujian resmi dari [`docs/03-test-plan.md`](03-test-plan.md):

| ID | Fokus Uji | Aktor | Media | Kriteria Evaluasi & Ekspektasi |
|---|---|---|---|---|
| **TC-111** | Akurasi Agregat Dasbor Penjualan | P1 | SQL + Vitest | Nilai widget `draf_saya`, `menunggu_kirim_saya`, `persetujuan_harga_menunggu_saya`, `tagihan_tempo_hari_ini_saya`, dan `tagihan_overdue_saya` tepat sesuai baris data aktual. |
| **TC-112** | Isolasi Kepemilikan Data Penjualan di Dasbor | P1, P2 | SQL | P1 tidak menghitung draf, pesanan, atau tagihan milik P2; nilai isolasi 100% akurat. |
| **TC-113** | Akurasi Agregat Dasbor Gudang & Umur Tertua | G | SQL + Vitest | Menghitung pesanan siap kirim, PO disetujui, stok menipis, opname draf, dan umur pesanan tertua dalam satuan hari bisnis Asia/Jakarta. |
| **TC-114** | Akurasi Agregat Dasbor Manajer | M | SQL + Vitest | Menghitung persetujuan harga menunggu, PO diajukan, opname diajukan, tagihan overdue/hari ini, dan stok menipis secara terpadu. |
| **TC-115** | Performa & Atomisitas Single-Call Dasbor | All | SQL Direct Call | Pemanggilan `rpc_get_tugas_harian()` selesai dalam 1 round-trip (< 50ms) dan menolak pengguna anonim. |
| **TC-116** | Pemblokiran Penjualan pada Fitur Picking List | P1 | SQL + Route Guard | P1 dialihkan ke `/tidak-berwenang` saat buka `/gudang/picking`, dan eksekusi `rpc_ambil_daftar_picking` ditolak dengan error `E0065`/`E0001`. |
| **TC-117** | Pembuatan Picking List untuk 1 Pesanan Valid | G, M | SQL + UI | Mengembalikan daftar barang dan rincian pesanan dengan struktur JSONB lengkap dan status sukses. |
| **TC-118** | Agregasi Multi-Pesanan (Penggabungan Barang Sama) | G, M | SQL + Vitest | Jika Pesanan A memesan 5 unit BRG-001 dan Pesanan B memesan 10 unit BRG-001, total diambil menjadi 15 unit BRG-001; diurutkan `kode_barang ASC`. |
| **TC-119** | Deteksi Indikator Kecukupan Stok Fisik | G, M | SQL + Vitest | Flag `stok_cukup = false` jika `total_diambil > stok_saat_ini`, dan `true` jika mencukupi. |
| **TC-120** | Penolakan Parameter Daftar Pesanan Kosong | G, M | SQL | Pemanggilan `rpc_ambil_daftar_picking` dengan array kosong atau NULL ditolak dengan pesan error `E0063`. |
| **TC-121** | Penolakan Pesanan Bukan Berstatus Dikonfirmasi | G, M | SQL | Jika array memuat pesanan draf, dikirim, lunas, atau batal, seluruh panggilan ditolak dengan pesan error `E0064`. |
| **TC-122** | Penolakan Pesanan dengan ID Palsu / Tak Dikenal | G, M | SQL | Array berisi UUID yang tidak ada di database ditolak dengan pesan error `E0064`. |
| **TC-123** | Zero-Leakage Data Finansial Rahasia | G | Network + DOM | Respons JSON, DOM, dan payload picking list 100% bebas dari harga satuan, diskon, HPP, margin, dan total rupiah. |
| **TC-124** | Kelengkapan Tata Letak Cetak Resmi (@media print) | G, M | UI Inspection | Tampilan cetak memuat kop resmi perusahaan, tanggal & jam cetak Asia/Jakarta, nama pencetak, dan kotak centang ceklis fisik. |
| **TC-125** | Penanganan State Kosong & Netralitas Angka Nol | All | UI Inspection | Saat tidak ada antrean tugas (angka = 0), widget tampil netral (abu-abu/slate) tanpa warna alarm. Halaman picking list menampilkan EmptyState jika tidak ada pesanan dikonfirmasi. |

---

## 9. Manajemen Risiko & Pertanyaan Terbuka

### A. Analisis Risiko & Mitigasi Teknis
1. **Risiko N+1 Query pada Dasbor Utama:**
   - *Mitigasi:* Seluruh kalkulasi dirangkum dalam satu RPC otoritatif `rpc_get_tugas_harian()`. Next.js hanya mengeksekusi 1 kueri database untuk seluruh kartu tugas harian.
2. **Risiko Kebocoran Harga pada Dokumen Picking List:**
   - *Mitigasi:* RPC `rpc_ambil_daftar_picking` secara tegas tidak meng-query kolom `harga_satuan`, `diskon_persen`, `subtotal`, `hpp_satuan`, maupun `total`. Hanya kolom `kode`, `nama`, `satuan`, dan `jumlah` yang diikutsertakan.
3. **Risiko Pesanan Berubah Status Saat Gudang Sedang Menyiapkan:**
   - *Mitigasi:* Validasi status pesanan `dikonfirmasi` diverifikasi ulang saat tombol cetak/ambil diproses.

### B. Pertanyaan Terbuka & Keputusan Konservatif Terpilih

| # | Pertanyaan Terbuka | Pilihan Opsi Desain | Keputusan Konservatif Terpilih & Rationale |
|---|---|---|---|
| **Q1** | Apakah Staf Penjualan boleh melihat ringkasan barang yang diambil untuk pesanannya sendiri di picking list? | A: Ya, boleh difilter.<br>B: Dilarang keras, khusus Gudang & Manajer. | **Dipilih Opsi B (Khusus Gudang & Manajer).** Picking list adalah dokumen internal gudang untuk pergerakan fisik barang di rak; Penjualan hanya memantau status pesanan (T4). |
| **Q2** | Bagaimana jika stok barang fisik di gudang kurang dari total yang harus diambil pada picking list? | A: Blokir pembuatan picking list.<br>B: Tetap tampilkan dengan penanda visual `stok_cukup = false`. | **Dipilih Opsi B (Tampilkan dengan Penanda `stok_cukup = false`).** Petugas gudang memerlukan informasi ini untuk memprioritaskan pesanan mana yang diambil lebih dulu atau mengajukan restock. |
| **Q3** | Apakah pesanan yang sudah dicetak picking list-nya perlu diberi flag penanda (misal `sedang_diambil`)? | A: Tambah kolom flag di `pesanan_jual`.<br>B: Tanpa ubah skema tabel (murni baca). | **Dipilih Opsi B (Tanpa Ubah Skema Tabel, Murni Baca).** Sesuai batasan T1 bahwa fitur ini murni baca tanpa menambah kolom atau tabel baru. |
| **Q4** | Apakah tautan widget stok menipis membuka `/barang` dengan filter atau halaman terpisah? | A: Halaman terpisah.<br>B: Halaman `/barang` dengan parameter filter `?menipis=true`. | **Dipilih Opsi B (Filter di `/barang`).** Menjaga konsistensi arsitektur rute yang sudah ada dan memudahkan staf gudang/manajer langsung menindaklanjuti. |

---

## 10. Hasil Implementasi & Catatan Rilis

Fitur Pusat Tugas Harian dan Daftar Ambil Barang (*Picking List*) telah berhasil diimplementasikan penuh sesuai spesifikasi yang disetujui.

### A. Komponen & Deliverable yang Telah Selesai:
1. **Database & RPC Postgres**:
   - File migrasi: [`supabase/migrations/20261023033000_pusat_tugas_picking.sql`](../supabase/migrations/20261023033000_pusat_tugas_picking.sql)
   - Fungsi `public.rpc_get_tugas_harian()`: Mengagregasi seluruh counter tugas harian dalam satu kueri efisien (<50ms) dengan isolasi kepemilikan data dan zero-leakage nilai rahasia.
   - Fungsi `public.rpc_ambil_daftar_picking(p_pesanan_ids uuid[])`: Validasi peran (`E0065`), validasi array pesanan (`E0063`), validasi status `dikonfirmasi` (`E0064`), agregasi kuantitas barang terurut kode ASC, deteksi kecukupan stok fisik, dan perincian per pesanan.
2. **Katalog Kode Error & TypeScript Types**:
   - `src/lib/errors.ts`: Terdaftar `E0063`, `E0064`, `E0065`.
   - `src/types/database.ts`: Pendaftaran tipe RPC `rpc_get_tugas_harian` dan `rpc_ambil_daftar_picking`.
3. **Route Guard & Navigasi**:
   - `src/lib/akses.ts`: Pendaftaran rute `/gudang/picking` khusus peran `['gudang', 'manajer']`.
   - `src/components/layout/sidebar.tsx`: Pendaftaran icon `ClipboardList` pada menu "Daftar Ambil (Picking)" di bawah section *Inventory & Gudang*.
4. **Antarmuka Pengguna Next.js**:
   - Modul `src/features/pusat-tugas/`:
     * `types.ts`: Definisi tipe data tugas harian, widget, dan picking list.
     * `utils.ts`: Parser aman JSONB, pemformat waktu WIB, generator widget.
     * `actions.ts`: Server Action `ambilDaftarPickingAction`.
     * `components/tugas-hari-ini.tsx`: Grid kartu tugas harian dengan pewarnaan netral untuk angka 0 dan kontras untuk angka aktif.
     * `components/tugas-hari-ini-section.tsx`: Server component terisolasi Suspense.
     * `components/picking-workspace.tsx`: Langkah 1 (seleksi pesanan) dan Langkah 2 (tabel agregat fisik + breakdown pesanan + template cetak `@media print`).
   - Dasbor Utama `src/app/(dashboard)/page.tsx`: Widget "Tugas Hari Ini" disematkan tepat di bawah salam pengguna.
   - Halaman Picking List `src/app/(dashboard)/gudang/picking/page.tsx`: Workspace interaktif dengan proteksi peran dan zero-leakage.
   - Halaman Pesanan `src/app/(dashboard)/pesanan/page.tsx`: Pintasan langsung ke `/gudang/picking` untuk staf gudang dan manajer.
5. **Suite Uji Lengkap**:
   - `supabase/tests/09_pusat_tugas.sql`: 13 skenario uji SQL (TC-111 s.d. TC-123) 100% Lulus.
   - `src/features/pusat-tugas/__tests__/utils.test.ts`: Pengujian unit fungsi parser dan agregasi widget 100% Lulus.
