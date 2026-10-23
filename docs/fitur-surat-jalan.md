# Spesifikasi Teknis: Cetak Surat Jalan (PRD 11.2)

Dokumen ini adalah spesifikasi arsitektur dan implementasi teknis untuk fitur **Cetak Surat Jalan** pada pesanan berstatus dikirim untuk CV Sinar Abadi Niaga.

Rujukan Utama:
- [`docs/00-spesifikasi.md`](00-spesifikasi.md) (BR-01 s.d. BR-17)
- [`docs/02-matriks-akses.md`](02-matriks-akses.md)
- [`docs/03-test-plan.md`](03-test-plan.md) (TC-01 s.d. TC-145)
- [`docs/05-skema.md`](05-skema.md) & [`docs/16-peta-sistem-saat-ini.md`](16-peta-sistem-saat-ini.md)
- [`AGENTS.md`](../AGENTS.md) (Aturan Fitur Baru & Aturan UI Enterprise)

---

## 1. Audit Kondisi Sistem Saat Ini (Fact & Gap Audit)

Berdasarkan inspeksi langsung terhadap berkas implementasi dan skema basis data:

| No | Kebutuhan Fitur | Status di Sistem | Lokasi Otoritatif | Kesenjangan / Tindakan Diperlukan |
|---|---|---|---|---|
| 1 | **Halaman Cetak Surat Jalan Khusus (`/pesanan/[id]/surat-jalan`)** | **BELUM ADA** | - | Perlu dibuat halaman terpisah yang aman dari data finansial dan khusus untuk pesanan berstatus `dikirim`. |
| 2 | **Halaman Cetak Faktur Penjualan** | Sudah ada | `src/app/(dashboard)/pesanan/[id]/cetak/page.tsx` | Halaman cetak faktur memuat harga satuan, diskon, subtotal, total, termin, dan jatuh tempo. Jangan ditimpa atau dirusak. |
| 3 | **Tombol Cetak Surat Jalan pada `/pesanan/[id]`** | Ada sebagian / tercampur | `src/features/pesanan/components/pesanan-actions.tsx` | Sebelumnya tombol `Cetak Dokumen` di `pesanan-actions.tsx` mencetak faktur atau memberi label "Surat Jalan" pada halaman `/cetak` yang masih membawa data uang. Harus dipisahkan: tombol **"Cetak Surat Jalan"** HANYA muncul pada status `dikirim`. |
| 4 | **View Data Non-Uang untuk Surat Jalan** | **BELUM ADA** | - | Perlu view baru `v_surat_jalan` dan `v_surat_jalan_item` yang secara struktural HANYA memiliki kolom non-uang untuk menjamin *zero-leakage* di tingkat basis data. |
| 5 | **Validasi Status Pesanan (Wajib `dikirim`)** | **BELUM ADA** | - | Halaman `/pesanan/[id]/surat-jalan` harus memvalidasi status pesanan. Jika bukan `dikirim` (misal draf, dikonfirmasi, lunas, dibatalkan), tampilkan pesan netral tanpa membocorkan rincian isi pesanan. |
| 6 | **Tata Letak Cetak A4 & 3 Kotak Tanda Tangan** | Parsial di `/cetak` | `src/features/pesanan/components/print-button.tsx` | Komponen tombol cetak sudah ada (`PrintButton`). Perlu tata letak cetak surat jalan standar logistik dengan 3 tanda tangan: Pengirim/Gudang, Pengemudi/Sopir, dan Penerima Toko, serta ringkasan kuantitas dan waktu cetak Asia/Jakarta. |

---

## 2. Aturan Bisnis & Keputusan Desain (S1 s.d. S6)

Sesuai arahan teknis yang telah ditetapkan:

1. **S1 (Status Wajib Dikirim & Rute Terpisah):**
   - Surat jalan **hanya tersedia untuk pesanan berstatus `dikirim`**.
   - Tombol **"Cetak Surat Jalan"** muncul di halaman detail `/pesanan/[id]` **hanya pada status `dikirim`**.
   - Rute surat jalan berada di `/pesanan/[id]/surat-jalan`. Jika pesanan berstatus selain `dikirim` (draf, dikonfirmasi, lunas, dibatalkan), halaman menampilkan pesan netral:
     > *"Surat jalan hanya tersedia untuk pesanan berstatus dikirim."*
     tanpa membocorkan nama barang, pelanggan, maupun isi pesanan.
   - Halaman cetak faktur yang sudah ada di `/pesanan/[id]/cetak` tidak ditimpa; komponen tombol cetak (`PrintButton`) digunakan kembali (*reused*).
