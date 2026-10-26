# Rencana Pelaksanaan: Perbaikan Integrasi Mayar (PRD 11.3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Rencana ini memperbaiki modul integrasi Mayar mencakup:
1. Validasi webhook payment.received (constant-time, HTTP 401 jika salah), idempotensi transaksional, pemeriksaan ulang getInvoice, nominal integer rupiah, pelunasan internal dengan aksi audit 'pelunasan' (pelaku NULL), dan penanganan anomali 'perlu_tinjau' tanpa mengubah pesanan.
2. Mode MockMayarClient (hanya aktif jika NODE_ENV != production dan MAYAR_MOCK=true) dan fail-closed di produksi tanpa MAYAR_API_KEY (webhook 503, tombol sembunyi/indikator).
3. Pembuatan tagihan: hanya Manajer, hanya pesanan 'dikirim', satu tagihan aktif per pesanan.
4. Tampilan /audit untuk pelaku_id NULL sebagai "Sistem (Mayar)".
5. Penambahan pengujian unit, integrasi, dan SQL terhadap database lokal Supabase.

---

## File Structure & Dependencies

- **Database Migrations**:
  - `supabase/migrations/20261026210000_perbaikan_integrasi_mayar.sql`
    - Perbaikan `rpc_sistem_lunaskan_dari_mayar`: `FOR UPDATE` lock, validasi status dan integer nominal rupiah, penanganan anomali `perlu_tinjau`, audit log `pelunasan` (pelaku_id = NULL).
    - `rpc_sistem_cek_webhook_event_selesai`: pengecekan idempotensi event yang sudah selesai.
    - Cabut hak `EXECUTE` dari `PUBLIC, anon, authenticated`, `GRANT` HANYA ke `service_role`.
- **Client & Service Gateway**:
  - `src/features/pembayaran/mayar-client.ts`: Aturan `MockMayarClient` (`NODE_ENV != 'production' && MAYAR_MOCK === 'true'`), mode fail-closed tanpa API key di produksi, pembulatan integer rupiah.
  - `src/features/pembayaran/service.ts`: Webhook flow: validasi constant-time SHA-256 (401 jika salah), cek status konfigurasi di produksi (503 jika API key kosong), pengecekan idempotensi, pemanggilan getInvoice, eksekusi pelunasan transaksional, penanganan anomali.
  - `src/app/api/webhooks/mayar/[token]/route.ts`: Pengembalian status HTTP presisi (401, 413, 400, 500, 503, 200).
- **UI & Tampilan**:
  - `src/features/pembayaran/components/MayarPaymentPanel.tsx`: Kondisi tanpa API key di produksi menampilkan "Mayar belum dikonfigurasi" atau menyembunyikan tombol buat tagihan.
  - `src/app/(dashboard)/pembayaran/page.tsx`: Penampilan banner / indikasi anomali 'perlu_tinjau' dan alasan untuk Manajer.
  - `src/features/audit/components/audit-table.tsx` & `src/features/audit/components/audit-diff-dialog.tsx`: Tampilan pelaku_id NULL sebagai "Sistem (Mayar)".
  - `src/app/(dashboard)/audit/page.tsx`: Mapping audit log pelaku_id NULL ke "Sistem (Mayar)".
- **Pengujian**:
  - `src/features/pembayaran/__tests__/mayar.test.ts`: Uji unit komprehensif Vitest.
  - `supabase/tests/13_tautan_bayar_mayar.sql`: Suite uji SQL di database lokal.

---

## Task 1: Migrasi Database RPC Pelunasan & Idempotensi Mayar

**Files:**
- Create: `supabase/migrations/20261026210000_perbaikan_integrasi_mayar.sql`

- [ ] **Step 1: Buat file migrasi SQL baru**
  - Tulis fungsi `rpc_sistem_cek_webhook_event_selesai(p_kunci_unik text)` untuk mengecek status event.
  - Tulis ulang fungsi `rpc_sistem_lunaskan_dari_mayar(p_tagihan_id uuid, p_referensi_transaksi text, p_jumlah_terverifikasi numeric, p_kunci_unik text DEFAULT NULL)`:
    - Urutan penguncian baris `SELECT ... FOR UPDATE` pada `pesanan_jual` kemudian `tagihan_mayar`.
    - Pengecekan status: hanya jika `pesanan.status = 'dikirim'`, `tagihan.status IN ('dibuat', 'kedaluwarsa')`, dan `round(p_jumlah_terverifikasi) = round(v_tagihan.jumlah)` dan `round(p_jumlah_terverifikasi) = round(v_pesanan.total)`.
    - Jika anomali: status tagihan menjadi `'perlu_tinjau'`, catat audit `anomali_pembayaran_mayar`, simpan kunci event sebagai selesai/ditinjau agar tidak loop, `pesanan_jual` TIDAK diubah.
    - Jika sukses: status pesanan menjadi `'lunas'`, `dilunasi_pada = now()`, status tagihan menjadi `'dibayar'`, catat audit `pelunasan` (pelaku_id = NULL, nilai_baru mencakup keterangan 'Pelunasan via Mayar'), simpan kunci event sebagai `'diproses'`.
    - `REVOKE ALL` dari `PUBLIC, anon, authenticated`, `GRANT EXECUTE` HANYA ke `service_role`.
- [ ] **Step 2: Uji migrasi secara lokal**
  - Jalankan query atau verifikasi sintaks SQL migrasi.

---

## Task 2: Refactoring MayarClient & Perilaku Fail-Closed

**Files:**
- Modify: `src/features/pembayaran/mayar-client.ts`
- Modify: `src/features/pembayaran/types.ts`

