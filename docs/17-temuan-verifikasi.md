# 17 - Temuan Verifikasi & Laporan Audit Sistem Independen

Dokumen ini disusun oleh Auditor Sistem Independen berdasarkan pengujian terarah (targeted verification), pembuktian query katalog database Postgres, serta eksekusi uji otomatis linting, typechecking, dan vitest pada repositori ERP CV Sinar Abadi Niaga per 22 Oktober 2026.

---

## Bagian I: Verifikasi Terarah (Targeted Verification)

### 1. Kerahasiaan Data Finansial (HPP, Harga Pokok, Harga Beli)

* **Pertanyaan**:
  Bagaimana perilaku akses Staf Penjualan dan Gudang saat membaca v_barang_manajer, v_opname_stok_manajer, serta seluruh tabel/view yang memuat harga_pokok, harga_beli_satuan, dan hpp_satuan (termasuk pembelian dan item_pesanan_jual)? Jelaskan mekanisme yang membuat Manajer bisa membacanya sementara role authenticated tidak punya izin SELECT pada kolom rahasia.

* **Cara Uji**:
  1. Audit definisi grants pada supabase/migrations/20261021120400_grants.sql.
  2. Audit definisi view pada supabase/migrations/20261021120300_views.sql dan 20261022000000_stock_opname.sql.
  3. Eksekusi pengujian SQL supabase/tests/02_keamanan.sql (skenario TC-03 s.d. TC-05) dengan context switching role authenticated menggunakan token Staf Penjualan (P1), Staf Gudang (G), dan Manajer (M).

* **Hasil Aktual**:
  * **Tabel Dasar**:
    * barang.harga_pokok: Kolom ini tidak di-grant ke role authenticated. Query SELECT harga_pokok FROM public.barang atau SELECT * FROM public.barang langsung digagalkan oleh parser Postgres dengan error 42501 (permission denied for table barang / column harga_pokok) untuk semua akun aplikasi.
    * pembelian.harga_beli_satuan: Tidak di-grant ke authenticated. Staf Gudang yang melakukan SELECT * FROM public.pembelian ditolak dengan error 42501.
    * item_pesanan_jual.hpp_satuan: Tidak di-grant ke authenticated. Staf Penjualan ditolak dengan error 42501.
    * Catatan Entitas: Tabel item_pembelian tidak ada dalam sistem; skema menggunakan tabel pembelian langsung. Tabel untuk item pesanan adalah item_pesanan_jual (bukan item_pesanan_penjualan).
  * **View Publik vs View Manajer**:
    * View publik (v_barang, v_pembelian, v_item_pesanan_jual) dibuat dengan security_invoker = true dan secara eksplisit mengecualikan kolom rahasia. Query berhasil untuk semua peran tanpa membocorkan data.
    * View Manajer (v_barang_manajer, v_pembelian_manajer, v_item_pesanan_jual_manajer): View ini TIDAK memakai security_invoker = true, melainkan berjalan dengan Owner Rights (Security Definer) milik superuser (postgres). Karena pemilik view memiliki hak penuh atas tabel dasar, view ini dapat membaca kolom rahasia, namun diproteksi oleh klausul WHERE public.fn_is_manajer() = true. Saat diakses oleh Penjualan atau Gudang, query menghasilkan 0 baris.
    * TEMUAN ANOMALI PADA v_opname_stok_manajer:
      Pada 20261022000000_stock_opname.sql baris 64, view v_opname_stok_manajer didefinisikan dengan WITH (security_invoker = true) dan melakukan join ke b.harga_pokok. Karena role authenticated (termasuk Manajer saat login lewat PostgREST) tidak memiliki hak SELECT pada barang.harga_pokok, pemanggilan SELECT * FROM v_opname_stok_manajer oleh Manajer via API klien akan gagal dengan error 42501 (permission denied for table barang).

* **Status**: **Berisiko / Rusak Parsial** (Proteksi kebocoran ke non-Manajer AMAN, namun v_opname_stok_manajer berisiko gagal dibaca Manajer karena salah memakai security_invoker = true).

* **Saran**:
  Ubah definisi v_opname_stok_manajer pada migrasi agar berjalan dengan Owner Rights (hapus WITH (security_invoker = true)), selaras dengan arsitektur v_barang_manajer sebagaimana diatur dalam keputusan wajib A1 (docs/04-asumsi-dan-celah.md).

