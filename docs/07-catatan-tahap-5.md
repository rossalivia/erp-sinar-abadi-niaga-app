# Catatan Tahap 5: Modul Data Master (Pelanggan, Barang, Pemasok, Akun & Profil)

Dokumen ini mencatat penyelesaian deliverable, implementasi modul bisnis data master, hasil pengujian unit vitest, verifikasi keamanan peran (RBAC & Column-level grants), serta bukti pencegahan kebocoran data rahasia pada Tahap 5 pengembangan ERP CV Sinar Abadi Niaga.

---

## 1. Ringkasan Deliverable Selesai

### A. Modul Pelanggan (`/pelanggan`, `/pelanggan/baru`, `/pelanggan/[id]`)
- **Akses & Matriks**: Sesuai `docs/02-matriks-akses.md`, modul dikelola oleh **Staf Penjualan** dan **Manajer**. Staf Gudang diblokir rute via Middleware dan dialihkan ke `/tidak-berwenang`.
- **Daftar Pelanggan (`/pelanggan`)**:
  - Membaca view `v_pelanggan_piutang` (agregat piutang berjalan & penanda tagihan lewat jatuh tempo).
  - Dilengkapi pencarian nama toko / kode pelanggan, filter status aktif/nonaktif, dan paginasi sisi-server (`Pagination` sinkron URL).
  - Tampilan indikator badge merah `Lewat Tempo` otomatis jika ada pesanan berstatus `dikirim` yang telah melampaui tanggal jatuh tempo.
- **Pendaftaran Pelanggan Baru (`/pelanggan/baru`)**:
  - Validasi Zod (`pelangganCreateSchema`): kode unik, nama toko, telepon, alamat, termin pilihan (0, 7, 14, 30 hari).
  - Penegakan Batas Kredit Awal:
    - Staf Penjualan: batas kredit dipaksa **Rp0** di formulir dan di RPC `rpc_buat_pelanggan` (A10, TC-18).
    - Manajer: dapat menetapkan batas kredit awal langsung.
- **Detail & Pengaturan Kredit (`/pelanggan/[id]`)**:
  - Kartu ringkasan finansial: Batas Kredit, Piutang Berjalan, Sisa Kredit (`batas_kredit - piutang_berjalan`), dan Status Jatuh Tempo.
  - Perubahan data toko dasar (`nama_toko`, `telepon`, `alamat`, `aktif`) via Server Action `ubahPelangganAction`.
  - Pembatasan Batas Kredit & Termin:
    - **Manajer**: formulir interaktif khusus untuk mengubah limit kredit (`rpc_set_batas_kredit`) dan termin bayar (`rpc_set_termin`) yang tercatat di `audit_log`.
    - **Staf Penjualan**: panel read-only dengan informasi peringatan bahwa hanya Manajer yang berwenang mengubah limit kredit atau termin bayar.

---

### B. Modul Barang & Persediaan (`/barang`, `/barang/baru`, `/barang/[id]`)
- **Akses & Matriks**:
  - **Penjualan**: Hak baca saja (katalog persediaan & harga jual resmi). Tidak memiliki izin ubah data.
  - **Gudang**: Hak ubah atribut operasional barang (`nama`, `satuan`, `stok_minimum`, `aktif`). Harga jual dan harga pokok read-only/tertutup.
  - **Manajer**: Hak penuh (tambah barang baru, ubah harga jual via `rpc_set_harga_jual`, dan ubah harga pokok via `rpc_set_harga_pokok`).
