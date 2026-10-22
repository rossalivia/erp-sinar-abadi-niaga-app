# Catatan Perbaikan & Perubahan Spesifikasi: Resolusi Audit & Harmonisasi Katalog Error

Dokumen ini mencatat perubahan teks pesan harapan pada pengujian serta resolusi tabrakan kode error dan pengaman stock opname sesuai Keputusan Pemilik Proyek (K1 s.d. K5) per 22 Oktober 2026.

---

## 1. Latar Belakang & Analisis Tabrakan Kode (Keputusan K2)

Pada spesifikasi awal modul kredit, sempat ditentukan pesan dengan awalan `E0006:` dan `E0007:`. Namun, dalam katalog resmi sistem di `src/lib/errors.ts`, kode tersebut telah dialokasikan untuk:
* `E0006`: *Barang tidak aktif atau tidak ditemukan* (BR-02 / TC-11).
* `E0007`: *Pelanggan atau pemasok tidak aktif* (BR-02 / TC-11).

Sedangkan untuk pelanggaran kredit dan jatuh tempo, katalog resmi telah mengalokasikan:
* `E0012`: *Batas kredit pelanggan terlampaui*
* `E0013`: *Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir*

Adanya prefix `E0006:` atau `E0007:` pada teks error RPC kredit menyebabkan regex `getErrorMessage()` di frontend salah menangkap error transaksi sebagai error master barang/pelanggan nonaktif.

---

## 2. Resolusi Kode Error Katalog Resmi (K2)

Berdasarkan Keputusan Pemilik Proyek K2:
1. **Di Lapisan Basis Data (`rpc_konfirmasi_pesanan`):**
   * Menghilangkan prefix `E0006:` dan `E0007:` dari string `RAISE EXCEPTION`.
   * Menggunakan pesan persis verbatim sesuai katalog:
     - Overdue: `RAISE EXCEPTION 'Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir' USING ERRCODE = 'E0013';`
     - Overlimit: `RAISE EXCEPTION 'Batas kredit pelanggan terlampaui' USING ERRCODE = 'E0012';`
2. **Di Lapisan Frontend (`src/lib/errors.ts`):**
   * Mempertahankan kode resmi katalog:
     - `E0012`: `'Batas kredit pelanggan terlampaui'`
     - `E0013`: `'Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir'`
   * Menghapus parsing ad-hoc yang menimpa kode baseline master data.
3. **Pembaruan Test Suite:**
   * `supabase/tests/03_rpc.sql` (TC-16 & TC-17) dan `supabase/tests/04_kredit_overdue.sql` (TC-30, TC-31, TC-32, TC-37) diselaraskan untuk memeriksa pesan katalog murni tanpa awalan usang `E0006:` / `E0007:`.

---

## 3. Resolusi Aturan Stock Opname (K3 & K4)

1. **BR-11 Keterangan Selisih Minimal 10 Karakter (K3):**
   * Setiap item opname dengan selisih (`stok_fisik <> stok_sistem`) wajib menyertakan keterangan dengan panjang $\ge 10$ karakter setelah di-trim.
   * Divalidasi di Zod (`itemOpnameInputSchema`), komponen UI (`opname-editor.tsx`), dan di RPC basis data (`rpc_buat_opname_stok`, `rpc_ubah_draf_opname`, `rpc_ajukan_opname_stok`) dengan kode error baru **`E0037`**: *Keterangan selisih stok minimal 10 karakter*.
   * Kolom `mutasi_stok.alasan` diformat konsisten: `"Stock opname <nomor>: <keterangan>"`.
2. **Pengaman Persetujuan Opname Anti-Drift (K4):**
   * Pada `rpc_setujui_opname_stok`, setelah baris barang dikunci dengan `ORDER BY id ASC FOR UPDATE`, sistem memeriksa apakah `barang.stok` saat ini masih sama dengan `stok_sistem` yang tercatat pada sesi opname.
   * Jika stok berubah (misalnya ada penjualan atau penerimaan PO di antara pembuatan sesi dan persetujuan), persetujuan DITOLAK dengan kode error baru **`E0038`**:
     * Format pesan: `E0038: Stok barang "<nama>" (<kode>) telah berubah (sistem tercatat: <stok_sistem>, stok sekarang: <stok_sekarang>). Batalkan sesi lalu hitung ulang.`
   * Pendekatan selisih (delta) dilarang digunakan agar stok fisik tidak menimpa transaksi yang sah.

---

## 4. Tabel Pelacakan Kode Error Terkait

| Kode | Arti Resmi di Katalog | Fungsi / Migrasi yang Melempar | Pemakai di `src/` | Pengujian Terkait |
|---|---|---|---|---|
| **E0006** | Barang tidak aktif atau tidak ditemukan | `rpc_simpan_item_pesanan` | `src/lib/errors.ts` | TC-11 (`03_rpc.sql`) |
| **E0007** | Pelanggan atau pemasok tidak aktif | `rpc_buat_pesanan`, `rpc_buat_pembelian` | `src/lib/errors.ts` | TC-11 (`03_rpc.sql`) |
| **E0012** | Batas kredit pelanggan terlampaui | `rpc_konfirmasi_pesanan` | `src/lib/errors.ts`, `src/features/pesanan/` | TC-16 (`03_rpc.sql`), TC-30 & TC-37 (`04_kredit_overdue.sql`) |
| **E0013** | Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir | `rpc_konfirmasi_pesanan` | `src/lib/errors.ts`, `src/features/pesanan/` | TC-17 (`03_rpc.sql`), TC-31 & TC-32 (`04_kredit_overdue.sql`) |
| **E0037** | Keterangan selisih stok minimal 10 karakter | `rpc_buat_opname_stok`, `rpc_ubah_draf_opname`, `rpc_ajukan_opname_stok` | `src/lib/errors.ts`, `src/features/stock-opname/` | TC-49 (`05_stock_opname.sql`, `schemas.test.ts`) |
| **E0038** | Stok barang berubah di tengah sesi opname | `rpc_setujui_opname_stok` | `src/lib/errors.ts`, `src/features/stock-opname/` | TC-51 (`05_stock_opname.sql`) |