---

### 2. Mekanisme Kontrol Kredit Dinamis & Status Overdue

* **Pertanyaan**:
  Bagaimana terkunci_kredit dan alasan_kunci disetel dan dicabut (trigger, RPC, atau manual)? Uji urutan: pelanggan overdue -> terkunci; Manajer catat pelunasan -> apakah flag dicabut? Manajer naikkan batas kredit -> apakah flag dicabut? Apakah rpc_konfirmasi_pesanan menghitung ulang plafon dan overdue sendiri tanpa bergantung pada flag? Apakah flag bisa diubah langsung oleh non-Manajer? Gunakan tanggal bisnis Asia/Jakarta untuk overdue?

* **Cara Uji**:
  1. Pemeriksaan katalog tabel public.pelanggan pada migrasi 20261021120100_skema_inti.sql dan 20261021140000_kredit_overdue.sql.
  2. Penelusuran logika fungsi public.fn_hitung_kredit_pelanggan(p_pelanggan_id).
  3. Pemeriksaan trg_pelanggan_guard dan rpc_konfirmasi_pesanan.

* **Hasil Aktual**:
  1. **Keberadaan Kolom terkunci_kredit dan alasan_kunci**:
     * KEDUA KOLOM INI TIDAK ADA PADA TABEL pelanggan. Sistem CV Sinar Abadi Niaga tidak menggunakan kolom flag statis di tabel pelanggan untuk memblokir kredit. Upaya memasukkan data ke kolom tersebut menghasilkan error: ERROR: 42703 column "terkunci_kredit" of relation "pelanggan" does not exist.
  2. **Mekanisme Otomatis & Dinamis Sebenarnya**:
     * Sistem menerapkan kalkulasi real-time on the fly melalui fungsi database tunggal: public.fn_hitung_kredit_pelanggan(p_pelanggan_id).
     * Status kelayakan transaksi ditentukan oleh nilai Boolean boleh_transaksi dan punya_overdue.
     * Urutan Alur Bisnis:
       * Saat Pelanggan Overdue: Begitu tanggal hari ini melewati tanggal jatuh tempo faktur berstatus dikirim (pj.jatuh_tempo < (now() AT TIME ZONE 'Asia/Jakarta')::date), fn_hitung_kredit_pelanggan seketika menghasilkan punya_overdue = true dan boleh_transaksi = false. Transaksi baru otomatis terblokir.
       * Saat Manajer Mencatat Pelunasan: Manajer memanggil rpc_catat_pelunasan(pesanan_id). Status pesanan berubah menjadi lunas. Karena pesanan tersebut bukan lagi berstatus dikirim, pesanan tersebut langsung keluar dari perhitungan tunggakan. Nilai punya_overdue seketika menjadi false dan boleh_transaksi kembali bernilai true secara otomatis tanpa menyentuh flag apa pun.
       * Saat Manajer Menaikkan Batas Kredit: Manajer memanggil rpc_set_batas_kredit(pelanggan_id, batas). Kolom pelanggan.batas_kredit diperbarui, sehingga sisa_kredit bertambah. Jika tidak ada tagihan overdue, pesanan yang sebelumnya overlimit seketika dapat diproses.
  3. **Independensi rpc_konfirmasi_pesanan**:
     * Di dalam transaksi terkunci (FOR UPDATE pada pesanan_jual, pelanggan, dan barang), rpc_konfirmasi_pesanan memanggil fn_hitung_kredit_pelanggan(v_pesanan.pelanggan_id). Sistem memvalidasi punya_overdue (D4/BR-14) terlebih dahulu, baru memvalidasi (piutang_berjalan + total) > batas_kredit (D4/BR-13). Evaluasi ini sepenuhnya independen dari flag eksternal dan bebas dari write-skew / race condition.
  4. **Proteksi Wewenang Non-Manajer**:
     * trg_pelanggan_guard memblokir Staf Penjualan yang mencoba melakukan UPDATE pada batas_kredit atau termin_hari dengan pesan E0024: Hanya Manajer yang dapat mengubah batas kredit atau termin bayar.
  5. **Zona Waktu Bisnis**:
     * Perhitungan tanggal jatuh tempo dan overdue konsisten menggunakan (now() AT TIME ZONE 'Asia/Jakarta')::date (A8, B11, D2). Faktur dengan jatuh tempo tepat hari ini belum dianggap overdue.
  6. **TEMUAN TABRAKAN KODE ERROR**:
     * Pada 20261021140000_kredit_overdue.sql baris 272 dan 278:
       * Error overdue dilempar dengan teks 'E0007: Pelanggan memiliki faktur lewat jatuh tempo...' padahal ERRCODE = 'E0013'.
       * Error overlimit dilempar dengan teks 'E0006: Batas kredit pelanggan terlampaui' padahal ERRCODE = 'E0012'.
       * Hal ini bertabrakan dengan kode master E0006 (Barang tidak aktif) dan E0007 (Pelanggan tidak aktif).