2. **S2 (Kelengkapan Isi Dokumen & Zero-Leakage Finansial):**
   - **Kop Perusahaan:** CV Sinar Abadi Niaga, Distributor & Perdagangan Umum, Jl. Industri Niaga No. 88, Kawasan Pergudangan, Surabaya.
   - **Judul Dokumen:** SURAT JALAN.
   - **Header Dokumen:** Nomor pesanan, Tanggal kirim (format tanggal Indonesia zona waktu `Asia/Jakarta`).
   - **Data Pelanggan:** Nama toko, kode pelanggan, alamat lengkap, nomor telepon tujuan.
   - **Tabel Barang:** Nomor urut, kode barang, nama barang, satuan, kuantitas/jumlah fisik.
   - **Ringkasan:** Total jenis barang (N jenis) dan Total kuantitas barang (N pcs/karton).
   - **Catatan Pengiriman:** Catatan pesanan jika ada.
   - **3 Kolom Tanda Tangan:**
     1. Bagian Gudang / Pengirim
     2. Pengemudi / Sopir Ekspedisi
     3. Penerima / Cap Toko
   - **Footer Dokumen:** Tanggal dan jam cetak (WIB / `Asia/Jakarta`) dan Nama pencetak.
   - **LARANGAN KERAS (ZERO-LEAKAGE):** Sama sekali **tidak memuat** harga satuan, diskon, subtotal, total, termin pembayaran, batas kredit, tanggal jatuh tempo, HPP, margin, atau kata/angka uang di seluruh dokumen.
3. **S3 (Hak Akses & Otorisasi):**
   - Diizinkan untuk peran: **Gudang**, **Manajer**, dan **Penjualan pemilik pesanan** (`dibuat_oleh = auth.uid()`).
   - Penjualan non-pemilik dan peran tanpa hak ditolak tegas (403 / redirect atau notFound / pesan tidak berwenang).
4. **S4 (Kerahasiaan Harga di Tingkat Data / View):**
   - Sumber data menggunakan view khusus: `public.v_surat_jalan` dan `public.v_surat_jalan_item`.
   - View ini **hanya mengekspos kolom non-uang**. Tidak ada kolom `harga_satuan`, `diskon_persen`, `subtotal`, `total`, `hpp_satuan`, atau `jatuh_tempo` pada definisi view.
   - Filter keamanan data: `WHERE pj.status = 'dikirim' AND (fn_is_manajer() OR fn_peran() = 'gudang' OR (fn_peran() = 'penjualan' AND pj.dibuat_oleh = auth.uid()))`.
   - Mengaktifkan `security_invoker = true` pada PostgreSQL 15+.
5. **S5 (Styling Cetak Enterprise @media print):**
   - Format kertas A4 (margin 15 mm).
   - Menghilangkan navigasi, sidebar, header aplikasi, dan tombol aksi saat proses cetak (`print:hidden`).
   - Baris tabel tidak boleh terpotong di tengah halaman (`break-inside: avoid` / `page-break-inside: avoid`).
   - Header tabel berulang pada halaman lanjutan (`thead { display: table-header-group; }`).
   - Mendukung pesanan sampai dengan 20 baris dengan rapi.
   - Tombol "Cetak Sekarang" memanggil `window.print()`.
6. **S6 (Integritas Sistem Transaksi):**
   - Murni operasi baca data (read-only).
   - Tidak mengubah status pesanan, tidak membuat tabel baru, dan tidak mencatat audit tambahan.

---

## 3. Rancangan Skema Basis Data (Database Views)

### A. View Header: `public.v_surat_jalan`
```sql
CREATE OR REPLACE VIEW public.v_surat_jalan
AS
SELECT
  pj.id,
  pj.nomor,
  pj.status,
  pj.dibuat_oleh,
  pj.dibuat_pada,
  pj.dikirim_pada,
  pj.catatan,
  -- Data Pelanggan (HANYA kolom non-uang)
  p.id AS pelanggan_id,
  p.kode AS pelanggan_kode,
  p.nama_toko AS pelanggan_nama,
  p.telepon AS pelanggan_telepon,
  p.alamat AS pelanggan_alamat,
  -- Data Pembuat / Sales (HANYA nama)
  pr.nama_lengkap AS pembuat_nama
FROM public.pesanan_jual pj
JOIN public.pelanggan p ON p.id = pj.pelanggan_id
LEFT JOIN public.profiles pr ON pr.id = pj.dibuat_oleh
WHERE pj.status = 'dikirim'
  AND (
    public.fn_is_manajer()
    OR public.fn_peran() = 'gudang'
    OR (public.fn_peran() = 'penjualan' AND pj.dibuat_oleh = auth.uid())
  );
```

