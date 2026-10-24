# Fitur: Pembatalan Pembelian (PO) Sesuai PRD BR-09 dan Bab 6.2

**Status:** Hasil Audit & Spesifikasi Implementasi  
**Penulis:** Full-Stack Engineer  
**Tanggal:** 2026-10-24  
**Rujukan PRD:** PRD Bab 6.2, BR-09, BR-10, BR-12, Bab 7 (Pembelian)  
**Kode Error Baru:** `E0074`, `E0075`, `E0076`, `E0077`  

---

## 1. Langkah A: Hasil Audit Kondisi Sistem Saat Ini

Audit empiris dijalankan secara langsung terhadap basis data `erp_sinar_abadi` dan kode sumber aplikasi:

### 1.1 Status Pembelian pada Constraint Basis Data
* **Kueri:**
  ```sql
  SELECT conname, pg_get_constraintdef(oid)
  FROM pg_constraint
  WHERE conrelid = 'public.pembelian'::regclass;
  ```
* **Hasil:**
  `pembelian_status_check | CHECK ((status = ANY (ARRAY['diajukan'::text, 'disetujui'::text, 'ditolak'::text, 'diterima'::text])))`
* **Temuan:**
  Nilai status `'dibatalkan'` **belum ada** pada CHECK constraint tabel `pembelian`.

### 1.2 Ketersediaan Kolom Pembatalan pada Tabel `pembelian`
* **Kueri:**
  ```sql
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'pembelian';
  ```
* **Temuan:**
  Kolom `dibatalkan_oleh` (`uuid REFERENCES profiles(id)`), `dibatalkan_pada` (`timestamptz`), dan `alasan_batal` (`text`) **belum ada**.

### 1.3 Ketersediaan Fungsi / RPC Pembatalan Pembelian
* **Kueri:**
  ```sql
  SELECT proname FROM pg_proc WHERE proname LIKE '%batalkan%pembelian%';
  ```
* **Hasil:** 0 baris.
* **Temuan:**
  Fungsi `rpc_batalkan_pembelian` **belum diimplementasikan**.

### 1.4 Status pada Antarmuka (UI) & Tipe Data TypeScript
* Pada `src/features/pembelian/types.ts`:
  `export type StatusPembelian = 'diajukan' | 'disetujui' | 'ditolak' | 'diterima';` (belum ada `'dibatalkan'`).
* Pada `src/app/(dashboard)/pembelian/page.tsx`:
  Dropdown filter status hanya memiliki 4 pilihan: `diajukan`, `disetujui`, `ditolak`, `diterima`.
* Pada `src/features/pembelian/components/pembelian-actions.tsx`:
  Hanya tombol `Setujui`, `Tolak`, dan `Terima Barang` yang tersedia. Tombol `Batalkan` belum ada.
* Pada `src/components/shared/badge-status.tsx`:
  Badge status untuk `dibatalkan` **sudah tersedia** dengan varian `'neutral'` (abu-abu) dan label `'Dibatalkan'`.

### 1.5 Audit Tempat Perhitungan PO Aktif
Seluruh modul yang menghitung atau memfilter pesanan pembelian diperiksa:
1. **Dasbor & Pusat Tugas (`rpc_get_tugas_harian`):**
   * Staf Gudang: menghitung `po_menunggu_penerimaan` dengan `WHERE status = 'disetujui'`.
   * Manajer: menghitung `po_menunggu_persetujuan` dengan `WHERE status = 'diajukan'`.
   * **Analisis:** Kueri secara eksplisit memfilter status `'disetujui'` dan `'diajukan'`, sehingga status `'dibatalkan'` secara otomatis tereksklusi dan tidak menggelembungkan antrean tugas.
2. **Rekomendasi Restock & Stok Menipis:**
   * Ditentukan via `public.v_barang` (`stok <= stok_minimum`). Pembelian tidak langsung mengubah stok hingga penerimaan fisik berlangsung.
3. **Notifikasi Email Stok:**
   * Hanya memantau data master stok menipis (`v_barang`).
4. **Daftar Pembelian (`/pembelian`):**
   * Menggunakan view `v_pembelian` dan `v_pembelian_manajer`. Kedua view perlu diperbarui agar turut menyertakan kolom pembatalan (`dibatalkan_oleh`, `dibatalkan_pada`, `alasan_batal`).

---

## 2. Aturan Bisnis & Spesifikasi PRD (Harfiah)