- [ ] **Step 1: Terapkan aturan aktivasi MockMayarClient & Fail-Closed**
  - Buat helper `isMayarConfigured(): boolean`.
  - Pada `getMayarClient(customClient?)`:
    - Jika `customClient` diberikan, kembalikan `customClient`.
    - Jika `process.env.MAYAR_API_KEY` tersedia & valid, kembalikan `HttpMayarClient`.
    - Jika `process.env.NODE_ENV !== 'production' && process.env.MAYAR_MOCK === 'true'`, kembalikan `globalMockMayarClient`.
    - Jika tidak memenuhi keduanya (e.g. di produksi tanpa API key, atau dev tanpa API key dan tanpa mock): kembalikan `DisabledMayarClient` yang melempar error jelas saat dipanggil: *"Integrasi pembayaran Mayar belum dikonfigurasi (MAYAR_API_KEY tidak ditemukan)"*.
  - Pastikan nominal dibulatkan sebagai bilangan bulat rupiah (`Math.round(...)`).
- [ ] **Step 2: Verifikasi tipe TypeScript**
  - Jalankan `npx tsc --noEmit`.

---

## Task 3: Pembaruan Service Webhook & Route Handler

**Files:**
- Modify: `src/features/pembayaran/service.ts`
- Modify: `src/app/api/webhooks/mayar/[token]/route.ts`

- [ ] **Step 1: Perbarui validasi webhook di `service.ts`**
  - Validasi token constant-time menggunakan SHA-256 buffer hash: jika tidak cocok, return status 401.
  - Cek ketersediaan konfigurasi di produksi: jika `NODE_ENV === 'production'` dan `!process.env.MAYAR_API_KEY`, return status 503 *"Layanan Mayar belum dikonfigurasi di lingkungan produksi"*.
  - Idempotensi: Cek apakah event sudah selesai sebelumnya. Jika sudah selesai, return 200 Duplicate.
  - Panggilan `client.getInvoice(mayar_invoice_id)`:
    - Jika timeout / throw error jaringan: return status 500 / 504 dan JANGAN tandai event selesai agar gateway Mayar mencoba ulang.
    - Jika invoice.status bukan 'paid': return status 200 *"Invoice Not Paid on Gateway"*, status pesanan tetap tidak berubah.
  - Panggil `rpc_sistem_lunaskan_dari_mayar`: menyertakan `p_kunci_unik`.
- [ ] **Step 2: Sesuaikan route handler `[token]/route.ts`**
  - Pastikan kode status HTTP 401, 503, 500 diteruskan dengan benar ke client Mayar.

---

## Task 4: UI /pembayaran, /audit, dan Panel Pembayaran

**Files:**
- Modify: `src/features/pembayaran/components/MayarPaymentPanel.tsx`
- Modify: `src/app/(dashboard)/pembayaran/page.tsx`
- Modify: `src/features/audit/components/audit-table.tsx`
- Modify: `src/features/audit/components/audit-diff-dialog.tsx`
- Modify: `src/app/(dashboard)/audit/page.tsx`

- [ ] **Step 1: Perbarui MayarPaymentPanel**
  - Jika di lingkungan produksi tanpa `MAYAR_API_KEY`: sembunyikan tombol "Buat Tagihan Mayar" dan tampilkan badge/keterangan *"Mayar belum dikonfigurasi"*.
  - Tombol buat tagihan hanya aktif jika pesanan berstatus `'dikirim'` dan belum ada tagihan aktif.
- [ ] **Step 2: Perbarui Halaman /pembayaran**
  - Tampilkan status 'perlu_tinjau' beserta catatan anomali secara jelas di tabel riwayat.
- [ ] **Step 3: Perbarui Halaman /audit**
  - Jika `pelaku_id` NULL, pastikan kolom pelaku menampilkan teks `"Sistem (Mayar)"`.

---

## Task 5: Penambahan & Pembaruan Test Suite

**Files:**
- Modify: `src/features/pembayaran/__tests__/mayar.test.ts`
- Modify: `supabase/tests/13_tautan_bayar_mayar.sql`

- [ ] **Step 1: Tulis skenario pengujian unit & integrasi di `mayar.test.ts`**
  - Token salah -> HTTP 401.
  - Webhook palsu (getInvoice menunjukkan belum bayar / unpaid) -> status pesanan tetap tidak berubah.
  - Webhook ganda -> hanya 1 kali pelunasan/audit, kedua mengembalikan duplikat.
  - Pesanan bukan status dikirim -> ditandai anomali 'perlu_tinjau', pesanan tidak berubah.
  - getInvoice timeout -> mengembalikan 500/504, event belum selesai, retry berikutnya berhasil.
  - Nominal tidak cocok -> ditandai anomali 'perlu_tinjau', pesanan tidak berubah.
  - Pesanan sudah lunas manual -> ditandai anomali 'perlu_tinjau' (potensi pembayaran ganda).
  - Produksi tanpa MAYAR_API_KEY -> webhook membalas 503, createInvoice melempar error jelas.
  - MockMayarClient hanya aktif saat `NODE_ENV != 'production' && MAYAR_MOCK === 'true'`.
- [ ] **Step 2: Perbarui pengujian SQL di `supabase/tests/13_tautan_bayar_mayar.sql`**
  - Penjualan / Gudang memanggil RPC pembuatan tagihan ditolak (403).
  - Semua peran authenticated memanggil `rpc_sistem_lunaskan_dari_mayar` langsung ditolak (permission denied).
  - Tagihan kedua untuk pesanan yang sama saat tagihan pertama masih aktif ditolak (E0067).
- [ ] **Step 3: Jalankan seluruh test suite & regresi**
  - `npm run test` (Vitest)
  - `npm run lint`
  - `npx tsc --noEmit`