* **Status**: **Aman Logika & Integritas Data**, namun terdapat **Cacat Penomoran Kode Error (Katalog Error Collision)**.

* **Saran**:
  Dokumentasikan secara resmi bahwa sistem menggunakan pendekatan kalkulasi dinamis murni (computed state) dan hapus string awalan E0006: dan E0007: yang menyesatkan di 20261021140000_kredit_overdue.sql agar kembali bersih ke E0012 dan E0013.

---

### 3. Modul Stock Opname & Penyesuaian Fisik Gudang

* **Pertanyaan**:
  Pada rpc_setujui_opname_stok: bagaimana urutan kunci baris (ORDER BY id FOR UPDATE)? Apa yang terjadi bila stok sistem berubah antara hitung fisik dan persetujuan (misal ada pesanan dikonfirmasi di antaranya)? Apakah mutasi_stok jenis penyesuaian memuat alasan >= 10 karakter (BR-11)? Apakah audit_log tercatat? Apakah persetujuan ganda ditolak? Dan apakah hanya Manajer yang boleh menyetujui?

* **Cara Uji**:
  1. Analisis implementasi rpc_setujui_opname_stok di supabase/migrations/20261022000000_stock_opname.sql.
  2. Verifikasi test suite supabase/tests/05_stock_opname.sql (skenario TC-41 s.d. TC-48).

* **Hasil Aktual**:
  1. **Urutan Kunci Baris**:
     * Query detail membaca item terurut: SELECT * FROM public.item_opname_stok WHERE opname_stok_id = p_id ORDER BY barang_id ASC.
     * Setiap baris barang dikunci dengan: SELECT stok INTO v_stok_saat_ini FROM public.barang WHERE id = r_item.barang_id FOR UPDATE.
     * Kesimpulan: Penguncian selalu konsisten urut barang_id ASC, sehingga terbebas dari ancaman deadlock (SQLSTATE 40P01).
  2. **Perubahan Stok Sistem di Antara Hitung Fisik dan Persetujuan**:
     * Fungsi menghitung selisih dinamis saat persetujuan: v_delta := r_item.stok_fisik - v_stok_saat_ini.
     * Nilai stok di master barang dipaksa menjadi stok = r_item.stok_fisik.
     * Dampak Bisnis: Jika ada pesanan penjualan yang dikonfirmasi di antara waktu hitung fisik dan waktu persetujuan Manajer, stok yang telah terpotong oleh penjualan akan ditimpa kembali oleh angka hitungan fisik lama. Invarian kartu stok (SUM(mutasi_stok.jumlah) = barang.stok) tetap valid di database karena v_delta dihitung terhadap stok terkini, namun selisih unit yang tercatat di header opname_stok.total_selisih_unit menjadi tidak sinkron dengan total mutasi yang terbentuk.
  3. **Validasi Alasan Mutasi >= 10 Karakter (BR-11)**:
     * Pada baris 450: alasan mutasi diisi dengan COALESCE(r_item.keterangan, 'Stock Opname: penyesuaian fisik rak gudang (' || v_opname.nomor || ')').
     * Teks default memenuhi syarat (> 40 karakter).
     * CELAH: Jika pengguna mengisi r_item.keterangan dengan string pendek (misalnya 'rusak' atau 'selisih'), rpc_buat_opname_stok dan rpc_ubah_draf_opname TIDAK memvalidasi length(btrim(keterangan)) >= 10. Hal ini mengakibatkan mutasi_stok.alasan dapat memuat string di bawah 10 karakter, melanggar ketentuan ketat BR-11.
  4. **Pencatatan Audit Log**:
     * Tercatat ke audit_log dengan aksi setujui_stock_opname, mencatat status lama (diajukan), status baru (disetujui), nomor dokumen, dan total item.
  5. **Pencegahan Persetujuan Ganda**:
     * Pengecekan IF v_opname.status <> 'diajukan' di dalam row lock FOR UPDATE memastikan pemanggilan kedua langsung ditolak dengan E0034: Sesi opname hanya dapat disetujui atau ditolak pada status diajukan.
  6. **Otorisasi Manajer**:
     * Pengecekan di awal fungsi: IF v_user_id IS NULL OR public.fn_peran() <> 'manajer' THEN RAISE EXCEPTION 'E0036: Hanya Manajer yang berwenang menyetujui stock opname'.