Sesuai Bab 6.2 dan BR-09/BR-10 PRD ERP:

| Status Awal | Status Tujuan | Siapa yang Berwenang | Syarat & Ketentuan |
|---|---|---|---|
| `diajukan` | `dibatalkan` | **HANYA Pengaju PO** (`diajukan_oleh = auth.uid()`) | Tanpa syarat lain. Alasan pembatalan opsional. |
| `disetujui` | `dibatalkan` | **HANYA Manajer** | Syarat: Barang **BELUM diterima** (`status = 'disetujui'` dan `jumlah_diterima = 0`). Alasan opsional. |
| `ditolak` | `dibatalkan` | **Ditolak (Tidak Boleh)** | Status akhir, tidak dapat dibatalkan. |
| `diterima` | `dibatalkan` | **Ditolak (Tidak Boleh)** | Barang fisik sudah masuk gudang dan HPP sudah berubah. Tidak dapat dibatalkan. |
| `dibatalkan` | `dibatalkan` | **Ditolak (Tidak Boleh)** | Sudah berstatus dibatalkan. |
| `dibatalkan` | `diterima` | **Ditolak (Tidak Boleh)** | Penerimaan hanya sah untuk status `disetujui`. |

### Dampak Finansial & Inventaris
* Pembatalan PO **TIDAK MENGUBAH STOK** (karena barang belum diterima).
* Pembatalan PO **TIDAK MENGUBAH HARGA POKOK (HPP)** barang.
* Pencatatan log audit: aksi `batalkan_pembelian` mencatat `nilai_lama` dan `nilai_baru`.

---

## 3. Pertanyaan Terbuka & Keputusan Desain

1. **Pertanyaan Terbuka (Q1): Bisakah Manajer membatalkan PO yang masih berstatus `diajukan` jika Manajer BUKAN pengaju?**
   * **Keputusan PRD Harfiah:** Bab 6.2 secara eksplisit menuliskan kolom "Siapa yang boleh" untuk `diajukan -> dibatalkan` adalah **Pengaju**. Maka bila Manajer bukan pengaju mencoba membatalkan, sistem **menolaknya** (`E0074`).
   * **Solusi Operasional:** Sebagai gantinya, Manajer memiliki wewenang resmi untuk **menolak** pengajuan tersebut melalui alur `diajukan -> ditolak` (`rpc_tolak_pembelian`) dengan menyertakan alasan minimal 10 karakter.
2. **Kerahasiaan Harga Beli (Zero-Leakage):**
   * Pembatalan PO oleh Staf Gudang (pengaju) tidak boleh mengekspos `harga_beli_satuan`. Audit log untuk pembatalan `diajukan` hanya mencatat `status` dan `alasan_batal` tanpa kolom harga beli.

---

## 4. Rencana Implementasi (Langkah B)

1. **Migrasi Basis Data:**
   * Perbarui CHECK constraint `pembelian_status_check` menjadi `status IN ('diajukan', 'disetujui', 'ditolak', 'diterima', 'dibatalkan')`.
   * Tambahkan kolom `dibatalkan_oleh (uuid)`, `dibatalkan_pada (timestamptz)`, dan `alasan_batal (text)` pada tabel `pembelian`.
   * Perbarui view `v_pembelian` dan `v_pembelian_manajer` agar mengekspos kolom pembatalan tersebut dengan tepat.
   * Buat fungsi `rpc_batalkan_pembelian(p_pembelian_id uuid, p_alasan text DEFAULT NULL)` dengan `SECURITY DEFINER` dan `SET search_path = public, pg_temp`.
2. **Kode Error Baru di `src/lib/errors.ts`:**
   * `E0074`: 'Hanya pengaju yang berwenang membatalkan pengajuan pembelian'
   * `E0075`: 'Hanya Manajer yang berwenang membatalkan pembelian yang disetujui'
   * `E0076`: 'Pembelian dengan status ini tidak dapat dibatalkan'
   * `E0077`: 'Pembelian yang sudah diterima barangnya tidak dapat dibatalkan'