- **Pencegahan Kebocoran Data Rahasia (Zero-Leakage Guarantee)**:
  - Non-Manajer (Penjualan dan Gudang) membaca dari view publik **`v_barang`** dengan daftar kolom eksplisit (`id, kode, nama, satuan, harga_jual, stok, stok_minimum, aktif, diperbarui_pada, stok_menipis`).
  - Kolom `harga_pokok`, `hpp_satuan`, dan `harga_beli_satuan` **sama sekali tidak diminta, tidak dimuat di RSC (React Server Component payload), dan tidak dirender** pada bundle browser non-Manajer.
  - Khusus Manajer, sistem memanggil view **`v_barang_manajer`** yang memuat kolom `harga_pokok`, kalkulasi margin unit, margin persentase, dan badge peringatan `harga_pokok_belum_diisi` jika HPP belum ditetapkan.
- **Penambahan Barang Baru (`/barang/baru`)**:
  - Khusus Manajer (rute dicegat untuk non-Manajer).
  - Stok awal otomatis 0 (stok fisik hanya bertambah melalui penerimaan PO pembelian atau penyesuaian stok opname).
- **Proteksi Mutasi Stok**:
  - Kolom kuantitas stok **dinonaktifkan / read-only** pada seluruh formulir. Disediakan tombol informasi "Penyesuaian Stok (Tahap 7)" dengan penjelasan bahwa stok hanya bergerak lewat mutasi transaksi.

---

### C. Modul Pemasok (`/pemasok`, `/pemasok/baru`, `/pemasok/[id]`)
- **Akses & Matriks**:
  - Dikelola oleh **Staf Gudang** dan **Manajer**.
  - **Staf Penjualan diblokir penuh** (Akses 403 / dialihkan ke `/tidak-berwenang`).
- **Fitur CRUD**:
  - Pendaftaran pemasok baru (`kode`, `nama`, `telepon`, `alamat`).
  - Pembaruan informasi kontak dan status aktif/nonaktif distributor.
  - Pencarian sisi-server dan paginasi terpadu.

---

### D. Modul Akun & Profil (`/akun`, `/profil`)
- **Pengaturan Akun & Peran (`/akun`)**:
  - Khusus **Manajer**.
  - Menampilkan daftar staf terdaftar beserta perannya (`penjualan`, `gudang`, `manajer`) dan status akun.
  - Mengubah peran dan status aktif via modal dialog yang memanggil RPC `rpc_set_peran`.
  - Penegakan Aturan B20: Sistem menolak jika perubahan mengakibatkan tidak ada Manajer aktif yang tersisa (`Minimal harus ada satu Manajer aktif`, error `E0026`).
  - Banner panduan: Menjelaskan bahwa pendaftaran akun baru dilakukan oleh administrator melalui dashboard Supabase Auth (Invite User), lalu peran diatur pada halaman ini.
  - Tautan lama `/pengaturan/akun` otomatis di-redirect ke `/akun`.
- **Profil Pengguna (`/profil`)**:
  - Dapat diakses oleh **seluruh peran**.
  - Menampilkan ringkasan identitas pengguna, email terdaftar, peran saat ini, dan tanggal bergabung.
  - Formulir Ubah Nama Lengkap sendiri via Server Action yang memperbarui tabel `profiles(nama_lengkap)`.
  - Formulir Ganti Kata Sandi sendiri via Server Action yang memanggil `supabase.auth.updateUser({ password })`.

---

### E. Komponen Bersama Terstandarisasi
- [`ConfirmDialog`](src/components/shared/confirm-dialog.tsx): Dialog konfirmasi modal profesional berbasis Radix UI untuk aksi penting/destruktif.
- [`Pagination`](src/components/shared/pagination.tsx): Komponen paginasi sisi-server sinkron URL `searchParams`.
- Pembaruan [`DataTable`](src/components/shared/data-table.tsx), [`PageHeader`](src/components/shared/page-header.tsx), [`FormField`](src/components/shared/form-field.tsx), [`BadgeStatus`](src/components/shared/badge-status.tsx) sesuai Sistem Desain Enterprise korporat.

---

## 2. Checklist Verifikasi Manual Per Peran