* **Status**: **Berisiko Sedang** (Celah panjang keterangan item < 10 karakter dan potensi konflik waktu opname vs konfirmasi pesanan).

* **Saran**:
  Tambahkan validasi di rpc_buat_opname_stok dan rpc_ubah_draf_opname: jika keterangan IS NOT NULL, wajib char_length(btrim(keterangan)) >= 10. Berikan peringatan operasional agar opname fisik dan persetujuan dilakukan di luar jam sibuk transaksi penjualan.

---

### 4. Entitas Pembayaran Piutang & Konsistensi Laporan

* **Pertanyaan**:
  Apa fungsi tabel pembayaran_piutang, siapa yang menulis, apakah mendukung pembayaran parsial, bagaimana mempengaruhi definisi piutang berjalan (BR-05), status lunas, dan laporan piutang? Apakah konsisten antara rpc_catat_pelunasan, view piutang, dan laporan?

* **Cara Uji**:
  1. Pemeriksaan seluruh file migrasi SQL untuk mencari deklarasi tabel pembayaran_piutang.
  2. Penelusuran implementasi rpc_catat_pelunasan di 20261021120600_rpc.sql.
  3. Pemeriksaan v_pelanggan_piutang, v_pelanggan_kredit, dan rpc_laporan_piutang.

* **Hasil Aktual**:
  1. **Keberadaan Tabel pembayaran_piutang**:
     * TABEL pembayaran_piutang TIDAK PERNAH DIBUAT DALAM SISTEM.
     * Sesuai keputusan resmi B25 di docs/04-asumsi-dan-celah.md: Pelunasan sebagian berada di luar lingkup sistem (PRD §14). Pelunasan transaksi dicatat langsung pada entitas faktur pesanan jual (public.pesanan_jual).
  2. **Siapa yang Menulis & Hak Akses**:
     * Hanya Manajer yang dapat mengeksekusi pelunasan melalui RPC rpc_catat_pelunasan(p_pesanan_id) (alias rpc_lunasi_pesanan).
  3. **Pembayaran Parsial**:
     * TIDAK DIDUKUNG. Pelunasan bersifat lunas penuh (100%) per faktur pesanan jual.
  4. **Pengaruh ke Definisi Piutang Berjalan (BR-05)**:
     * Invarian piutang berjalan di seluruh sistem didefinisikan secara identik: Piutang Berjalan = total pesanan berstatus ('dikonfirmasi', 'dikirim').
     * Saat rpc_catat_pelunasan dieksekusi, kolom pesanan_jual.status diperbarui menjadi 'lunas' dan dilunasi_pada = now().
     * Pesanan tersebut seketika keluar dari kalkulasi piutang_berjalan dan daftar overdue. Plafon kredit pelanggan langsung terpulihkan sebesar nilai total pesanan.
  5. **Konsistensi Seluruh Komponen**:
     * Rumus agregasi pada fn_hitung_kredit_pelanggan, view v_pelanggan_piutang, view v_pelanggan_kredit, rpc_laporan_piutang, dan rpc_laporan_aging_piutang terbukti 100% konsisten menggunakan filter status IN ('dikonfirmasi', 'dikirim'). Tidak ada inkonsistensi matematis.

* **Status**: **Aman & Konsisten Penuh**.

* **Saran**:
  Pertahankan arsitektur saat ini. Jika pemilik bisnis di masa depan menginginkan pelunasan bertahap/cicilan (parsial), barulah tabel pembayaran_piutang diimplementasikan dengan skema alokasi per faktur.

---

### 5. Modul Pembelian (Purchase Order)

