# Catatan Pengerjaan Tahap 6 — Modul Pesanan Jual

**Tanggal**: 21 Oktober 2026  
**Status**: Selesai (Lulus Semua Uji & Verifikasi)  
**Rujukan**: [AGENTS.md](../AGENTS.md), [docs/00-spesifikasi.md](00-spesifikasi.md) (BR-02 s.d. BR-08), [docs/02-matriks-akses.md](02-matriks-akses.md), [docs/03-test-plan.md](03-test-plan.md).

---

## 1. Ringkasan Pekerjaan (Deliverables)

Tahap 6 mengimplementasikan modul **Pesanan Jual** dari alur pembuatan draf hingga pelunasan dan pembatalan, dengan seluruh logika bisnis dan perubahan status dieksekusi oleh fungsi RPC PostgreSQL (SECURITY DEFINER) tanpa penulisan ulang logika di Next.js:

1. **Utilitas Perhitungan Matematika (`src/features/pesanan/utils.ts`)**:
   - Fungsi `hitungSubtotal(jumlah, hargaSatuan, diskonPersen)` meniru formula PostgreSQL: `round((jumlah * harga_satuan * (100 - diskon) / 100.0), 0)` dengan metode pembulatan *half-away-from-zero*.
   - Unit test vitest komprehensif di `src/features/pesanan/__tests__/utils.test.ts` (8 skenario lulus 100%).
2. **Skema Validasi Zod (`src/features/pesanan/schemas.ts`)**:
   - `pesananDrafSchema`: Validasi 1 s.d. 20 baris barang, keunikan barang per baris, jumlah $\ge$ 1, diskon 0–10% (Penjualan) / 0–25% (Manajer).
   - `batalTerkonfirmasiSchema`: Validasi alasan pembatalan $\ge$ 10 karakter bersih (trim).
3. **Server Actions (`src/features/pesanan/actions.ts`)**:
   - `simpanDrafPesananAction`: Memanggil `rpc_simpan_draf_pesanan(p_pelanggan_id, p_items, p_pesanan_id)`.
   - `konfirmasiPesananAction`: Memanggil `rpc_konfirmasi_pesanan(p_pesanan_id)`.
   - `batalkanDrafAction`: Memanggil `rpc_batalkan_draf(p_pesanan_id)`.
   - `kirimPesananAction`: Memanggil `rpc_kirim_pesanan(p_pesanan_id)`.
   - `catatPelunasanAction`: Memanggil `rpc_catat_pelunasan(p_pesanan_id)`.
   - `batalkanPesananTerkonfirmasiAction`: Memanggil `rpc_batalkan_pesanan_terkonfirmasi(p_pesanan_id, p_alasan)`.
4. **Halaman & Komponen Frontend**:
   - `src/app/(dashboard)/pesanan/page.tsx`: Daftar pesanan dengan filter status, pelanggan, rentang tanggal, pencarian nomor, pagination, dan pintasan Gudang ("Siap Kirim"). Sesuai RLS (Penjualan = miliknya, Gudang = non-draf, Manajer = semua).
   - `src/app/(dashboard)/pesanan/baru/page.tsx`: Formulir draf baru dengan live calculation subtotal dan total.
   - `src/app/(dashboard)/pesanan/[id]/ubah/page.tsx`: Formulir ubah draf (hanya aktif bila status = `draf`).
   - `src/app/(dashboard)/pesanan/[id]/page.tsx`: Detail pesanan, timeline status dengan timestamp, tabel baris (non-Manajer via `v_item_pesanan_jual`, Manajer via `v_item_pesanan_jual_manajer` dengan kolom HPP satuan & margin), dan tombol aksi adaptif per peran.
   - `src/app/(dashboard)/pesanan/[id]/cetak/page.tsx`: Dokumen siap cetak (@media print) — Faktur Penjualan untuk Penjualan/Manajer (tanpa HPP) dan Surat Jalan untuk Gudang (tanpa harga/subtotal).

---

## 2. Bukti Uji Skenario Wajib & Test Plan

### (a) Skenario Wajib 1: Penjualan Memberi Diskon 11% $\rightarrow$ Ditolak (TC-13)
- **Aktor**: `penjualan1@sinarabadi.test`
- **Tindakan**: Mencoba menyimpan draf pesanan dengan barang `BRG-A` dan diskon 11%.
- **Hasil UI**: Input diskon dibatasi maksimal 10% dan menampilkan pesan peringatan di klien.
- **Hasil Server / Database**: Jika dipanggil via Server Action / RPC, ditolak dengan kode `E0009` dan pesan error:
  ```
  Diskon harus 0% sampai 10%
  ```
- **Status**: **LULUS**

### (b) Skenario Wajib 2: Harga di Bawah HPP $\rightarrow$ Pesan Persis, Manajer Berhasil Konfirmasi (TC-14 & TC-15)
- **Aktor 1**: `penjualan1@sinarabadi.test`
- **Kondisi**: Pesanan untuk `PLG-1`, barang `BRG-B` (harga jual Rp15.000, HPP Rp14.000), diskon 10% $\rightarrow$ subtotal Rp13.500 ($< \text{HPP}$ Rp14.000).
- **Tindakan Staf Penjualan**: Mengklik tombol "Konfirmasi Pesanan".
- **Hasil Pesan Error**:
  ```
  Harga di bawah batas, minta persetujuan Manajer
  ```
  *(Pesan persis tanpa mencantumkan nominal HPP Rp14.000 maupun selisih rugi demi kerahasiaan data internal)*.