| Modul / Fitur | Staf Penjualan | Staf Gudang | Manajer | Status Verifikasi |
|---|---|---|---|---|
| **Katalog Barang (`/barang`)** | Lihat stok & harga jual; **tidak ada** harga pokok/margin | Lihat stok & harga jual; ubah atribut operasional; **tidak ada** harga pokok | Lihat semua kolom + harga pokok + margin unit & %; peringatan HPP kosong | **LOLOS** |
| **Tambah Barang (`/barang/baru`)** | Ditolak (403 / dicegat Middleware) | Ditolak (403 / dicegat Middleware) | Buka formulir; stok awal dipaksa 0 | **LOLOS** |
| **Ubah Harga Jual** | Form read-only; aksi API ditolak (E0001) | Form read-only; aksi API ditolak (E0001 / E23) | Boleh ubah harga jual via `rpc_set_harga_jual` | **LOLOS** |
| **Ubah Harga Pokok** | Tidak ada field di UI & respons; ditolak di DB | Tidak ada field di UI & respons; ditolak di DB | Boleh ubah HPP manual via `rpc_set_harga_pokok` | **LOLOS** |
| **Daftar Pelanggan (`/pelanggan`)** | Kelola daftar pelanggan; lihat piutang & jatuh tempo | Ditolak (403 / dicegat Middleware) | Kelola daftar pelanggan lengkap | **LOLOS** |
| **Tambah Pelanggan Baru** | Boleh daftar; batas kredit dipaksa Rp0 | Ditolak (403) | Boleh daftar; dapat set batas kredit awal | **LOLOS** |
| **Ubah Batas Kredit / Termin** | Read-only; aksi API ditolak trigger E24 | Ditolak (403) | Boleh ubah via `rpc_set_batas_kredit` & `rpc_set_termin` | **LOLOS** |
| **Daftar Pemasok (`/pemasok`)** | Ditolak (403 / dicegat Middleware) | Boleh kelola (CRUD) | Boleh kelola (CRUD) | **LOLOS** |
| **Kelola Akun & Peran (`/akun`)** | Ditolak (403 / dicegat Middleware) | Ditolak (403 / dicegat Middleware) | Boleh ubah peran & aktif via `rpc_set_peran` | **LOLOS** |
| **Profil Saya (`/profil`)** | Ubah nama sendiri & ganti kata sandi | Ubah nama sendiri & ganti kata sandi | Ubah nama sendiri & ganti kata sandi | **LOLOS** |

---

## 3. Bukti Uji Keamanan & Integritas Data

### A. Verifikasi Jaringan: Bebas dari Kebocoran Nilai Rahasia
Pemeriksaan payload RSC dan respons HTTP `/barang` untuk peran non-Manajer:
- **Pengguna Staf Penjualan (`penjualan1@sinarabadi.test`)**:
  - URL: `/barang` & `/barang/[id]`
  - Query Database yang dijalankan: `SELECT id, kode, nama, satuan, harga_jual, stok, stok_minimum, aktif, diperbarui_pada, stok_menipis FROM v_barang`
  - Hasil audit teks payload (grep regex `harga_pokok|hpp|harga_beli`): **0 kecocokan**.
- **Pengguna Staf Gudang (`gudang@sinarabadi.test`)**:
  - URL: `/barang` & `/barang/[id]`
  - Query Database yang dijalankan: `SELECT id, kode, nama, satuan, harga_jual, stok, stok_minimum, aktif, diperbarui_pada, stok_menipis FROM v_barang`
  - Hasil audit teks payload: **0 kecocokan**.
- **Perlindungan Basis Data (PostgreSQL Column Grant)**:
  - Bila klien memanipulasi permintaan untuk melakukan `SELECT harga_pokok FROM barang`, PostgreSQL mengembalikan error: `permission denied for column "harga_pokok" of relation "barang"` (TC-03).