* **Pertanyaan**:
  Apakah PO multi-barang? Apakah penerimaan tetap sekali per PO (BR-10), harga_pokok diperbarui dengan benar, dan apakah pembelian.harga_beli_satuan tertutup untuk non-Manajer?

* **Cara Uji**:
  1. Pemeriksaan skema tabel public.pembelian pada 20261021120100_skema_inti.sql.
  2. Audit rpc_terima_pembelian pada 20261021120600_rpc.sql.
  3. Audit column grants pada 20261021120400_grants.sql.

* **Hasil Aktual**:
  1. **Struktur PO**:
     * PO adalah single-item per dokumen, BUKAN multi-barang.
     * Sesuai spesifikasi awal 00-spesifikasi.md poin III.5, tabel pembelian menyimpan relasi langsung ke barang_id dan jumlah_dipesan. Tidak ada tabel item_pembelian.
  2. **Penerimaan Sekali per PO (BR-10)**:
     * YA, TEPAT SEKALI. Fungsi rpc_terima_pembelian memeriksa status awal pembelian.status = 'disetujui'. Saat diterima, status berubah menjadi 'diterima' dan diterima_pada = now(). Panggilan kedua seketika ditolak dengan E0019: Pembelian tidak dalam status disetujui.
  3. **Pembaruan harga_pokok**:
     * YA, DIPERBARUI DENGAN BENAR. rpc_terima_pembelian memperbarui master barang dengan flag sesi app.terima_pembelian = '1' agar lolos dari trigger guard trg_barang_guard.
  4. **Kerahasiaan harga_beli_satuan**:
     * TERTUTUP SEMPURNA. Kolom harga_beli_satuan tidak diberikan hak SELECT ke authenticated. Staf Gudang hanya membaca data PO via v_pembelian yang mengecualikan kolom harga beli tersebut.

* **Status**: **Aman Sesuai Spesifikasi**.

* **Saran**:
  Bila di masa depan pengadaan barang memerlukan 1 PO memuat banyak item barang sekaligus, diperlukan restrukturisasi menjadi header-detail (pembelian dan item_pembelian). Untuk kebutuhan saat ini, implementasi telah memenuhi BR-09 dan BR-10.

---

### 6. Hasil Eksekusi Regresi Penuh (Full Regression Test Suite)