### B. View Detail Barang: `public.v_surat_jalan_item`
```sql
CREATE OR REPLACE VIEW public.v_surat_jalan_item
AS
SELECT
  ip.id,
  ip.pesanan_jual_id,
  ip.barang_id,
  b.kode AS kode_barang,
  b.nama AS nama_barang,
  b.satuan,
  ip.jumlah
FROM public.item_pesanan_jual ip
JOIN public.barang b ON b.id = ip.barang_id
JOIN public.pesanan_jual pj ON pj.id = ip.pesanan_jual_id
WHERE pj.status = 'dikirim'
  AND (
    public.fn_is_manajer()
    OR public.fn_peran() = 'gudang'
    OR (public.fn_peran() = 'penjualan' AND pj.dibuat_oleh = auth.uid())
  );
```

---

## 4. Matriks Akses & Keamanan Rute

| Aktor | Status Pesanan | Izin Akses Rute `/pesanan/[id]/surat-jalan` | Visibilitas Tombol di `/pesanan/[id]` | Perilaku Respons |
|---|---|:---:|:---:|---|
| **Gudang** | `dikirim` | ✅ **Diizinkan** | ✅ Muncul | Membuka & mencetak dokumen surat jalan resmi |
| **Manajer** | `dikirim` | ✅ **Diizinkan** | ✅ Muncul | Membuka & mencetak dokumen surat jalan resmi |
| **Penjualan (Pemilik)** | `dikirim` | ✅ **Diizinkan** | ✅ Muncul | Membuka & mencetak dokumen surat jalan pesanan miliknya |
| **Penjualan (Bukan Pemilik)** | `dikirim` | ❌ **Ditolak** | ❌ Sembunyi | Akses diblokir (403 / dialihkan / 0 baris) |
| **Semua Peran** | `draf` | ❌ **Ditolak** | ❌ Sembunyi | Menampilkan pesan netral: *"Surat jalan hanya tersedia untuk pesanan berstatus dikirim"* |
| **Semua Peran** | `dikonfirmasi` | ❌ **Ditolak** | ❌ Sembunyi | Menampilkan pesan netral tanpa bocoran isi data |
| **Semua Peran** | `lunas` | ❌ **Ditolak** | ❌ Sembunyi | Menampilkan pesan netral tanpa bocoran isi data |
| **Semua Peran** | `dibatalkan` | ❌ **Ditolak** | ❌ Sembunyi | Menampilkan pesan netral tanpa bocoran isi data |
| **Anonim** | Apapun | ❌ **Ditolak** | - | Dialihkan ke `/login` via route guard middleware |

---

## 5. Rencana Pengujian (Test Cases TC-146 s.d. TC-155)

| ID | Fokus Pengujian | Aktor | Media | Kriteria Keberhasilan |
|---|---|---|---|---|
| **TC-146** | Akses Surat Jalan Pesanan Berstatus `dikirim` oleh Gudang | Gudang | SQL / UI | Berhasil memuat data pesanan dan item barang dari view tanpa error. |
| **TC-147** | Akses Surat Jalan Pesanan Berstatus `dikirim` oleh Manajer | Manajer | SQL / UI | Berhasil memuat data pesanan dan seluruh baris barang. |
| **TC-148** | Akses Surat Jalan Pesanan Berstatus `dikirim` oleh Sales Pemilik | Penjualan | SQL / UI | Berhasil memuat data surat jalan pesanan yang dibuat oleh sales terkait. |
| **TC-149** | Penolakan Akses Sales Bukan Pemilik pada Surat Jalan | Penjualan | SQL / UI | Kueri view mengembalikan 0 baris; UI menampilkan not found / tidak berwenang. |
| **TC-150** | Penolakan Akses Surat Jalan untuk Pesanan Status `draf` | Gudang, Manajer, Sales | UI / SQL | Menampilkan pesan netral: *"Surat jalan hanya tersedia untuk pesanan berstatus dikirim"*; view mengembalikan 0 baris. |
| **TC-151** | Penolakan Akses Surat Jalan untuk Pesanan Status `dikonfirmasi` | Gudang, Manajer, Sales | UI / SQL | Menampilkan pesan netral; view mengembalikan 0 baris. |
| **TC-152** | Penolakan Akses Surat Jalan untuk Pesanan Status `lunas` dan `dibatalkan` | Gudang, Manajer, Sales | UI / SQL | Menampilkan pesan netral; view mengembalikan 0 baris. |
| **TC-153** | Verifikasi Zero-Leakage Data Uang pada View & Respons Jaringan | Net / Catalog | SQL + Inspect | Kolom view `v_surat_jalan` dan `v_surat_jalan_item` 100% bebas dari harga, subtotal, diskon, total, jatuh_tempo, termin, hpp, margin. |
| **TC-154** | Kelengkapan Format Cetak Surat Jalan (Kop, Tgl Asia/Jakarta, Ringkasan, 3 TTD) | Gudang, Manajer | UI Inspection | Dokumen memuat kop resmi, nomor pesanan, tgl kirim WIB, tabel barang, total jenis, total unit, 3 kotak TTD, jam cetak & nama pencetak. |
| **TC-155** | Visibilitas Tombol di Halaman Detail `/pesanan/[id]` Sesuai Status | All | UI Inspection | Tombol "Cetak Surat Jalan" hanya muncul jika status pesanan adalah `dikirim`. |