3. **Pembaruan UI & Komponen:**
   * `src/features/pembelian/types.ts`: tambahkan `'dibatalkan'` ke `StatusPembelian` serta field `dibatalkan_oleh`, `dibatalkan_pada`, `alasan_batal` ke `PembelianDetail`.
   * `src/features/pembelian/schemas.ts`: buat `batalkanPembelianSchema`.
   * `src/features/pembelian/actions.ts`: buat Server Action `batalkanPembelianAction`.
   * `src/features/pembelian/components/pembelian-actions.tsx`: tambahkan tombol `Batalkan` + dialog konfirmasi (`ConfirmDialog`/Modal dengan textarea alasan opsional).
   * `src/features/pembelian/components/pembelian-timeline.tsx`: tampilkan banner status `dibatalkan` dengan keterangan pelaku dan alasan batal.
   * `src/app/(dashboard)/pembelian/page.tsx`: tambahkan `<option value="dibatalkan">Dibatalkan</option>`.
4. **Suite Pengujian Baru (TC-214 s.d. TC-228):**
   * Diuji secara komprehensif via SQL dan integrasi.

---

## 5. Bukti Hasil Uji dan Verifikasi Regresi

Seluruh suite pengujian telah dijalankan secara empiris terhadap PostgreSQL lokal dan aplikasi Next.js:

| Kode TC | Skenario Pengujian | Hasil | Keterangan / Bukti |
|---|---|---|---|
| **TC-214** | Pengaju membatalkan PO diajukan | **PASS** | Status berubah ke `dibatalkan`, `dibatalkan_oleh` & `dibatalkan_pada` tercatat |
| **TC-215** | Bukan pengaju (Gudang 2) membatalkan diajukan | **PASS** | Ditolak dengan `E0074: Hanya pengaju yang berwenang membatalkan pengajuan pembelian` |
| **TC-216** | Manajer bukan pengaju membatalkan diajukan | **PASS** | Ditolak dengan `E0074` (harfiah PRD Bab 6.2; Manajer menolak lewat `rpc_tolak_pembelian`) |
| **TC-217** | Manajer membatalkan PO disetujui (belum diterima) | **PASS** | Status berubah ke `dibatalkan`, pelaku manajer tercatat |
| **TC-218** | Staf Gudang membatalkan PO disetujui | **PASS** | Ditolak dengan `E0075: Hanya Manajer yang berwenang membatalkan pembelian yang disetujui` |
| **TC-219** | Pembatalan PO diterima | **PASS** | Ditolak dengan `E0076: Pembelian dengan status ini tidak dapat dibatalkan` |
| **TC-220** | Pembatalan PO ditolak | **PASS** | Ditolak dengan `E0076` |
| **TC-221** | Pembatalan PO yang sudah dibatalkan | **PASS** | Ditolak dengan `E0076` |
| **TC-222** | Penerimaan barang setelah dibatalkan | **PASS** | Ditolak dengan `E0019: Pembelian tidak dalam status disetujui` |
| **TC-223** | Invarian stok & HPP setelah pembatalan | **PASS** | Stok dan HPP barang tidak bermutasi sama sekali |
| **TC-224** | Audit log pencatatan nilai sebelum & sesudah | **PASS** | Tercatat di `public.audit_log`: status lama=diajukan, baru=dibatalkan |
| **TC-225** | Zero-Leakage: perlindungan harga beli | **PASS** | Kolom `harga_beli_satuan` tidak ada di view `v_pembelian` (Staf Gudang) |
| **TC-226** | Dasbor & Pusat Tugas mengecualikan PO dibatalkan | **PASS** | `po_menunggu_penerimaan = 0`, PO dibatalkan tidak menggelembungkan tugas |
| **TC-227** | Panggilan RPC langsung oleh Staf Penjualan | **PASS** | Ditolak dengan `E0001: Akses ditolak` |
| **TC-228** | Konkurensi paralel penerimaan vs pembatalan | **PASS** | 10/10 iterasi lulus konsisten tanpa deadlock dengan tepat 1 pemenang |

### Ringkasan Hasil Regresi
1. **SQL Test Suite (`15_pembatalan_pembelian.sql`):** 14/14 PASS (TC-214 s.d. TC-227).
2. **Konkurensi Multi-Proses (`15_konkurensi_pembatalan.ps1`):** 10/10 PASS (TC-228).
3. **ESLint (`npm run lint`):** 0 error, 0 warning.
4. **TypeScript Strict (`npx tsc --noEmit`):** Lulus 100% tanpa galat.
5. **Vitest Unit & Integration (`npm run test`):** 22 test files passed, 170 tests passed.
6. **Next.js Production Build (`npm run build`):** Sukses mengompilasi 38 route.
