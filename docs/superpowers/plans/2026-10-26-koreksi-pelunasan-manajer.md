# Koreksi Pelunasan Khusus Manajer (PRD BR-07 / BR-12) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menegakkan aturan bisnis PRD BR-07 dan BR-12 bahwa HANYA peran Manajer yang berwenang mencatat pelunasan faktur, menolak peran lain dengan kode error baru `E0078`, mencatat audit_log aksi 'pelunasan', mencabut EXECUTE untuk non-authenticated/publik, memastikan UI hanya menampilkan tombol Catat Lunas untuk Manajer, menegaskan tidak ada fitur denda, serta menyediakan suite pengujian menyeluruh (TC-229 s.d. TC-233) dan pembaruan dokumen kepatuhan.

**Architecture:** 
1. Database Layer: Memperbarui fungsi `public.rpc_catat_pelunasan` via migrasi baru `20261026150000_koreksi_pelunasan_manajer.sql` untuk memvalidasi `fn_is_manajer()` (melempar `E0078`), hanya mengizinkan transisi `dikirim` -> `lunas`, mengisi `dilunasi_pada = clock_timestamp()`, dan mencatat `audit_log` dengan aksi `'pelunasan'`.
2. Application & UI Layer: Memperbarui `src/lib/errors.ts` untuk mendaftarkan `E0078`, menambahkan guard server action `catatPelunasanAction` khusus Manajer, dan memverifikasi antarmuka di `/penagihan`, detail pesanan, dan detail pelanggan bebas dari tombol Catat Lunas bagi Staf Penjualan (sementara tombol WhatsApp tetap tersedia untuk Penjualan).
3. Test & Verification Layer: Menambahkan suite SQL `supabase/tests/16_koreksi_pelunasan.sql` dan Vitest unit test.

**Tech Stack:** Next.js 16, TypeScript, Supabase PostgreSQL RPC & RLS, Vitest.

**Spec:** PRD BR-07, BR-12, `docs/00-spesifikasi.md`

## Global Constraints
- Kode error baru yang digunakan adalah `E0078` ("Hanya Manajer yang berwenang mencatat pelunasan").
- Aksi audit_log wajib bernilai `'pelunasan'` dengan `nilai_lama = {"status":"dikirim"}` dan `nilai_baru = {"status":"lunas","dilunasi_pada":...}`.
- Tombol pengingat WhatsApp tetap tersedia bagi Staf Penjualan.
- Fitur "estimasi denda" tidak boleh ada di sistem.

## Review Focus
1. Pemanggilan RPC langsung oleh Staf Penjualan (Rina / `penjualan1@sinarabadi.test`) wajib ditolak dengan error `E0078`.
2. Pemanggilan RPC langsung oleh Manajer (Hendra / `manajer@sinarabadi.test`) pada pesanan berstatus `dikirim` wajib sukses, mengisi `dilunasi_pada`, dan mencatat audit log.
3. Transisi tidak valid `draf -> lunas` wajib ditolak dengan `E0015`.
4. Transisi tidak valid `lunas -> dikirim` wajib ditolak dengan `E0015`.
5. Staf Penjualan di UI tidak melihat tombol Catat Lunas, namun tetap dapat menekan tombol WhatsApp.

---

### Task 1: Katalog Error & Validasi Server Action
**Files:**
- Modify: `src/lib/errors.ts:80-85`
- Modify: `src/features/pesanan/actions.ts:175-195`
- Modify: `docs/04-asumsi-dan-celah.md`
- Test: `src/lib/__tests__/errors.test.ts`

- [ ] **Step 1: Write the failing test for E0078**
Tambahkan pengujian pemetaan error `E0078` di `src/lib/__tests__/errors.test.ts`.

- [ ] **Step 2: Run test to verify it fails**
Jalankan: `npm run test src/lib/__tests__/errors.test.ts`
Hasil: FAIL (E0078 belum terdaftar di ERROR_MESSAGES).

- [ ] **Step 3: Daftarkan E0078 di `src/lib/errors.ts` dan perketat `catatPelunasanAction`**
Tambahkan `E0078: 'Hanya Manajer yang berwenang mencatat pelunasan'` ke `ERROR_MESSAGES`. Tambahkan validasi peran Manajer di `catatPelunasanAction` menggunakan `getProfil()`.