| Jenis Pengujian | Target / Perintah | Jumlah Total | Lulus (Pass) | Gagal (Fail) | Status | Bukti / Catatan Eksekusi |
|---|---|---|---|---|---|---|
| Linter | npm run lint (ESLint 9) | Seluruh codebase src/ | Semua Bersih | 0 | LULUS | 0 error, 0 warning. |
| Typecheck | npm run typecheck (tsc --noEmit) | TypeScript Strict Mode | Semua Bersih | 0 | LULUS | 0 type error. |
| Unit & Integration | npm run test (Vitest 5.0.5) | 13 test files | 76 tests | 0 | LULUS | 76 passed (duration: 8.57s). |
| Database Suite SQL | supabase/tests/*.sql (4 files) | 4 suite (TC-01..48) | 48 TC | 0 | LULUS | 02_keamanan.sql, 03_rpc.sql, 04_kredit_overdue.sql, 05_stock_opname.sql. |
| Konkurensi | 03_konkurensi.ps1 | 3 skenario balapan | 3 skenario | 0 | LULUS | Skenario 1 (stok race), Skenario 2 (kredit race), Skenario 3 (deadlock free). |
| Playwright E2E | tests/e2e/*.spec.ts | 4 test specs | Siap uji | 0 | SIAP | Memerlukan instance browser running terhadap localhost:3000. |

---

## Bagian II: Daftar Temuan Audit Berperingkat Risiko

### 1. Peringkat: TINGGI (High)
* **Temuan H-01: Potensi Kegagalan Akses Manajer pada v_opname_stok_manajer**
  * Lokasi: supabase/migrations/20261022000000_stock_opname.sql (baris 63-65).
  * Deskripsi: View manajer v_opname_stok_manajer dibuat dengan opsi WITH (security_invoker = true). Di dalamnya terdapat kalkulasi b.harga_pokok. Karena role authenticated (termasuk Manajer yang login via PostgREST) tidak memegang hak SELECT langsung pada barang.harga_pokok, pemanggilan view ini akan menghasilkan error permission denied for table barang.
  * Rekomendasi: Hapus klausa WITH (security_invoker = true) agar view berjalan dengan owner rights (definer) seperti v_barang_manajer.

### 2. Peringkat: SEDANG (Medium)
* **Temuan M-01: Tabrakan Penomoran Kode Error di kredit_overdue.sql**
  * Lokasi: supabase/migrations/20261021140000_kredit_overdue.sql (baris 272, 278).
  * Deskripsi: Pesan error melempar teks awalan 'E0007: Pelanggan memiliki faktur lewat jatuh tempo...' (padahal E0007 master adalah pelanggan/pemasok tidak aktif) dan 'E0006: Batas kredit pelanggan terlampaui' (padahal E0006 master adalah barang tidak aktif).
  * Rekomendasi: Selaraskan teks pesan di RPC agar menggunakan E0013: dan E0012:.
* **Temuan M-02: Celah Validasi Panjang Alasan pada Item Stock Opname (BR-11)**
  * Lokasi: supabase/migrations/20261022000000_stock_opname.sql (rpc_buat_opname_stok & rpc_setujui_opname_stok).
  * Deskripsi: Jika pengguna menginput keterangan item opname dengan teks pendek (misal: "rusak"), teks tersebut langsung diteruskan ke mutasi_stok.alasan tanpa validasi minimal 10 karakter.
  * Rekomendasi: Tambahkan validasi IF char_length(btrim(keterangan)) < 10 THEN RAISE EXCEPTION 'E0016: Alasan minimal 10 karakter'.
* **Temuan M-03: Ketiadaan Otomasi E2E Playwright untuk Modul Stock Opname**
  * Lokasi: Direktori tests/e2e/.
  * Deskripsi: Modul Stock Opname (/stok/opname) baru teruji di level SQL dan Zod schemas, belum memiliki skenario Playwright E2E browser.
  * Rekomendasi: Buat file tests/e2e/05-stock-opname.spec.ts.

### 3. Peringkat: RENDAH (Low)
* **Temuan L-01: Overloading Kode Error E0024 dan E0028**
  * Lokasi: supabase/migrations/20261021120600_rpc.sql.
  * Deskripsi: Kode E0024 dipakai untuk 3 konteks berbeda (batas kredit >= 0, wewenang termin, dan validasi nilai termin 0/7/14/30). Kode E0028 dipakai untuk harga jual > 0 sekaligus harga pokok >= 0.
  * Rekomendasi: Buat kode unik tersendiri untuk mempermudah identifikasi diagnostik sistem.

---

## Bagian III: 5 Hal yang Paling Perlu Diputuskan Pemilik Proyek

1. **Perbaikan Definisi Security Invoker pada v_opname_stok_manajer**:
   Menyetujui penghapusan klausa security_invoker = true pada view manajer stock opname agar Manajer dapat melihat ringkasan nominal finansial selisih persediaan di dashboard.
2. **Standardisasi Kode Error Katalog E0012 & E0013**:
   Menyetujui normalisasi kode error batas kredit dan overdue di RPC rpc_konfirmasi_pesanan agar tidak tumpang tindih dengan kode E0006 dan E0007.
3. **Penetapan Kebijakan Bisnis: Pelunasan Parsial vs Lunas Penuh**:
   Memastikan apakah model pembayaran saat ini (hanya lunas penuh 100% per pesanan) sudah cukup untuk operasional CV Sinar Abadi Niaga, atau perlu mengalokasikan sprint mendatang untuk membuat tabel pembayaran_piutang guna mendukung cicilan/pembayaran bertahap.
4. **Kebijakan Sinkronisasi Waktu Eksekusi Stock Opname**:
   Menetapkan SOP operasional gudang bahwa stock opname fisik hanya dilakukan saat tidak ada konfirmasi pesanan berjalan, guna menghindari penimpaan stok riil akibat jeda waktu antara hitung rak fisik dan klik persetujuan Manajer.
5. **Kebutuhan Purchase Order Multi-Barang**:
   Mengonfirmasi apakah proses pengadaan dari pemasok cukup 1 PO untuk 1 jenis barang (kondisi saat ini sesuai spesifikasi awal), atau memerlukan relasi header-detail multi-item untuk efisiensi pengiriman faktur pemasok.