- **Aktor 2**: `manajer@sinarabadi.test`
- **Tindakan Manajer**: Membuka pesanan yang sama dan mengklik "Konfirmasi Pesanan".
- **Hasil Manajer**: Berhasil dikonfirmasi, status pesanan menjadi `dikonfirmasi`, stok berkurang, kartu stok mencatat mutasi jenis `keluar`, dan kolom `hpp_satuan` berhasil di-snapshot ke Rp14.000.
- **Status**: **LULUS**

### (c) Skenario Wajib 3: Batas Kredit Rp0 $\rightarrow$ Ditolak, Dinaikkan Manajer $\rightarrow$ Berhasil (TC-16 & TC-18)
- **Aktor**: `penjualan1@sinarabadi.test`
- **Kondisi**: Pelanggan baru dibuat oleh Staf Penjualan (otomatis batas kredit awal Rp0 per trigger guard database).
- **Tindakan Staf Penjualan**: Membuat draf pesanan senilai Rp50.000 dan mengonfirmasi.
- **Hasil Staf Penjualan**: Ditolak dengan pesan:
  ```
  Batas kredit pelanggan terlampaui
  ```
- **Tindakan Manajer**: Masuk ke menu Pelanggan, menaikkan batas kredit menjadi Rp1.000.000 (tercatat di `audit_log` aksi `ubah_batas_kredit`).
- **Tindakan Staf Penjualan Berikutnya**: Mengonfirmasi ulang draf pesanan.
- **Hasil**: Sukses dikonfirmasi, piutang berjalan pelanggan bertambah.
- **Status**: **LULUS**

### (d) Skenario Wajib 4: Pembatalan Terkonfirmasi Mengembalikan Stok & Tercatat di Kartu Stok (TC-23)
- **Aktor**: `manajer@sinarabadi.test` (Staf Penjualan dan Gudang tidak memiliki tombol/akses ini).
- **Kondisi**: Pesanan status `dikonfirmasi` dengan 5 unit `BRG-A` (stok awal 100 $\rightarrow$ sisa 95).
- **Tindakan**: Manajer membuka dialog "Batalkan Pesanan", memasukkan alasan `"Pelanggan membatalkan pesanan karena penyesuaian anggaran proyek internal"` ($\ge 10$ karakter), lalu konfirmasi.
- **Hasil**:
  1. Status pesanan berubah menjadi `dibatalkan` dengan timestamp `dibatalkan_pada` dan `alasan_batal` tersimpan.
  2. Stok master `BRG-A` otomatis bertambah kembali dari 95 menjadi 100.
  3. Baris baru di tabel `mutasi_stok` dicatat dengan jenis `batal`, jumlah bertanda $+5$, stok sesudah $100$.
  4. Tercatat di `audit_log` aksi `batalkan_pesanan`.
- **Status**: **LULUS**

---

## 3. Verifikasi Bebas Kebocoran Kolom Rahasia

Dilakukan audit mendalam terhadap seluruh alur data untuk peran non-Manajer (`penjualan` dan `gudang`):
1. **Column-Level Grants**: Hak `SELECT` kolom `hpp_satuan` pada tabel `item_pesanan_jual` dicabut dari peran `authenticated`.
2. **View Publik `v_item_pesanan_jual`**: Hanya menyertakan kolom `id, pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal`. Kolom `hpp_satuan` dan `margin` tidak ada di view ini.
3. **Payload Jaringan / RSC**:
   - Komponen detail pesanan membaca view `v_item_pesanan_jual` jika peran bukan Manajer.
   - Hasil pemeriksaan payload JSON/RSC: atribut `hpp_satuan` dan `margin` bernilai `undefined`/tidak dikirim sama sekali ke klien.
4. **Halaman Cetak**:
   - Surat Jalan Gudang (`/pesanan/[id]/cetak`): Menyembunyikan seluruh kolom harga, diskon, subtotal, dan total.
   - Faktur Penjualan: Menampilkan harga jual dan subtotal, tanpa kolom HPP/margin.

---

## 4. Hasil Verifikasi Kode & Build

- **Vitest Unit Test**:
  ```
  Test Files  7 passed (7)
       Tests  43 passed (43)
  ```
  *(Mencakup pengujian utilitas hitungSubtotal dengan pembulatan 3 x 1.999 diskon 7,5%, batas diskon 0/10/25%, dan angka jumlah besar)*.
- **TypeScript Typecheck (`npm run typecheck`)**:
  ```
  exit code: 0 (clean, no error)
  ```
- **ESLint (`npm run lint`)**:
  ```
  exit code: 0 (clean, 0 error, 0 warning)
  ```
- **Next.js Production Build (`npm run build`)**:
  ```
  ✓ Compiled successfully
  ✓ Generating static pages (17/17)
  exit code: 0
  ```

---

## 5. Kesimpulan & Status Akhir

Seluruh kriteria penerimaan **Tahap 6: Modul Pesanan Jual** telah terpenuhi sepenuhnya:
- Alur `draf` $\rightarrow$ `dikonfirmasi` $\rightarrow$ `dikirim` $\rightarrow$ `lunas` dan alur pembatalan draf serta pesanan terkonfirmasi berjalan end-to-end.
- Desain UI mengikuti secara disiplin aturan enterprise korporat di `AGENTS.md` (tabel padat, angka rata kanan tabular, badge warna redup, dialog konfirmasi terproteksi).
- Tidak ada kebocoran data rahasia HPP ke pengguna non-Manajer.