- [ ] **Step 4: Run test to verify it passes**
Jalankan: `npm run test src/lib/__tests__/errors.test.ts`
Hasil: PASS.

---

### Task 2: Migrasi Database `rpc_catat_pelunasan`
**Files:**
- Create: `supabase/migrations/20261026150000_koreksi_pelunasan_manajer.sql`

- [ ] **Step 1: Buat skrip migrasi PostgreSQL**
Buat `supabase/migrations/20261026150000_koreksi_pelunasan_manajer.sql` yang mendefinisikan ulang `public.rpc_catat_pelunasan(p_pesanan_id uuid)`:
  - Cek `fn_is_manajer()`, jika false raise `E0078`.
  - Kunci `pesanan_jual` FOR UPDATE.
  - Cek `status = 'dikirim'`, jika bukan raise `E0015`.
  - Update `status = 'lunas'`, `dilunasi_pada = clock_timestamp()`.
  - Update `tagihan_mayar` status = 'ditutup' jika ada.
  - Insert `audit_log` aksi `'pelunasan'`.
  - `REVOKE ALL ON FUNCTION public.rpc_catat_pelunasan(uuid) FROM PUBLIC, anon;`
  - `GRANT EXECUTE ON FUNCTION public.rpc_catat_pelunasan(uuid) TO authenticated;`

- [ ] **Step 2: Verifikasi sintaks SQL dan skema**

---

### Task 3: Verifikasi Antarmuka UI (/penagihan, detail pesanan, detail pelanggan)
**Files:**
- Inspect/Modify: `src/features/penagihan/components/TabelTagihan.tsx`
- Inspect/Modify: `src/features/pesanan/components/pesanan-actions.tsx`
- Inspect/Modify: `src/features/pelanggan/components/pelanggan-detail-view.tsx`
- Test: `src/features/pesanan/__tests__/pelunasan-ui.test.ts`

- [ ] **Step 1: Verifikasi tombol Catat Lunas hanya untuk Manajer**
Pastikan tombol "Catat Lunas" atau "Lunas" diproteksi kondisi `peran === 'manajer'` / `isManajer`.
Pastikan tombol WhatsApp tetap terbuka untuk Penjualan.
Pastikan tidak ada referensi atau teks "denda" di antarmuka penagihan.

- [ ] **Step 2: Jalankan pengujian unit vitest untuk modul pesanan & penagihan**
Jalankan: `npm run test`

---

### Task 4: Suite Pengujian Basis Data SQL (TC-229 s.d. TC-233)
**Files:**
- Create: `supabase/tests/16_koreksi_pelunasan.sql`

- [ ] **Step 1: Tulis suite SQL komprehensif**
Buat skenario pengujian di `supabase/tests/16_koreksi_pelunasan.sql`:
  - TC-229: Rina (`penjualan1@sinarabadi.test`) memanggil `rpc_catat_pelunasan` langsung -> ditolak `E0078`.
  - TC-230: Hendra (`manajer@sinarabadi.test`) memanggil `rpc_catat_pelunasan` pada pesanan `dikirim` -> berhasil lunas, `dilunasi_pada` terisi, `audit_log` aksi `'pelunasan'`.
  - TC-231: Hendra mencoba melunasi pesanan berstatus `draf` -> ditolak `E0015`.
  - TC-232: Hendra mencoba memindahkan pesanan `lunas` ke `dikirim` -> ditolak `E0015`.
  - TC-233: Verifikasi kepatuhan tombol & bebas denda.

---

### Task 5: Pembaruan Matriks Peran & Dokumen Kepatuhan
**Files:**
- Modify: `docs/02-matriks-akses.md`
- Modify: `docs/03-test-plan.md`
- Modify: `docs/16-peta-sistem-saat-ini.md`
- Modify: `docs/18-kepatuhan-prd.md`

- [ ] **Step 1: Perbarui dokumen kepatuhan**
  - Catat TC-229 s.d. TC-233 di `docs/03-test-plan.md`.
  - Perbarui matriks akses di `docs/02-matriks-akses.md` untuk menegaskan aksi pelunasan hanya untuk Manajer (Penjualan ❌).
  - Perbarui catatan audit aksi `'pelunasan'` di `docs/16-peta-sistem-saat-ini.md` dan `docs/18-kepatuhan-prd.md`.
  - Tegaskan klausul ketiadaan denda/bunga pada transaksi penagihan.
