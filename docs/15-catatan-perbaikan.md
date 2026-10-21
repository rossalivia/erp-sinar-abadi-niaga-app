# Catatan Perbaikan & Perubahan Spesifikasi: Modul Limit Kredit Dinamis & Blokir Otomatis

Dokumen ini mencatat perubahan teks pesan harapan pada pengujian baseline BR-05 serta resolusi tabrakan kode error sesuai keputusan D1–D9 pada spesifikasi fitur yang disetujui ([`docs/fitur-kredit-overdue.md`](fitur-kredit-overdue.md)).

---

## 1. Latar Belakang Perubahan

Pada implementasi baseline awal tahap rilis:
- Aturan BR-05 memunculkan pesan error kustom:
  - Pelanggan lewat batas kredit: `'Batas kredit pelanggan terlampaui'` (SQLSTATE `E0012`).
  - Pelanggan memiliki tagihan lewat tempo: `'Pelanggan memiliki tagihan lewat jatuh tempo'` (SQLSTATE `E0013`).
- Pada saat yang sama, kode `E0006` dan `E0007` pada baseline dialokasikan untuk:
  - `E0006`: *Barang tidak aktif atau tidak ditemukan* (BR-02 / TC-11).
  - `E0007`: *Pelanggan atau pemasok tidak aktif* (BR-02 / TC-11).

Dalam spesifikasi baru **Modul Limit Kredit Dinamis & Blokir Otomatis (Credit & Overdue Control)** yang disetujui, ditentukan pesan error verbatim:
- **D6 (Overlimit):** `E0006: Batas kredit pelanggan terlampaui`
- **D6 (Overdue):** `E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir`

---

## 2. Resolusi Teknis Tabrakan Kode (D6)

Agar kode baseline master barang dan pelanggan (`E0006` dan `E0007`) tidak rusak, diambil keputusan arsitektural berikut:
1. **Di Lapisan Database (`rpc_konfirmasi_pesanan`):**
   - String pesan error di-raise dengan prefix teks persis verbatim sesuai D6, sementara SQLSTATE PostgreSQL tetap mempertahankan `E0012` dan `E0013`:
     ```sql
     -- Skenario Overdue (D4 diperiksa terlebih dahulu)
     IF v_kredit.punya_overdue THEN
       RAISE EXCEPTION 'E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir'
         USING ERRCODE = 'E0013';
     END IF;

     -- Skenario Plafon Kredit (D4 diperiksa berikutnya)
     IF (v_kredit.piutang_berjalan + v_pesanan.total) > v_kredit.batas_kredit THEN
       RAISE EXCEPTION 'E0006: Batas kredit pelanggan terlampaui'
         USING ERRCODE = 'E0012';
     END IF;
     ```
2. **Di Lapisan UI / Frontend (`src/lib/errors.ts`):**
   - Fungsi `getErrorMessage()` mendeteksi substring eksplisit:
     - `pgError.message.includes('E0006: Batas kredit pelanggan terlampaui')` -> mengembalikan `'E0006: Batas kredit pelanggan terlampaui'`.
     - `pgError.message.includes('E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir')` -> mengembalikan `'E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir'`.
   - Jika error berasal dari master barang/pelanggan yang hanya membawa kode `E0006` atau `E0007` tanpa pesan verbatim tersebut, pemetaan kamus baseline tetap menghasilkan:
     - `E0006`: *Barang tidak aktif atau tidak ditemukan*
     - `E0007`: *Pelanggan atau pemasok tidak aktif*

---

## 3. Perubahan pada Test Suite Baseline BR-05 (`supabase/tests/03_rpc.sql`)

Hanya teks pesan harapan pada dua test case yang diperbarui agar selaras dengan D6:
1. **TC-16 (Batas Kredit Terlampaui):**
   - *Sebelumnya:* `v_msg LIKE '%Batas kredit pelanggan terlampaui%'`
   - *Sesudahnya:* `v_msg LIKE '%E0006: Batas kredit pelanggan terlampaui%'`
2. **TC-17 (Tagihan Lewat Jatuh Tempo):**
   - *Sebelumnya:* `v_msg LIKE '%Pelanggan memiliki tagihan lewat jatuh tempo%'`
   - *Sesudahnya:* `v_msg LIKE '%E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir%'`
3. **TC-18 (Batas Kredit Otomatis 0 untuk Staf Penjualan):**
   - Tidak ada perubahan, tetap memverifikasi pembatasan kredit default 0 saat dibuat oleh Staf Penjualan.

Sisa seluruh 25 Test Case baseline (TC-01 s.d. TC-15 dan TC-19 s.d. TC-28) tidak mengalami perubahan apa pun dan tetap lulus 100%.