---

## 6. Analisis Risiko & Mitigasi

1. **Risiko Kebocoran Angka Finansial ke Sopir/Pengemudi:**
   - *Mitigasi:* View `v_surat_jalan` dan `v_surat_jalan_item` dipisahkan secara struktural dari tabel/view berharga. Komponen Next.js tidak menerima dan tidak merender properti uang apa pun.
2. **Risiko Konflik dengan Halaman Faktur Penjualan:**
   - *Mitigasi:* Halaman `/pesanan/[id]/cetak` dibiarkan utuh dan independen sebagai Faktur Penjualan. Surat jalan dibuat di rute baru `/pesanan/[id]/surat-jalan`.
3. **Risiko Pembocoran Data Pesanan Non-Dikirim Melalui Error Message:**
   - *Mitigasi:* Jika pesanan belum dikirim, sistem mengembalikan pesan netral terstandardisasi tanpa menyebut nomor barang, nominal, atau nama toko.

---

## 7. Pertanyaan Terbuka & Keputusan Konservatif

- **Pertanyaan:** Apakah pesanan berstatus `lunas` boleh dicetak surat jalannya jika barang baru dikirim belakangan?
  - **Keputusan Konservatif (S1):** Mengikuti spesifikasi ketat S1, surat jalan **hanya untuk pesanan berstatus `dikirim`**. Pesanan yang sudah `lunas` telah melewati fase serah-terima fisik pengiriman dan menggunakan bukti Faktur / Kuitansi Pelunasan.

---

## 8. Hasil Implementasi

Implementasi fitur Cetak Surat Jalan (PRD 11.2) telah diselesaikan secara penuh dengan deliverable sebagai berikut:

1. **Migrasi Database (`supabase/migrations/20261023053000_surat_jalan.sql`)**:
   - `public.v_surat_jalan`: View header pesanan dikirim yang murni memuat data non-uang (`id`, `nomor`, `status`, `dibuat_oleh`, `dibuat_pada`, `dikirim_pada`, `catatan`, `pelanggan_id`, `pelanggan_kode`, `pelanggan_nama`, `pelanggan_telepon`, `pelanggan_alamat`, `pembuat_nama`).
   - `public.v_surat_jalan_item`: View rincian barang fisik (`id`, `pesanan_jual_id`, `barang_id`, `kode_barang`, `nama_barang`, `satuan`, `jumlah`).
   - Isolasi RLS ketat: Hanya pesanan berstatus `'dikirim'` yang dapat dibaca oleh Manajer, Gudang, atau Penjualan pemilik pesanan.
   - Peningkatan kompatibilitas `security_invoker = true` pada PostgreSQL 15+.
2. **Halaman & Antarmuka Next.js App Router**:
   - `src/app/(dashboard)/pesanan/[id]/surat-jalan/page.tsx`:
     - Tampilan cetak A4 profesional (`@media print`) dengan margin 15 mm, header tabel berulang, dan pemisah baris `break-inside: avoid`.
     - Kop resmi CV Sinar Abadi Niaga, nomor pesanan, tanggal kirim zona WIB, detail pelanggan tujuan, tabel muatan barang, ringkasan total jenis & kuantitas, 3 kolom tanda tangan (Gudang, Pengemudi, Penerima Toko), serta jam cetak & nama pencetak.
     - Penanganan status pesanan bukan `dikirim`: menampilkan pesan netral *"Surat jalan hanya tersedia untuk pesanan berstatus dikirim"* tanpa membocorkan data pesanan.
     - Proteksi RLS: Penjualan non-pemilik ditolak dengan respon `notFound()`.
   - `src/features/pesanan/components/pesanan-actions.tsx`:
     - Tombol **"Cetak Surat Jalan"** HANYA muncul pada pesanan berstatus `dikirim` untuk Gudang, Manajer, dan Sales pemilik pesanan.
     - Tombol **"Cetak Faktur"** dipertahankan secara terpisah untuk Penjualan & Manajer.
3. **Pengujian & Verifikasi Kualitas**:
   - Test Suite SQL `supabase/tests/11_surat_jalan.sql`: **TC-146 s.d. TC-153 Lulus (100%)**.
   - Test Suite Vitest `src/features/pesanan/__tests__/surat-jalan.test.ts`: **9/9 tests pass (100%)**.
   - Verifikasi Zero-Leakage: Terbukti 0 kolom finansial (harga, diskon, subtotal, total, termin, jatuh tempo, HPP, margin) pada definisi view maupun payload dokumen surat jalan.