### B. Bukti Penolakan Mutasi Ilegal
1. **Gudang Mencoba Mengubah `harga_jual`**:
   - Jalur Form UI: Kolom `harga_jual` berstatus read-only bagi staf Gudang.
   - Jalur Panggilan Langsung RPC `rpc_set_harga_jual`:
     - Input: `p_barang_id = <uuid_brg_a>`, `p_nilai = 99999`
     - Hasil: **Ditolak** dengan pengecualian PostgreSQL `E0001: Akses ditolak`.
   - Jalur Panggilan Langsung `UPDATE barang SET harga_jual = 99999`:
     - Hasil: **Ditolak** oleh trigger guard `trg_barang_guard` dengan pesan: `"Hanya Manajer yang dapat mengubah harga"`.
2. **Staf Penjualan Mencoba Mengubah `batas_kredit`**:
   - Jalur Form UI: Kolom `batas_kredit` berstatus read-only bagi staf Penjualan.
   - Jalur Panggilan Langsung RPC `rpc_set_batas_kredit`:
     - Input: `p_pelanggan_id = <uuid_plg_1>`, `p_batas = 9999999`
     - Hasil: **Ditolak** dengan pengecualian PostgreSQL `E0001: Akses ditolak`.
   - Jalur Panggilan Langsung `UPDATE pelanggan SET batas_kredit = 9999999`:
     - Hasil: **Ditolak** oleh trigger guard `trg_pelanggan_guard` dengan pesan: `"Hanya Manajer yang dapat mengubah batas kredit atau termin bayar"` (TC-18a).
3. **Penurunan / Penonaktifan Manajer Terakhir**:
   - Input: Memanggil `rpc_set_peran` untuk menurunkan satu-satunya Manajer aktif menjadi Penjualan atau Nonaktif.
   - Hasil: **Ditolak** dengan error `E0026: Minimal harus ada satu Manajer aktif`.

---

## 4. Hasil Pengujian Unit (Vitest)
Perintah dijalankan: `npm run test`
```text
 ✓ src/lib/__tests__/errors.test.ts (4 tests) 44ms
 ✓ src/lib/__tests__/format.test.ts (6 tests) 232ms
 ✓ src/features/barang/__tests__/schemas.test.ts (7 tests) 57ms
 ✓ src/features/akun/__tests__/schemas.test.ts (6 tests) 46ms
 ✓ src/features/pelanggan/__tests__/schemas.test.ts (8 tests) 39ms
 ✓ src/features/pemasok/__tests__/schemas.test.ts (4 tests) 31ms

 Test Files  6 passed (6)
      Tests  35 passed (35)
   Start at  17:42:12
   Duration  8.07s
```

---

## 5. Hasil Pemeriksaan Lint, Typecheck, dan Build Produksi
- **TypeScript Typecheck (`npm run typecheck`)**: Exit code 0 (100% type-safe, strict mode).
- **ESLint (`npm run lint`)**: Exit code 0 (0 error, 0 warning).
- **Next.js Production Build (`npm run build`)**: Exit code 0. Seluruh 16 rute aplikasi berhasil terkompilasi dalam mode dinamis dan statis.

---

## 6. Rencana Tahap Berikutnya (Tahap 6)
- **Modul Pesanan Penjualan (`/pesanan`, `/pesanan/baru`, `/pesanan/[id]`)**:
  - Alur pembuatan draf pesanan (1 s.d. 20 baris item, validasi batas diskon 0–10% untuk Penjualan vs 0–25% untuk Manajer).
  - Validasi konfirmasi pesanan: BR-04 (approval harga di bawah HPP khusus Manajer), BR-05 (blokir jika ada tagihan lewat jatuh tempo), BR-06 (blokir jika melampaui batas kredit pelanggan).
  - Snapshot HPP pada item pesanan saat pesanan dikonfirmasi.
  - Alur pembatalan pesanan terkonfirmasi khusus Manajer dengan alasan pembatalan minimal 10 karakter dan pengembalian stok otomatis.
