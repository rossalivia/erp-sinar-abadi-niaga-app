# 03 — Test Plan (28 Test Case)

Rujukan: [00-spesifikasi.md](00-spesifikasi.md), [02-matriks-akses.md](02-matriks-akses.md), [04-asumsi-dan-celah.md](04-asumsi-dan-celah.md).

## 1. Ketentuan Umum
- Setiap TC dijalankan pada database hasil `supabase db reset` + **seed uji** (fixture di bawah), kecuali disebut lain.
- **Lapisan SQL**: dijalankan via `psql`/SQL editor dengan `set role authenticated` + `set request.jwt.claims` sesuai akun, atau via REST/RPC dengan JWT akun uji. **Lapisan UI**: dijalankan di browser terhadap aplikasi Next.js.
- Hasil yang diharapkan berupa pesan error ditulis **persis** (lihat katalog §3). Pesan dikembalikan oleh `RAISE EXCEPTION` di RPC/trigger.
- Tanggal "hari ini" = `(now() AT TIME ZONE 'Asia/Jakarta')::date`.

## 2. Fixture Data Uji

| Kode | Data |
|---|---|
| **P1**, **P2** | `penjualan1@sinarabadi.test`, `penjualan2@sinarabadi.test`, peran penjualan, aktif |
| **G** | `gudang@sinarabadi.test`, peran gudang, aktif |
| **M** | `manajer@sinarabadi.test`, peran manajer, aktif (satu-satunya Manajer) |
| **PX** | `nonaktif@sinarabadi.test`, peran penjualan, `aktif = false` |
| **BRG-A** | harga_jual 10.000, harga_pokok 8.000, stok 100, stok_minimum 10, aktif |
| **BRG-B** | harga_jual 15.000, harga_pokok 14.000, stok 1, stok_minimum 5, aktif |
| **BRG-C** | harga_jual 5.000, harga_pokok 4.000, stok 20, **nonaktif** |
| **BRG-D** | harga_jual 3.333, harga_pokok **NULL**, stok 50, aktif |
| **BRG-T01..T21** | 21 barang aktif, harga_jual 1.000, harga_pokok 500, stok 100 (untuk uji batas baris) |
| **PLG-1** | batas_kredit 1.000.000, termin 14, tanpa pesanan berjalan |
| **PLG-2** | batas_kredit 500.000, termin 7, piutang berjalan 450.000 (1 pesanan dikonfirmasi) |
| **PLG-3** | batas_kredit 5.000.000, termin 7, punya 1 pesanan **dikirim** dengan jatuh_tempo = kemarin |
| **PLG-4** | **nonaktif** |
| **PLG-5** | batas_kredit 5.000.000, termin 30, tanpa pesanan berjalan |
| **PMS-1** | pemasok aktif |
| Saldo awal | Setiap stok awal tercatat sebagai `mutasi_stok` jenis `penyesuaian` bernomor `SALDO-AWAL` |

## 3. Katalog Pesan Error

| Kode | Pesan persis |
|---|---|
| E01 | `Akses ditolak` |
| E02 | `Pesanan tidak ditemukan` |
| E03 | `Pesanan harus berisi 1 sampai 20 baris` |
| E04 | `Jumlah minimal 1` |
| E05 | `Barang sudah ada di pesanan ini` |
| E06 | `Barang tidak aktif` |
| E07 | `Pelanggan tidak aktif` |
| E08 | `Pesanan hanya bisa diubah saat berstatus draf` |
| E09 | `Diskon harus 0% sampai 10%` |
| E10 | `Diskon harus 0% sampai 25%` |
| E11 | `Harga di bawah batas, minta persetujuan Manajer` |
| E12 | `Batas kredit pelanggan terlampaui` |
| E13 | `Pelanggan memiliki tagihan lewat jatuh tempo` |
| E14 | `Stok tidak cukup untuk barang {kode}` |
| E15 | `Perpindahan status tidak diizinkan` |
| E16 | `Alasan minimal 10 karakter` |
| E17 | `Jumlah pembelian harus 1 sampai 10.000` |
| E18 | `Harga beli harus lebih dari 0` |
| E19 | `Pembelian tidak dalam status disetujui` |
| E20 | `Jumlah diterima harus 1 sampai jumlah dipesan` |
| E21 | `Stok hasil penyesuaian tidak boleh negatif` |
| E22 | `Stok hanya dapat diubah melalui transaksi mutasi` |
| E23 | `Hanya Manajer yang dapat mengubah harga` |
| E24 | `Hanya Manajer yang dapat mengubah batas kredit atau termin bayar` |
| E25 | `Hanya Manajer yang dapat mengubah peran atau status akun` |
| E26 | `Minimal harus ada satu Manajer aktif` |
| E27 | `Kode barang sudah digunakan` |
| E28 | `Harga jual harus lebih dari 0` |
| E29 | `Stok minimum harus bilangan bulat >= 0` |
| E30 | `Akun Anda tidak aktif. Hubungi Manajer.` (UI) |
| PG | `permission denied for table {tabel}` (Postgres native, SQLSTATE 42501) |

Urutan validasi `konfirmasi_pesanan`: (1) akses/kepemilikan → E01/E02, (2) status draf → E15, (3) jumlah baris → E03, (4) pelanggan & barang aktif → E07/E06, (5) diskon sesuai peran pengonfirmasi → E09, (6) BR-04 → E11, (7) jatuh tempo → E13, (8) batas kredit → E12, (9) stok → E14.

## 4. Daftar Test Case & Hasil Verifikasi Rilis

| ID | BR/Requirement | Peran | Lapisan Uji | Status | Tgl Eksekusi | Bukti Pengujian | Catatan Verifikasi |
|---|---|---|---|---|---|---|---|
| **TC-01** | Auth: wajib masuk, sign-up mati, noindex | Anonim | UI + SQL | **Lulus** | 2026-10-21 | `tests/e2e/01-auth-noindex.spec.ts`<br>`supabase/tests/02_keamanan.sql`<br>`src/middleware.ts` | Redirect `/` ke `/login` via middleware; header `X-Robots-Tag: noindex, nofollow` terpasang; `public/robots.txt` Disallow `/`. |
| **TC-02** | Auth: akun nonaktif | PX | UI + SQL | **Lulus** | 2026-10-21 | `tests/e2e/01-auth-noindex.spec.ts`<br>`supabase/tests/02_keamanan.sql` | Akun nonaktif ditolak masuk, menampilkan pesan E30 (`Akun Anda tidak aktif. Hubungi Manajer.`), sesi dibersihkan. |
| **TC-03** | BR-12: kolom rahasia via column grant | P1 | SQL + UI | **Lulus** | 2026-10-21 | `tests/e2e/02-keamanan-data-rahasia.spec.ts`<br>`supabase/tests/02_keamanan.sql`<br>`supabase/migrations/20261021120400_grants.sql` | `harga_pokok` pada barang & `hpp_satuan` pada item pesanan tidak di-grant ke authenticated. Query `select *` gagal; UI & network payload bersih dari nilai rahasia. |
| **TC-04** | BR-12: view manajer & laporan | P1, G, M | SQL + UI | **Lulus** | 2026-10-21 | `tests/e2e/02-keamanan-data-rahasia.spec.ts`<br>`supabase/tests/02_keamanan.sql`<br>`supabase/tests/03_rpc.sql` | View manajer (`v_barang_manajer`, dll) menghasilkan 0 baris untuk non-manajer via RLS. RPC laporan mingguan ditolak E01 untuk Penjualan/Gudang. Route `/laporan` diarahkan ke `/tidak-berwenang`. |
| **TC-05** | BR-12: data pembelian | G, P1 | SQL + UI | **Lulus** | 2026-10-21 | `tests/e2e/02-keamanan-data-rahasia.spec.ts`<br>`supabase/tests/02_keamanan.sql` | Staf Penjualan diblokir dari `/pembelian`. Staf Gudang dapat melihat daftar PO namun `harga_beli_satuan` tidak di-grant (tidak ada kolom harga beli di UI maupun payload Gudang). |
| **TC-06** | RBAC: eskalasi peran | P1, M | SQL + UI | **Lulus** | 2026-10-21 | `supabase/tests/02_keamanan.sql`<br>`supabase/tests/03_rpc.sql`<br>`src/features/akun/actions.ts` | Penjualan tidak dapat UPDATE `peran` di `profiles` (trigger mencegah dan menghasilkan E25). RPC `ubah_peran` hanya dapat dipanggil Manajer. Manajer terakhir dicegah mengubah perannya sendiri (E26). |
| **TC-07** | BR-01: kode unik, harga, stok_minimum | M | SQL + Unit | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/barang/__tests__/schemas.test.ts` | Kode barang case-insensitive unik (E27), harga jual > 0 (E28), stok minimum bilangan bulat >= 0 (E29). |
| **TC-08** | BR-01: stok hanya via mutasi | M, G | SQL | **Lulus** | 2026-10-21 | `supabase/tests/02_keamanan.sql`<br>`supabase/migrations/20261021120200_trigger_guard.sql` | Direct UPDATE ke kolom `barang.stok` diblokir (kolom tidak di-grant UPDATE, dan dijaga trigger cadangan E22). |
| **TC-09** | BR-01: hak ubah barang per peran, stok menipis | G, P1 | SQL + UI | **Lulus** | 2026-10-21 | `supabase/tests/02_keamanan.sql`<br>`src/features/barang/actions.ts` | Gudang dapat mengubah atribut non-harga (`nama`, `satuan`, `stok_minimum`, `aktif`), namun ditolak saat mengubah `harga_jual` (E23). Penjualan ditolak UPDATE barang via RLS. Status stok menipis aktif saat `stok <= stok_minimum`. |
| **TC-10** | BR-02: 1–20 baris | P1 | SQL + Unit | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pesanan/__tests__/utils.test.ts` | Pembuatan pesanan menghasilkan nomor `SO-YYYY-NNNNNN`. Konfirmasi pesanan dengan 0 baris atau > 20 baris ditolak dengan E03. |
| **TC-11** | BR-02: jumlah, duplikat, status aktif | P1, M | SQL + Unit | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pesanan/actions.ts` | Item pesanan dengan jumlah 0 ditolak (E04), barang duplikat dalam satu draf ditolak (E05), barang nonaktif ditolak (E06), pelanggan nonaktif ditolak (E07). |
| **TC-12** | BR-03: harga otomatis & pembulatan; BR-02 ubah hanya draf | P1 | SQL + Unit | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pesanan/__tests__/utils.test.ts` | Harga satuan diambil dari `barang.harga_jual` (input manual diabaikan). Subtotal dihitung dengan pembulatan rupiah `ROUND()`. Pesanan berstatus bukan draf ditolak saat diedit (E08). |
| **TC-13** | BR-03: batas diskon per peran | P1, M | SQL + Unit + UI | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`tests/e2e/03-alur-transaksi.spec.ts` | Diskon staf Penjualan dibatasi 0% s.d. 10% (E09). Diskon Manajer dibatasi 0% s.d. 25% (E10). UI menampilkan batasan input dinamis sesuai peran pengguna aktif. |
| **TC-14** | BR-04: Penjualan ditolak di bawah HPP | P1 | SQL + UI | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pesanan/actions.ts` | Jika harga efektif item pesanan < HPP barang, konfirmasi oleh Penjualan ditolak E11 (`Harga di bawah batas, minta persetujuan Manajer`). Error message tidak membocorkan angka nominal HPP. |
| **TC-15** | BR-04: Manajer boleh konfirmasi; snapshot HPP | M | SQL | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql` | Manajer dapat mengonfirmasi pesanan di bawah HPP. HPP satuan dibekukan (snapshot) pada saat konfirmasi ke tabel `item_pesanan_jual.hpp_satuan`. |
| **TC-16** | BR-05: batas kredit (+ konkurensi) | P1, P2 | SQL + Shell | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`supabase/tests/03_konkurensi.sh` | Konfirmasi pesanan yang menyebabkan total piutang melebihi `batas_kredit` ditolak E12. Pengujian konkurensi paralel (20 iterasi) berhasil mengunci pelanggan (`FOR UPDATE`) tanpa ada piutang melebihi batas kredit. |
| **TC-17** | BR-05: tagihan lewat jatuh tempo | P1 | SQL + UI | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pesanan/actions.ts` | Pelanggan yang memiliki pesanan berstatus dikirim dan telah melewati tanggal `jatuh_tempo` ditolak konfirmasi pesanan barunya dengan E13. |
| **TC-18** | BR-05: batas kredit awal Rp0, termin & kredit hanya Manajer | P1, M | SQL + Unit | **Lulus** | 2026-10-21 | `supabase/tests/02_keamanan.sql`<br>`src/features/pelanggan/__tests__/schemas.test.ts` | Pelanggan baru yang dibuat oleh Staf Penjualan otomatis memiliki `batas_kredit = 0` dan `termin_hari = 14`. Upaya non-Manajer mengubah batas kredit/termin ditolak E24. Perubahan oleh Manajer dicatat di `audit_log`. |
| **TC-19** | BR-06: race condition stok | P1, P2 | SQL + Shell | **Lulus** | 2026-10-21 | `supabase/tests/03_konkurensi.sh` (Skenario 1) | Dua transaksi konfirmasi paralel memperebutkan stok 1 unit barang: 1 transaksi berhasil mengurangi stok menjadi 0, transaksi kedua gagal bersih dengan pesan E14 (`Stok tidak cukup untuk barang {kode}`). Stok tidak pernah negatif. |
| **TC-20** | BR-06: atomik multi-baris & tanpa deadlock | P1, P2 | SQL + Shell | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`supabase/tests/03_konkurensi.sh` (Skenario 3) | Transaksi multi-baris dieksekusi atomik. Penguncian baris barang selalu diurutkan berdasarkan `barang_id ASC`, sehingga transaksi multi-baris paralel bebas dari deadlock (`SQLSTATE 40P01`). |
| **TC-21** | BR-07: kirim & lunas | G, M | SQL + UI | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pesanan/actions.ts` | Staf Gudang mengeksekusi RPC `kirim_pesanan` (mengisi `dikirim_pada` dan menghitung `jatuh_tempo`). Manajer mengeksekusi RPC `lunasi_pesanan` (mengisi `dilunasi_pada` dan mencatat `audit_log`). |
| **TC-22** | BR-07: transisi ilegal & kepemilikan | P1, P2, G, M | SQL + UI | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pesanan/actions.ts` | Transisi status yang tidak sesuai state machine ditolak E15. Staf Penjualan tidak dapat memanipulasi draf staf lain (E02 via RLS). Tombol aksi di UI hanya tampil sesuai status dan peran aktif. |
| **TC-23** | BR-08: batal pesanan dikonfirmasi | P1, M | SQL + UI | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pesanan/actions.ts` | Hanya Manajer yang dapat membatalkan pesanan dikonfirmasi. Wajib menyertakan alasan minimal 10 karakter (E16). Stok barang otomatis dipulihkan (+qty) dengan jenis mutasi `batal`, tercatat di `audit_log`. |
| **TC-24** | BR-09: ajukan PO | P1, G | SQL + Unit | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pembelian/__tests__/schemas.test.ts` | Hanya Staf Gudang yang dapat mengajukan PO pembelian. Jumlah pembelian divalidasi antara 1 s.d. 10.000 (E17). Menghasilkan nomor `PO-YYYY-NNNNNN`. |
| **TC-25** | BR-09: setujui / tolak PO | G, M | SQL + Unit | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pembelian/__tests__/schemas.test.ts` | Hanya Manajer yang dapat menyetujui atau menolak PO. Penyetujuan wajib mengisi harga beli > 0 (E18). Penolakan wajib mengisi alasan minimal 10 karakter (E16). Seluruh keputusan dicatat di `audit_log`. |
| **TC-26** | BR-10: penerimaan barang | G, M | SQL + UI | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pembelian/actions.ts` | Penerimaan barang hanya dapat dilakukan pada PO disetujui (E19). Jumlah diterima 1 s.d. jumlah dipesan (E20). Stok bertambah, mutasi `masuk` tercatat, dan `barang.harga_pokok` diperbarui ke harga beli PO terbaru. |
| **TC-27** | BR-11: penyesuaian & rekonsiliasi kartu stok | P1, G | SQL + Unit + UI | **Lulus** | 2026-10-21 | `supabase/tests/02_keamanan.sql`<br>`src/features/stok/__tests__/invarian.test.ts`<br>`tests/e2e/03-alur-transaksi.spec.ts` | Penyesuaian stok fisik oleh Staf Gudang wajib mengisi alasan minimal 10 karakter (E16). Stok hasil penyesuaian tidak boleh negatif (E21). Selisih mutasi dicatat bernomor `ADJ-YYYY-NNNNNN`. Invarian kartu stok terpenuhi: `SUM(mutasi_stok.jumlah) = barang.stok`. |
| **TC-28** | BR-12: audit log | M, P1, G | SQL + UI | **Lulus** | 2026-10-21 | `supabase/tests/02_keamanan.sql`<br>`supabase/tests/03_rpc.sql`<br>`tests/e2e/03-alur-transaksi.spec.ts` | Seluruh 7 mutasi penting (`ubah_harga_jual`, `ubah_batas_kredit`, `ubah_termin_pelanggan`, `ubah_peran`, `setujui_pembelian`, `tolak_pembelian`, `batalkan_pesanan`, `sesuaikan_stok`, `lunasi_pesanan`) mencatat baris audit log dengan nilai lama dan nilai baru. Hanya Manajer yang memiliki hak SELECT ke `audit_log`. INSERT/UPDATE/DELETE langsung ditolak. |

## 5. Rekap Distribusi

| Kategori | TC | Jumlah |
|---|---|---|
| Auth, RBAC & kerahasiaan data | TC-01 – TC-06 | 6 |
| Data master (BR-01) | TC-07 – TC-09 | 3 |
| Pesanan & harga/diskon (BR-02, BR-03) | TC-10 – TC-13 | 4 |
| Harga di bawah HPP (BR-04) | TC-14 – TC-15 | 2 |
| Kredit & jatuh tempo (BR-05) | TC-16 – TC-18 | 3 |
| Race condition (BR-06) | TC-19 – TC-20 | 2 |
| Alur status & pembatalan (BR-07, BR-08) | TC-21 – TC-23 | 3 |
| PO & penerimaan (BR-09, BR-10) | TC-24 – TC-26 | 3 |
| Kartu stok & audit log (BR-11, BR-12) | TC-27 – TC-28 | 2 |
| **Total** | | **28** |

## 6. Keterlacakan BR → TC

| BR | TC utama | TC pendukung |
|---|---|---|
| BR-01 | TC-07, TC-08, TC-09 | TC-26, TC-27 (stok berubah hanya lewat mutasi) |
| BR-02 | TC-10, TC-11 | TC-12 (ubah hanya saat draf) |
| BR-03 | TC-12, TC-13 | — |
| BR-04 | TC-14, TC-15 | — |
| BR-05 | TC-16, TC-17, TC-18 | — |
| BR-06 | TC-19, TC-20 | TC-16 (kunci pelanggan) |
| BR-07 | TC-21, TC-22 | — |
| BR-08 | TC-23 | TC-22 (dikirim/lunas tidak bisa dibatalkan) |
| BR-09 | TC-24, TC-25 | — |
| BR-10 | TC-26 | TC-15 |
| BR-11 | TC-27 | TC-15, TC-20, TC-23, TC-26 (mutasi tercatat) |
| BR-12 | TC-03, TC-04, TC-05, TC-28 | TC-06, TC-18, TC-23, TC-25 (audit) |
| BR-13 | TC-29, TC-30, TC-34, TC-36 | TC-16, TC-37, TC-39 |
| BR-14 | TC-31, TC-32, TC-33, TC-35 | TC-17, TC-37, TC-40 |

---

## 7. Test Case Tambahan: Modul Limit Kredit Dinamis & Blokir Otomatis (TC-29 s.d. TC-40)

| ID | Fokus Uji | Aktor | Media | Status | Tanggal Uji | Bukti Uji | Ringkasan Verifikasi & Hasil |
|---|---|---|---|---|---|---|---|
| **TC-29** | BR-13: Nilai pesanan = sisa kredit persis (D7) | P1 | SQL | **Lulus** | 2026-10-21 | `supabase/tests/04_kredit_overdue.sql` | Pesanan baru bernilai tepat sama dengan sisa plafon kredit pelanggan berhasil dikonfirmasi tanpa error. |
| **TC-30** | BR-13: Nilai pesanan melampaui sisa plafon kredit (D7) | P1 | SQL + Unit | **Lulus** | 2026-10-22 | `supabase/tests/04_kredit_overdue.sql`<br>`src/features/pelanggan/__tests__/kredit.test.ts` | Konfirmasi pesanan yang membuat total piutang melebihi batas kredit ditolak bersih dengan pesan `Batas kredit pelanggan terlampaui` (E0012). |
| **TC-31** | BR-14: Ada faktur overdue sisa kredit cukup (D4) | P1 | SQL + Unit | **Lulus** | 2026-10-22 | `supabase/tests/04_kredit_overdue.sql`<br>`src/features/pelanggan/__tests__/kredit.test.ts` | Meskipun sisa limit kredit masih tersedia, konfirmasi pesanan ditolak dengan pesan `Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir` (E0013). |
| **TC-32** | BR-14: Prioritas D4 (Overdue & Overlimit sekaligus) | P1 | SQL | **Lulus** | 2026-10-22 | `supabase/tests/04_kredit_overdue.sql` | Saat kedua kondisi pelanggaran terpenuhi sekaligus, sistem konsisten mengevaluasi dan memunculkan error overdue `E0013` terlebih dahulu. |
| **TC-33** | BR-14: Batas tanggal jatuh tempo hari ini (D2) | P1 | SQL | **Lulus** | 2026-10-22 | `supabase/tests/04_kredit_overdue.sql` | Pesanan berstatus `dikirim` dengan `jatuh_tempo = (now() AT TIME ZONE 'Asia/Jakarta')::date` belum dianggap lewat jatuh tempo; pesanan baru dapat dikonfirmasi. |
| **TC-34** | BR-13: Dikonfirmasi belum dikirim masuk piutang (D1) | P1 | SQL | **Lulus** | 2026-10-21 | `supabase/tests/04_kredit_overdue.sql` | Pesanan berstatus `dikonfirmasi` mengurangi sisa plafon kredit namun tidak memicu blokir overdue. |
| **TC-35** | BR-14: Pelunasan faktur overdue membuka blokir (Alur B2) | M, P1 | SQL | **Lulus** | 2026-10-21 | `supabase/tests/04_kredit_overdue.sql` | Manajer melunasi faktur menunggak via `rpc_catat_pelunasan`, status pelanggan kembali `boleh_transaksi = true` dan pesanan berikutnya sukses. |
| **TC-36** | BR-13: Penaikan limit kredit membuka blokir overlimit (Alur B1) | M, P1 | SQL | **Lulus** | 2026-10-21 | `supabase/tests/04_kredit_overdue.sql` | Manajer menaikkan batas kredit via `rpc_set_batas_kredit`, pesanan yang sebelumnya melebihi limit langsung dapat dikonfirmasi. |
| **TC-37** | BR-13/14: Non-bypassable untuk Manajer (D5) | M | SQL | **Lulus** | 2026-10-22 | `supabase/tests/04_kredit_overdue.sql` | Manajer yang mencoba langsung mengonfirmasi pesanan pelanggan bermasalah kredit tetap diblokir oleh `rpc_konfirmasi_pesanan` dengan error E0012/E0013. Override hanya legal melalui B1/B2. |
| **TC-38** | Kerahasiaan data view & RPC baru (Zero Leakage) | P1, G | SQL | **Lulus** | 2026-10-21 | `supabase/tests/04_kredit_overdue.sql` | View `v_pelanggan_kredit` dan RPC `rpc_get_faktur_overdue_pelanggan` bebas dari kolom rahasia (`harga_pokok`, `harga_beli_satuan`, `hpp_satuan`). |
| **TC-39** | UI Pesanan Editor: Panel Dinamis & Alert Live | P1 | UI / E2E | **Lulus** | 2026-10-21 | `tests/e2e/04-kredit-overdue.spec.ts` | Form editor pesanan menampilkan 4 kartu ringkasan kredit, estimasi sisa plafon live, banner alert saat overlimit/overdue, dan tombol draf tetap aktif (D3). |
| **TC-40** | UI Detail Pelanggan: Rincian Piutang & Tabel Overdue | P1, M | UI / E2E | **Lulus** | 2026-10-21 | `tests/e2e/04-kredit-overdue.spec.ts` | Halaman `/pelanggan/[id]` merender rincian terkonfirmasi vs terkirim, serta Tabel Faktur Overdue lengkap dengan tombol pelunasan khusus Manajer. |

---

## 8. Test Case Tambahan: Manajemen Stock Opname & Penyesuaian Fisik (TC-41 s.d. TC-48)

| ID | Fokus Uji | Aktor | Media | Status | Tanggal Uji | Bukti Uji | Ringkasan Verifikasi & Hasil |
|---|---|---|---|---|---|---|---|
| **TC-41** | Pembuatan Draf Sesi Opname oleh Gudang | G | SQL + Unit | **Lulus** | 2026-10-22 | `supabase/tests/05_stock_opname.sql`<br>`src/features/stock-opname/__tests__/schemas.test.ts` | Gudang berhasil membuat sesi opname berstatus draf dengan sequence nomor OPN-YYYY-XXXX. |
| **TC-42** | Penolakan Akses Staf Penjualan (RBAC) | P1 | SQL | **Lulus** | 2026-10-22 | `supabase/tests/05_stock_opname.sql` | Staf Penjualan ditolak saat membuat opname dengan error E0001 (Akses ditolak). |
| **TC-43** | Validasi Stok Fisik Negatif & Duplikat Item | G | SQL + Unit | **Lulus** | 2026-10-22 | `supabase/tests/05_stock_opname.sql`<br>`src/features/stock-opname/__tests__/schemas.test.ts` | Stok fisik negatif ditolak (E0033), duplikat barang_id dalam satu sesi ditolak (E0035). |
| **TC-44** | Pengajuan Sesi Opname (draf -> diajukan) | G | SQL | **Lulus** | 2026-10-22 | `supabase/tests/05_stock_opname.sql` | Status sesi bertransisi dari draf ke diajukan, dikunci dari pengubahan item. |
| **TC-45** | Larangan Staf Gudang Menyetujui Opname Sendiri | G | SQL | **Lulus** | 2026-10-22 | `supabase/tests/05_stock_opname.sql` | Pemanggilan rpc_setujui_opname_stok oleh Staf Gudang ditolak bersih (E0036). |
| **TC-46** | Persetujuan Manajer & Koreksi Fisik Stok Otomatis | M | SQL | **Lulus** | 2026-10-22 | `supabase/tests/05_stock_opname.sql` | Manajer menyetujui, stok master barang terkoreksi ke stok fisik, mutasi_stok jenis penyesuaian dicatat. |
| **TC-47** | Pembatalan Sesi & Validasi Alasan Minimal 10 Karakter | G, M | SQL | **Lulus** | 2026-10-22 | `supabase/tests/05_stock_opname.sql` | Pembatalan sesi opname dengan alasan < 10 karakter ditolak (E0016), alasan valid berhasil. |
| **TC-48** | Kerahasiaan Finansial View v_opname_stok_manajer | G, M | SQL | **Lulus** | 2026-10-22 | `supabase/tests/05_stock_opname.sql` | Gudang membaca 0 baris dari view manajer; Manajer membaca seluruh nominal selisih finansial. |

---

## 9. Test Case Tambahan: Pengaman Audit & Anti-Drift (TC-49 s.d. TC-54)

| ID | Fokus Uji | Aktor | Media | Status | Tanggal Uji | Bukti Uji | Ringkasan Verifikasi & Hasil |
|---|---|---|---|---|---|---|---|
| **TC-49** | K3: Validasi Keterangan Selisih 9 vs 10 Karakter | G | SQL + Unit | **Lulus** | 2026-10-22 | `supabase/tests/05_stock_opname.sql`<br>`src/features/stock-opname/__tests__/schemas.test.ts` | Item selisih dengan keterangan 9 karakter setelah trim ditolak E0037 di RPC & Zod; keterangan 10 karakter berhasil. |
| **TC-50** | K3: Format Alasan Mutasi Stok Opname | M | SQL | **Lulus** | 2026-10-22 | `supabase/tests/05_stock_opname.sql` | Kolom `mutasi_stok.alasan` tercatat persis `"Stock opname <nomor>: <keterangan>"`. |
| **TC-51** | K4: Pengaman Anti-Drift Persetujuan Opname | M | SQL | **Lulus** | 2026-10-22 | `supabase/tests/05_stock_opname.sql` | Persetujuan ditolak dengan E0038 jika `barang.stok` berubah setelah sesi dibuat, menyebut nama barang & stok sekarang. |
| **TC-52** | K4: Persetujuan Sukses Bila Stok Stabil | M | SQL | **Lulus** | 2026-10-22 | `supabase/tests/05_stock_opname.sql` | Persetujuan berjalan sukses dan mutasi tercatat bila stok barang tidak berubah di tengah sesi. |
---

## 10. Test Case Tambahan: Alur Persetujuan Harga di Bawah HPP (TC-55 s.d. TC-70)

| ID | Fokus Uji | Aktor | Media | Status | Tanggal Uji | Bukti Uji | Ringkasan Verifikasi & Hasil |
|---|---|---|---|---|---|---|---|
| **TC-55** | Pengajuan persetujuan harga draf di bawah HPP | P1 | SQL + Vitest | **Lulus** | 2026-10-22 | `supabase/tests/06_persetujuan_harga.sql`<br>`src/features/pesanan/__tests__/persetujuan.test.ts` | Staf Penjualan berhasil mengajukan persetujuan harga; status pesanan_harga tercatat `menunggu` dan snapshot hash terisi. |
| **TC-56** | Penolakan pengajuan oleh non-penjualan (RBAC) | G, M | SQL | **Lulus** | 2026-10-22 | `supabase/tests/06_persetujuan_harga.sql` | Pemanggilan `rpc_ajukan_persetujuan_harga` oleh Gudang/Manajer ditolak bersih dengan `E0039`. |
| **TC-57** | Penolakan pengajuan pada pesanan non-draf | P1 | SQL | **Lulus** | 2026-10-22 | `supabase/tests/06_persetujuan_harga.sql` | Pengajuan pada pesanan yang sudah berstatus bukan draf ditolak dengan `E0040`. |
| **TC-58** | Penolakan pengajuan ganda (partial unique index) | P1 | SQL | **Lulus** | 2026-10-22 | `supabase/tests/06_persetujuan_harga.sql` | Pengajuan baru pada pesanan yang telah memiliki persetujuan berstatus menunggu/disetujui ditolak dengan `E0041`. |
| **TC-59** | Penolakan pengajuan jika semua harga di atas HPP | P1 | SQL | **Lulus** | 2026-10-22 | `supabase/tests/06_persetujuan_harga.sql` | Pengajuan pada pesanan yang tidak memiliki harga jual di bawah HPP ditolak dengan `E0042` tanpa membocorkan nilai rahasia. |
| **TC-60** | Validasi alasan penolakan Manajer (minimal 10 char) | M | SQL + Vitest | **Lulus** | 2026-10-22 | `supabase/tests/06_persetujuan_harga.sql`<br>`src/features/pesanan/__tests__/persetujuan.test.ts` | Penolakan dengan alasan < 10 karakter ditolak `E0044`; alasan penolakan ≥ 10 karakter berhasil mengubah status menjadi `ditolak`. |
| **TC-61** | Keputusan persetujuan Manajer & masa berlaku 24 jam | M | SQL | **Lulus** | 2026-10-22 | `supabase/tests/06_persetujuan_harga.sql` | Manajer menyetujui dispensasi harga; status menjadi `disetujui` dan `berlaku_sampai` tercatat keputusan_pada + 24 jam. |
| **TC-62** | Konfirmasi pesanan dengan persetujuan efektif | P1 | SQL | **Lulus** | 2026-10-22 | `supabase/tests/06_persetujuan_harga.sql` | Staf Penjualan mengonfirmasi draf di bawah HPP; konfirmasi lolos, stok terpotong, status persetujuan berubah menjadi `terpakai`. |
| **TC-63** | Penolakan konfirmasi saat persetujuan kedaluwarsa | P1 | SQL | **Lulus** | 2026-10-22 | `supabase/tests/06_persetujuan_harga.sql` | Konfirmasi setelah melewati `berlaku_sampai` (24 jam) ditolak persis dengan pesan BR-04 verbatim `Harga di bawah batas, minta persetujuan Manajer`. |
| **TC-64** | Deteksi modifikasi item setelah persetujuan (Drift Hash) | P1 | SQL | **Lulus** | 2026-10-22 | `supabase/tests/06_persetujuan_harga.sql` | Perubahan harga/jumlah/diskon barang draf setelah disetujui menyebabkan hash tidak cocok; konfirmasi ditolak persis pesan BR-04 verbatim. |
| **TC-65** | Pembatalan pengajuan menunggu oleh pemilik draf | P1 | SQL + Vitest | **Lulus** | 2026-10-22 | `supabase/tests/06_persetujuan_harga.sql`<br>`src/features/pesanan/__tests__/persetujuan.test.ts` | Staf pembuat pesanan berhasil membatalkan pengajuan yang masih berstatus `menunggu`. |
| **TC-66** | Penolakan pembatalan oleh non-pemilik / non-menunggu | P2, M | SQL | **Lulus** | 2026-10-22 | `supabase/tests/06_persetujuan_harga.sql` | Pembatalan pengajuan oleh staf lain ditolak `E0001`; pembatalan saat status bukan menunggu ditolak `E0045`. |
| **TC-67** | Uji Konkurensi & Urutan Kunci Bebas Deadlock | Multi | PowerShell | **Lulus** | 2026-10-22 | `supabase/tests/06_konkurensi_persetujuan.ps1` | 10 iterasi konkurensi paralel konfirmasi vs persetujuan berhasil 100% tanpa deadlock (urutan locking konsisten). |
| **TC-68** | Zero-leakage data finansial rahasia (HPP/margin) | P1, G | SQL | **Lulus** | 2026-10-22 | `supabase/tests/06_persetujuan_harga.sql` | Penjualan dan Gudang membaca 0 baris dari `v_persetujuan_harga_manajer` dan `snapshot_hash` tersembunyi dari column grant. |
| **TC-69** | Invalidasi otomatis persetujuan saat draf diperbarui | P1 | SQL | **Lulus** | 2026-10-22 | `supabase/tests/06_persetujuan_harga.sql` | Pemanggilan `rpc_simpan_draf_pesanan` otomatis memperbarui status persetujuan aktif (menunggu/disetujui) menjadi `kedaluwarsa`. |
| **TC-70** | Pembatalan otomatis persetujuan saat draf dibatalkan | P1 | SQL | **Lulus** | 2026-10-22 | `supabase/tests/06_persetujuan_harga.sql` | Pemanggilan `rpc_batalkan_draf` otomatis memperbarui status persetujuan aktif menjadi `dibatalkan` dan mencatat log audit. |

---

## 11. Test Case Tambahan: Penagihan Piutang & Pengingat Jatuh Tempo (TC-71 s.d. TC-88)

| ID | Fokus Uji | Aktor | Media | Status | Tanggal Uji | Bukti Uji | Ringkasan Verifikasi & Hasil |
|---|---|---|---|---|---|---|---|
| **TC-71** | Batas klasifikasi umur: `hari_ini` (jatuh tempo = hari ini Asia/Jakarta) | Sistem | SQL | **Lulus** | 2026-10-22 | `supabase/tests/07_penagihan_piutang.sql` | Tanggal hari ini tepat diklasifikasikan `hari_ini`, `hari_terlambat = 0`, dan diverifikasi belum berstatus overdue. |
| **TC-72** | Batas klasifikasi umur: `segera` (jatuh tempo 1–3 hari ke depan) | Sistem | SQL | **Lulus** | 2026-10-22 | `supabase/tests/07_penagihan_piutang.sql` | Tanggal `v_today + 1..3` secara konsisten diklasifikasikan sebagai `segera`. |
| **TC-73** | Batas klasifikasi umur: `belum_jatuh_tempo` (jatuh tempo > 3 hari ke depan) | Sistem | SQL | **Lulus** | 2026-10-22 | `supabase/tests/07_penagihan_piutang.sql` | Tanggal `v_today + 4` diklasifikasikan sebagai `belum_jatuh_tempo`. |
| **TC-74** | Batas klasifikasi umur: `overdue_1_7` (terlambat 1–7 hari) | Sistem | SQL | **Lulus** | 2026-10-22 | `supabase/tests/07_penagihan_piutang.sql` | Tanggal `v_today - 1` s.d. `v_today - 7` hari menghasilkan `overdue_1_7` dengan perhitungan `hari_terlambat` tepat. |
| **TC-75** | Batas klasifikasi umur: `overdue_8_30` (terlambat 8–30 hari) | Sistem | SQL | **Lulus** | 2026-10-22 | `supabase/tests/07_penagihan_piutang.sql` | Tanggal `v_today - 8` s.d. `v_today - 30` hari menghasilkan `overdue_8_30`. |
| **TC-76** | Batas klasifikasi umur: `overdue_lebih_30` (terlambat > 30 hari) | Sistem | SQL | **Lulus** | 2026-10-22 | `supabase/tests/07_penagihan_piutang.sql` | Tanggal `v_today - 31` hari menghasilkan kategori `overdue_lebih_30`. |
| **TC-77** | Isolasi visibilitas Penjualan pada `v_tagihan` (RLS) | P1 | SQL | **Lulus** | 2026-10-22 | `supabase/tests/07_penagihan_piutang.sql` | Staf Penjualan 1 hanya menerima faktur dari pesanannya sendiri; faktur staf lain terisolasi sempurna. |
| **TC-78** | Pemblokiran total akses Gudang (v_tagihan & RPC) | G | SQL | **Lulus** | 2026-10-22 | `supabase/tests/07_penagihan_piutang.sql` | Gudang ditolak saat memanggil `rpc_catat_penagihan` (`E0001`) dan menerima 0 baris dari `v_tagihan`. |
| **TC-79** | Hak akses penuh Manajer pada `v_tagihan` | M | SQL | **Lulus** | 2026-10-22 | `supabase/tests/07_penagihan_piutang.sql` | Manajer membaca seluruh faktur terkirim belum lunas lintas seluruh staf penjualan (2 dari 2 terbaca). |
| **TC-80** | Sifat append-only tabel `catatan_penagihan` (Trigger Guard) | M, P | SQL | **Lulus** | 2026-10-22 | `supabase/tests/07_penagihan_piutang.sql` | Operasi UPDATE dan DELETE langsung pada tabel ditolak tegas oleh trigger `trg_catatan_penagihan_guard` (E0051). |
| **TC-81** | Validasi panjang isi catatan penagihan (3–500 karakter) | P, M | SQL | **Lulus** | 2026-10-22 | `supabase/tests/07_penagihan_piutang.sql` | Isi catatan < 3 karakter setelah trim ditolak dengan error `E0047`. |
| **TC-82** | Validasi tanggal janji bayar wajib dan larangan masa lalu | P, M | SQL | **Lulus** | 2026-10-22 | `supabase/tests/07_penagihan_piutang.sql` | `jenis = 'janji_bayar'` tanpa tanggal ditolak `E0048`; bertanggal sebelum hari ini ditolak `E0049`. |
| **TC-83** | Deteksi dinamis status janji terlewat | Sistem | SQL | **Lulus** | 2026-10-22 | `supabase/tests/07_penagihan_piutang.sql` | Janji bayar bertanggal kemarin pada faktur belum lunas dideteksi dinamis berstatus `status_janji = 'terlewat'`. |
| **TC-84** | Normalisasi nomor telepon standar Indonesia | Sistem | Vitest | **Lulus** | 2026-10-22 | `src/features/penagihan/__tests__/utils.test.ts` | Format `08...`, `+62...`, dan spasi berhasil diubah ke format standar `628...` (4 subtes lolos). |
| **TC-85** | Validasi nomor telepon tidak valid untuk WhatsApp | Sistem | Vitest | **Lulus** | 2026-10-22 | `src/features/penagihan/__tests__/utils.test.ts` | Nomor telepon rumah kabel 021, nomor pendek < 9 digit, nomor kosong ditolak dengan pesan jelas (4 subtes lolos). |
| **TC-86** | Pembuatan pesan resmi & encoding URL WhatsApp | Sistem | Vitest | **Lulus** | 2026-10-22 | `src/features/penagihan/__tests__/utils.test.ts` | 3 templat pesan terisi lengkap dan URL `wa.me` ter-encode sempurna tanpa karakter rusak (4 subtes lolos). |
| **TC-87** | Otomatisasi pencatatan riwayat saat buka WhatsApp | P, M | Integrasi | **Lulus** | 2026-10-22 | `src/features/penagihan/actions.ts` | Server Action merekam interaksi `pengingat_wa` ke `catatan_penagihan` sebelum tab WhatsApp dibuka. |
| **TC-88** | Dampak pelunasan Manajer terhadap daftar tagihan | M | SQL | **Lulus** | 2026-10-22 | `supabase/tests/07_penagihan_piutang.sql` | Pemanggilan `rpc_catat_pelunasan` mengubah status pesanan ke `lunas`; faktur seketika hilang dari `v_tagihan`. |

---

## 12. Test Case Tambahan: Impor CSV Data Master (TC-89 s.d. TC-110)

| ID | Fokus Uji | Aktor | Media | Status | Tanggal Uji | Bukti Uji | Ringkasan Verifikasi & Hasil |
|---|---|---|---|---|---|---|---|
| **TC-89** | Impor CSV Barang Valid (Stok 0, Tanpa HPP) | M | SQL + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/08_impor_csv.sql`<br>`src/features/impor/__tests__/utils.test.ts` | Barang baru berhasil dibuat dengan `stok = 0`, nomor dokumen `IMP-YYYY-XXXX`, tercatat di `impor_data` dan `audit_log`. |
| **TC-90** | Impor CSV Barang Valid dengan Stok Awal & HPP | M | SQL + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/08_impor_csv.sql`<br>`src/features/impor/__tests__/utils.test.ts` | Barang tersimpan, `harga_pokok` terisi, kartu `mutasi_stok` mencatat penyesuaian saldo awal (alasan $\ge 10$ char), invarian mutasi = stok terpenuhi. |
| **TC-91** | Impor CSV Pelanggan Valid (Termin & Batas Kredit) | M | SQL + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/08_impor_csv.sql`<br>`src/features/impor/__tests__/utils.test.ts` | Pelanggan tersimpan lengkap dengan batas kredit dan termin tempo yang diizinkan (0, 7, 14, 30 hari). |
| **TC-92** | Deteksi Kode Duplikat di dalam Berkas CSV | M | SQL + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/08_impor_csv.sql`<br>`src/features/impor/__tests__/utils.test.ts` | Dua baris berkode sama di berkas ditolak dengan galat `E0059` dan membatalkan impor. |
| **TC-93** | Penolakan Kode yang Sudah Ada di Database | M | SQL + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/08_impor_csv.sql`<br>`src/features/impor/__tests__/utils.test.ts` | Kode eksisting ditolak dengan galat `E0057` (kebijakan insert-only tanpa upsert). |
| **TC-94** | Penolakan Harga Jual Nol atau Negatif | M | SQL + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/08_impor_csv.sql`<br>`src/features/impor/__tests__/utils.test.ts` | Nilai `harga_jual <= 0` ditolak tegas dengan kode error `E0028`. |
| **TC-95** | Penolakan Format Angka Pecahan Desimal | M | Vitest | **Lulus** | 2026-10-23 | `src/features/impor/__tests__/utils.test.ts` | Input desimal seperti `15000.50` atau `15000,50` ditolak dengan error `E0058`. |
| **TC-96** | Pembersihan Format Angka dengan Pemisah Ribuan | M | Vitest | **Lulus** | 2026-10-23 | `src/features/impor/__tests__/utils.test.ts` | String ribuan `15.000` atau `1,000,000` dinormalisasi menjadi integer murni tanpa error. |
| **TC-97** | Penolakan Nilai Termin Hari Tidak Valid | M | SQL + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/08_impor_csv.sql`<br>`src/features/impor/__tests__/utils.test.ts` | Termin selain 0, 7, 14, 30 (misal 45) ditolak tegas dengan error `E0024`. |
| **TC-98** | Penolakan Struktur Header Salah atau Kolom Hilang | M | Vitest | **Lulus** | 2026-10-23 | `src/features/impor/__tests__/utils.test.ts` | Header kolom tidak sesuai templat ditolak pada level berkas dengan error `E0053`. |
| **TC-99** | Penolakan Berkas CSV Kosong (0 Baris Data) | M | SQL + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/08_impor_csv.sql`<br>`src/features/impor/__tests__/utils.test.ts` | Berkas CSV kosong atau hanya berisi baris header ditolak dengan error `E0054`. |
| **TC-100** | Penolakan Berkas Melebihi Batas 1.000 Baris Data | M | Vitest | **Lulus** | 2026-10-23 | `src/features/impor/__tests__/utils.test.ts` | Berkas berisi 1.001 baris data ditolak pada validasi kuota baris dengan error `E0055`. |
| **TC-101** | Penolakan Berkas Melebihi Batas Ukuran 1 MB | M | Server Action | **Lulus** | 2026-10-23 | `src/features/impor/actions.ts` | Berkas ukuran $> 1\text{ MB}$ ditolak sebelum proses parsing dengan error `E0056`. |
| **TC-102** | Deteksi Otomatis Pemisah Koma (,) vs Titik Koma (;) | M | Vitest | **Lulus** | 2026-10-23 | `src/features/impor/__tests__/utils.test.ts` | Berkas beralas titik koma (Excel Indonesia) terdeteksi otomatis dan diparsing presisi. |
| **TC-103** | Penanganan Encoding UTF-8 dengan BOM | M | Vitest | **Lulus** | 2026-10-23 | `src/features/impor/__tests__/utils.test.ts` | Karakter `\uFEFF` di awal berkas dibersihkan transparan tanpa merusak header kolom. |
| **TC-104** | Penolakan Format Berkas Non-CSV (.xlsx / .xls) | M | Server Action | **Lulus** | 2026-10-23 | `src/features/impor/actions.ts` | Pengunggahan berkas non-csv ditolak dengan pesan instruksi jelas `E0061`. |
| **TC-105** | Atomisitas Transaksi (All or Nothing Rollback) | M | SQL | **Lulus** | 2026-10-23 | `supabase/tests/08_impor_csv.sql` | Batch berisi baris valid dan 1 baris invalid di-rollback 100% tanpa ada data parsial. |
| **TC-106** | Validasi Ulang di Lapisan Database RPC | M | SQL | **Lulus** | 2026-10-23 | `supabase/tests/08_impor_csv.sql` | Panggilan RPC langsung dengan payload invalid ditolak tegas oleh Postgres engine (`E0062`). |
| **TC-107** | Pemblokiran Hak Akses Penjualan dan Gudang | P, G | SQL + Route Guard | **Lulus** | 2026-10-23 | `supabase/tests/08_impor_csv.sql`<br>`src/lib/akses.ts` | Penjualan dan Gudang dialihkan ke `/tidak-berwenang` dan ditolak RPC `E0001`. |
| **TC-108** | Zero-Leakage Data Rahasia Harga Pokok | P, G | SQL + View/RLS | **Lulus** | 2026-10-23 | `supabase/tests/08_impor_csv.sql` | `impor_data` dan `audit_log` tidak memuat data baris mentah maupun harga pokok. |
| **TC-109** | Ketahanan Konkurensi & Balapan Dua Berkas Bersamaan | Multi | SQL / Constraint | **Lulus** | 2026-10-23 | `supabase/migrations/20261023023000_impor_csv.sql` | Constraint unik database menjamin tidak terjadi duplikasi kode saat balapan paralel. |
| **TC-110** | Verifikasi Siklus Templat Siap Pakai | M | End-to-End | **Lulus** | 2026-10-23 | `src/features/impor/__tests__/utils.test.ts` | Templat CSV yang diunduh dari sistem terbukti valid dan dapat diimpor kembali 100%. |

---

## 13. Test Case Tambahan: Pusat Tugas Harian & Daftar Ambil Barang (TC-111 s.d. TC-125)

| ID | Fokus Uji | Aktor | Media | Status | Tanggal Uji | Bukti Uji | Ringkasan Verifikasi & Hasil |
|---|---|---|---|---|---|---|---|
| **TC-111** | Akurasi Agregat Dasbor Penjualan | P1 | SQL + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/09_pusat_tugas.sql`<br>`src/features/pusat-tugas/__tests__/utils.test.ts` | Nilai widget `draf_saya`, `menunggu_kirim_saya`, `persetujuan_harga_menunggu_saya`, `tagihan_tempo_hari_ini_saya`, dan `tagihan_overdue_saya` tepat sesuai baris data aktual. |
| **TC-112** | Isolasi Kepemilikan Data Penjualan di Dasbor | P1, P2 | SQL | **Lulus** | 2026-10-23 | `supabase/tests/09_pusat_tugas.sql` | P1 tidak menghitung draf, pesanan, atau tagihan milik P2; nilai terisolasi 100% akurat. |
| **TC-113** | Akurasi Agregat Dasbor Gudang & Umur Tertua | G | SQL + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/09_pusat_tugas.sql`<br>`src/features/pusat-tugas/__tests__/utils.test.ts` | Menghitung pesanan siap kirim, PO disetujui, stok menipis, opname draf, dan umur pesanan tertua dalam satuan hari bisnis Asia/Jakarta. |
| **TC-114** | Akurasi Agregat Dasbor Manajer | M | SQL + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/09_pusat_tugas.sql`<br>`src/features/pusat-tugas/__tests__/utils.test.ts` | Menghitung persetujuan harga menunggu, PO diajukan, opname diajukan, tagihan overdue/hari ini, dan stok menipis secara terpadu. |
| **TC-115** | Performa & Atomisitas Single-Call Dasbor | All | SQL Direct Call | **Lulus** | 2026-10-23 | `supabase/tests/09_pusat_tugas.sql` | Pemanggilan `rpc_get_tugas_harian()` selesai dalam 1 round-trip (< 50ms) dan menolak pengguna non-login. |
| **TC-116** | Pemblokiran Penjualan pada Fitur Picking List | P1 | SQL + Route Guard | **Lulus** | 2026-10-23 | `supabase/tests/09_pusat_tugas.sql`<br>`src/lib/akses.ts` | P1 dialihkan ke `/tidak-berwenang` saat buka `/gudang/picking`, dan eksekusi `rpc_ambil_daftar_picking` ditolak dengan error `E0065`. |
| **TC-117** | Pembuatan Picking List untuk 1 Pesanan Valid | G, M | SQL + UI | **Lulus** | 2026-10-23 | `supabase/tests/09_pusat_tugas.sql`<br>`src/features/pusat-tugas/actions.ts` | Mengembalikan daftar barang dan rincian pesanan dengan struktur JSONB lengkap dan status sukses. |
| **TC-118** | Agregasi Multi-Pesanan (Penggabungan Barang Sama) | G, M | SQL + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/09_pusat_tugas.sql`<br>`src/features/pusat-tugas/__tests__/utils.test.ts` | Jika Pesanan A dan B memesan barang yang sama, kuantitas dijumlahkan presisi dan diurutkan `kode_barang ASC`. |
| **TC-119** | Deteksi Indikator Kecukupan Stok Fisik | G, M | SQL + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/09_pusat_tugas.sql`<br>`src/features/pusat-tugas/__tests__/utils.test.ts` | Flag `stok_cukup = false` jika `total_diambil > stok_saat_ini`, dan `true` jika mencukupi. |
| **TC-120** | Penolakan Parameter Daftar Pesanan Kosong | G, M | SQL | **Lulus** | 2026-10-23 | `supabase/tests/09_pusat_tugas.sql` | Pemanggilan `rpc_ambil_daftar_picking` dengan array kosong atau NULL ditolak dengan pesan error `E0063`. |
| **TC-121** | Penolakan Pesanan Bukan Berstatus Dikonfirmasi | G, M | SQL | **Lulus** | 2026-10-23 | `supabase/tests/09_pusat_tugas.sql` | Jika array memuat pesanan draf, dikirim, lunas, atau batal, seluruh panggilan ditolak dengan pesan error `E0064`. |
| **TC-122** | Penolakan Pesanan dengan ID Palsu / Tak Dikenal | G, M | SQL | **Lulus** | 2026-10-23 | `supabase/tests/09_pusat_tugas.sql` | Array berisi UUID yang tidak ada di database ditolak dengan pesan error `E0064`. |
| **TC-123** | Zero-Leakage Data Finansial Rahasia | G | Network + DOM | **Lulus** | 2026-10-23 | `supabase/tests/09_pusat_tugas.sql`<br>`src/features/pusat-tugas/types.ts` | Respons JSON, DOM, dan payload picking list 100% bebas dari harga satuan, diskon, HPP, margin, dan total rupiah. |
| **TC-124** | Kelengkapan Tata Letak Cetak Resmi (@media print) | G, M | UI Inspection | **Lulus** | 2026-10-23 | `src/features/pusat-tugas/components/picking-workspace.tsx` | Tampilan cetak memuat kop resmi perusahaan, tanggal & jam cetak Asia/Jakarta, nama pencetak, dan kotak centang ceklis fisik. |
| **TC-125** | Penanganan State Kosong & Netralitas Angka Nol | All | UI Inspection | **Lulus** | 2026-10-23 | `src/features/pusat-tugas/components/tugas-hari-ini.tsx` | Saat angka = 0, widget tampil netral (slate-400) tanpa warna alarm. Halaman picking list menampilkan EmptyState jika tidak ada pesanan dikonfirmasi. |

---

## 14. Test Case Tambahan: Analitik Pelanggan dan Performa Sales (TC-126 s.d. TC-145)

| ID | Fokus Uji | Aktor | Media | Status | Tanggal Uji | Bukti Uji | Ringkasan Verifikasi & Hasil |
|---|---|---|---|---|---|---|---|
| **TC-126** | Akurasi Agregat Performa Sales (`rpc_analitik_performa_sales`) | M | SQL | **Lulus** | 2026-10-23 | `supabase/tests/10_analitik.sql` | Omzet, HPP, margin kotor, dan jumlah pesanan per sales terhitung presisi sesuai pesanan dikirim/lunas. |
| **TC-127** | Penanganan Staf Penjualan dengan 0 Transaksi | M | SQL | **Lulus** | 2026-10-23 | `supabase/tests/10_analitik.sql` | Staf penjualan tanpa transaksi tetap muncul dengan omzet Rp0, margin Rp0, tanpa error pembagian nol (`margin_persen = 0`). |
| **TC-128** | Akurasi Perhitungan Piutang Berjalan per Sales | M | SQL | **Lulus** | 2026-10-23 | `supabase/tests/10_analitik.sql` | Nilai pesanan berstatus `'dikirim'` yang belum lunas terakumulasi presisi pada kolom `piutang_berjalan`. |
| **TC-129** | Akurasi Kontribusi Omzet Top Pelanggan (`rpc_analitik_top_pelanggan`) | M | SQL | **Lulus** | 2026-10-23 | `supabase/tests/10_analitik.sql` | Persentase kontribusi omzet terhadap total periode terhitung akurat (`(omzet_pelanggan / total_omzet_semua) * 100`). |
| **TC-130** | Penentuan Status Kredit Dinamis Top Pelanggan | M | SQL | **Lulus** | 2026-10-23 | `supabase/tests/10_analitik.sql` | Pelanggan dengan faktur jatuh tempo mendapat status `'overdue'`, limit habis `'overlimit'`, lainnya `'lancar'`. |
| **TC-131** | Pembatasan Limit Baris Top Pelanggan (Safe Limit Guard) | M | SQL | **Lulus** | 2026-10-23 | `supabase/tests/10_analitik.sql` | Parameter `p_limit` dibatasi maksimal 50 baris meskipun pemanggil meminta nilai lebih besar. |
| **TC-132** | Deteksi Pelanggan Tidak Aktif $\ge 30$ Hari (`rpc_analitik_pelanggan_tidak_aktif`) | M | SQL | **Lulus** | 2026-10-23 | `supabase/tests/10_analitik.sql` | Pelanggan dengan order terakhir $\ge 30$ hari lalu muncul terurut dari hari inaktivitas terlama. |
| **TC-133** | Penanganan Pelanggan Baru yang Belum Pernah Bertransaksi | M | SQL | **Lulus** | 2026-10-23 | `supabase/tests/10_analitik.sql` | Pelanggan dengan 0 riwayat order tetap muncul dengan `pesanan_terakhir_pada = NULL` dan hari inaktivitas dihitung sejak tanggal dibuat. |
| **TC-134** | Eksklusi Pelanggan Nonaktif (`aktif = false`) pada Dormant List | M | SQL | **Lulus** | 2026-10-23 | `supabase/tests/10_analitik.sql` | Pelanggan nonaktif tidak dimasukkan ke dalam daftar retensi pelanggan pasif. |
| **TC-135** | Deteksi Barang Tidak Bergerak $\ge 30$ Hari (`rpc_analitik_barang_tidak_bergerak`) | M | SQL | **Lulus** | 2026-10-23 | `supabase/tests/10_analitik.sql` | Barang dengan stok $> 0$ yang tidak laku dalam $\ge 30$ hari terdeteksi akurat. |
| **TC-136** | Kalkulasi Nilai Modal Tertahan (Dead Capital) | M | SQL | **Lulus** | 2026-10-23 | `supabase/tests/10_analitik.sql` | `nilai_stok_mengendap` terhitung presisi (`stok * harga_pokok`). |
| **TC-137** | Eksklusi Barang Stok Nol dari Analitik Dead Stock | M | SQL | **Lulus** | 2026-10-23 | `supabase/tests/10_analitik.sql` | Barang tanpa transaksi tetapi memiliki `stok = 0` tidak masuk ke daftar dead stock. |
| **TC-138** | Penanganan Barang Baru Belum Pernah Terjual | M | SQL | **Lulus** | 2026-10-23 | `supabase/tests/10_analitik.sql` | Barang belum pernah terjual memiliki `penjualan_terakhir_pada = NULL` dan hari mengendap dihitung dari mutasi stok masuk pertama. |
| **TC-139** | Pemblokiran Akses Staf Penjualan pada Semua RPC Analitik | P | SQL | **Lulus** | 2026-10-23 | `supabase/tests/10_analitik.sql` | Eksekusi seluruh 4 RPC analitik oleh Staf Penjualan ditolak tegas dengan kode error `E0001` (Akses ditolak). |
| **TC-140** | Pemblokiran Akses Staf Gudang pada Semua RPC Analitik | G | SQL | **Lulus** | 2026-10-23 | `supabase/tests/10_analitik.sql` | Eksekusi seluruh 4 RPC analitik oleh Staf Gudang ditolak tegas dengan kode error `E0001` (Akses ditolak). |
| **TC-141** | Pemblokiran Akses Pengguna Anonim | Anon | SQL | **Lulus** | 2026-10-23 | `supabase/migrations/20261023043000_analitik.sql` | Pemanggilan tanpa token auth ditolak izin eksekusi (`REVOKE ALL FROM PUBLIC, anon`). |
| **TC-142** | Proteksi Route Guard & Middleware Halaman `/analitik` | P, G | Route Guard | **Lulus** | 2026-10-23 | `src/lib/akses.ts` | Penjualan dan Gudang yang mengakses URL `/analitik` dialihkan ke `/tidak-berwenang` (HTTP 403). |
| **TC-143** | Proteksi Route Handler Ekspor CSV `/api/analitik/csv` | P, G | Server Route | **Lulus** | 2026-10-23 | `src/app/api/analitik/csv/route.ts` | Permintaan GET oleh non-Manajer menerima respon `403 Forbidden`. |
| **TC-144** | Zero-Leakage Data Rahasia HPP & Modal Tertahan | Network / DOM | Inspection | **Lulus** | 2026-10-23 | `src/features/analitik/types.ts` | Verifikasi respon JSON jaringan browser pada akun non-Manajer tidak mengandung `harga_pokok`, `total_hpp`, atau `nilai_stok_mengendap`. |
| **TC-145** | Validasi Integritas Ekspor Berkas CSV & Anti-Formula Injection | M | Vitest | **Lulus** | 2026-10-23 | `src/features/analitik/__tests__/utils.test.ts` | Berkas CSV memuat BOM `\uFEFF`, baris header lengkap, pemisah koma ter-escape, dan karakter formula berbahaya (`=`, `+`, `-`, `@`, `\t`, `\r`) diproteksi tanda petik tunggal (`'`). |

---

## 15. Test Case Tambahan: Cetak Surat Jalan (TC-146 s.d. TC-155)

| ID | Fokus Uji | Aktor | Media | Status | Tanggal Uji | Bukti Uji | Ringkasan Verifikasi & Hasil |
|---|---|---|---|---|---|---|---|
| **TC-146** | Akses Surat Jalan Status `dikirim` oleh Gudang | G | SQL + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/11_surat_jalan.sql`<br>`src/features/pesanan/__tests__/surat-jalan.test.ts` | Gudang berhasil memuat header dan item pesanan berstatus dikirim. |
| **TC-147** | Akses Surat Jalan Status `dikirim` oleh Manajer | M | SQL + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/11_surat_jalan.sql`<br>`src/features/pesanan/__tests__/surat-jalan.test.ts` | Manajer berhasil memuat seluruh pesanan berstatus dikirim dan rincian item. |
| **TC-148** | Akses Surat Jalan Status `dikirim` oleh Sales Pemilik | P | SQL + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/11_surat_jalan.sql`<br>`src/features/pesanan/__tests__/surat-jalan.test.ts` | Sales pembuat pesanan berhasil memuat surat jalan pesanan miliknya yang berstatus dikirim. |
| **TC-149** | Penolakan Sales Bukan Pemilik pada Surat Jalan | P | SQL + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/11_surat_jalan.sql`<br>`src/features/pesanan/__tests__/surat-jalan.test.ts` | Kueri `v_surat_jalan` dan `v_surat_jalan_item` mengembalikan 0 baris bagi sales non-pemilik. |
| **TC-150** | Penolakan Surat Jalan untuk Pesanan Status `draf` | All | SQL + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/11_surat_jalan.sql`<br>`src/features/pesanan/__tests__/surat-jalan.test.ts` | Kueri mengembalikan 0 baris; UI menampilkan pesan netral *"Surat jalan hanya tersedia untuk pesanan berstatus dikirim"*. |
| **TC-151** | Penolakan Surat Jalan untuk Pesanan Status `dikonfirmasi` | All | SQL + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/11_surat_jalan.sql`<br>`src/features/pesanan/__tests__/surat-jalan.test.ts` | Kueri mengembalikan 0 baris; UI menampilkan pesan netral tanpa membocorkan isi data pesanan. |
| **TC-152** | Penolakan Surat Jalan untuk Pesanan Status `lunas` dan `dibatalkan` | All | SQL + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/11_surat_jalan.sql`<br>`src/features/pesanan/__tests__/surat-jalan.test.ts` | Kueri mengembalikan 0 baris; akses diblokir dengan pesan netral. |
| **TC-153** | Verifikasi Zero-Leakage Data Uang pada Katalog Kolom View | Net / SQL | SQL Catalog + Vitest | **Lulus** | 2026-10-23 | `supabase/tests/11_surat_jalan.sql`<br>`src/features/pesanan/__tests__/surat-jalan.test.ts` | Kolom `v_surat_jalan` dan `v_surat_jalan_item` 100% bebas dari kolom finansial (harga, diskon, subtotal, total, hpp, margin, jatuh_tempo). |
| **TC-154** | Kelengkapan Format Cetak Surat Jalan (@media print) | G, M | UI Inspection | **Lulus** | 2026-10-23 | `src/app/(dashboard)/pesanan/[id]/surat-jalan/page.tsx` | Dokumen A4 memuat kop CV Sinar Abadi Niaga, nomor pesanan, tgl kirim WIB, tabel barang, total jenis & kuantitas, 3 kotak TTD, jam cetak & nama pencetak. |
| **TC-155** | Visibilitas Tombol "Cetak Surat Jalan" di `/pesanan/[id]` | All | UI Inspection + Vitest | **Lulus** | 2026-10-23 | `src/features/pesanan/components/pesanan-actions.tsx` | Tombol "Cetak Surat Jalan" hanya muncul ketika pesanan berstatus `dikirim`. |

---

## 16. Test Case Tambahan: Notifikasi Email Stok Menipis Harian (TC-156 s.d. TC-172)

| ID | Fokus Uji | Aktor | Media | Status | Tanggal Uji | Bukti Uji | Ringkasan Verifikasi & Hasil |
|---|---|---|---|---|---|---|---|
| **TC-156** | Barang Stok Sama Dengan Minimum Disertakan (`stok = stok_minimum`) | Sistem | SQL | **Lulus** | 2026-10-23 | `supabase/tests/12_notifikasi_email.sql` | Barang aktif dengan `stok = 10` dan `stok_minimum = 10` berhasil masuk dalam daftar notifikasi `rpc_sistem_daftar_stok_menipis()`. |
| **TC-157** | Barang Stok Di Atas Minimum Dieksklusi (`stok > stok_minimum`) | Sistem | SQL | **Lulus** | 2026-10-23 | `supabase/tests/12_notifikasi_email.sql` | Barang dengan stok melebihi batas minimum berhasil dieksklusi dari daftar stok menipis. |
| **TC-158** | Barang Nonaktif Dieksklusi dari Daftar Stok Menipis | Sistem | SQL | **Lulus** | 2026-10-23 | `supabase/tests/12_notifikasi_email.sql` | Barang dengan status `aktif = false` tidak disertakan meskipun stoknya berada di bawah minimum. |
| **TC-159** | Barang Stok Nol dan Minimum Nol Disertakan (`0 <= 0`) | Sistem | SQL | **Lulus** | 2026-10-23 | `supabase/tests/12_notifikasi_email.sql` | Barang aktif dengan stok 0 dan minimum 0 tetap disertakan sesuai aturan inklusif (sama dengan). |
| **TC-160** | Penerima Notifikasi Hanya Manajer dan Gudang Aktif | Sistem | SQL | **Lulus** | 2026-10-23 | `supabase/tests/12_notifikasi_email.sql` | Staf Penjualan dan profil nonaktif berhasil dieksklusi; hanya Manajer dan Gudang aktif yang ditarik. |
| **TC-161** | Daftar Barang Kosong: Tidak Mengirim Email & Status `dilewati` | Sistem | Service | **Lulus** | 2026-10-23 | `src/features/notifikasi/service.ts` | Jika tidak ada barang menipis, pengiriman email dibatalkan dan status log dicatat sebagai `dilewati`. |
| **TC-162** | Idempotensi Harian: Panggilan Ganda Hanya Mengirim Sekali | Sistem | SQL | **Lulus** | 2026-10-23 | `supabase/tests/12_notifikasi_email.sql` | Panggilan kedua pada tanggal bisnis yang sama ditolak oleh `rpc_sistem_klaim_notifikasi()` (`boleh_kirim = false`). |
| **TC-163** | Retry pada Status `gagal` Diizinkan | Sistem | SQL | **Lulus** | 2026-10-23 | `supabase/tests/12_notifikasi_email.sql` | Jika riwayat pengiriman sebelumnya berstatus `gagal`, panggilan berikutnya diizinkan untuk mengklaim ulang (`boleh_kirim = true`). |
| **TC-164** | Otentikasi Token Cron: Token Hilang atau Salah Menghasilkan 401 | Publik | Route Handler | **Lulus** | 2026-10-23 | `src/features/notifikasi/__tests__/email-stok.test.ts` | Permintaan tanpa token atau dengan Bearer token yang tidak cocok ditolak dengan HTTP 401 polos (`timingSafeEqual`). |
| **TC-165** | Penolakan Metode HTTP GET pada Route Cron (405) | Publik | Route Handler | **Lulus** | 2026-10-23 | `src/features/notifikasi/__tests__/email-stok.test.ts` | Permintaan GET ke `/api/cron/notifikasi-stok` menghasilkan HTTP 405 Method Not Allowed dengan header Allow: POST. |
| **TC-166** | Mode Sandbox: Mengirim 1 Email ke `EMAIL_SANDBOX_TO` dengan Banner | Sistem | Vitest | **Lulus** | 2026-10-23 | `src/features/notifikasi/__tests__/email-stok.test.ts` | Mode sandbox mengirim ke alamat penguji dengan banner MODE UJI tanpa membocorkan alamat email asli penerima di badan email. |
| **TC-167** | Mode Live: Mengirim Email Terpisah per Penerima | Sistem | Vitest | **Lulus** | 2026-10-23 | `src/features/notifikasi/__tests__/email-stok.test.ts` | Mode live mengirim email secara individual ke setiap penerima dengan Idempotency-Key unik. |
| **TC-168** | Sanitasi HTML & Pembatasan 100 Baris pada Isi Email | Sistem | Vitest | **Lulus** | 2026-10-23 | `src/features/notifikasi/__tests__/email-stok.test.ts` | Karakter `<script>` dan tanda kutip/kurang-dari ter-escape aman; daftar dipotong pada baris 100 dengan pesan ringkasan sisa. |
| **TC-169** | Zero-Leakage: Tidak Ada Kolom Nilai Uang pada Email & RPC | Sistem | Vitest | **Lulus** | 2026-10-23 | `src/features/notifikasi/__tests__/email-stok.test.ts` | Dokumen email dan skema RPC sistem 100% bebas dari kolom finansial (harga pokok, harga jual, subtotal, total, HPP, margin). |
| **TC-170** | Hak Akses Database: `rpc_sistem_*` Diblokir dari `authenticated` & `anon` | User / Anon | SQL | **Lulus** | 2026-10-23 | `supabase/tests/12_notifikasi_email.sql` | Hak `EXECUTE` pada seluruh fungsi `rpc_sistem_*` dicabut dari `PUBLIC`, `anon`, dan `authenticated`; hanya `service_role` yang diizinkan. |
| **TC-171** | Otorisasi Halaman `/notifikasi` Khusus Manajer (Penjualan & Gudang Ditolak) | P, G, M | SQL + Route Guard | **Lulus** | 2026-10-23 | `supabase/tests/12_notifikasi_email.sql`<br>`src/lib/akses.ts` | Manajer sukses membaca riwayat log; Penjualan dan Gudang ditolak di tingkat database (E0001) dan route guard (403). |
| **TC-172** | Rate Limiting Tombol Uji Kirim (1 Kali per Menit) | M | SQL / Action | **Lulus** | 2026-10-23 | `supabase/tests/12_notifikasi_email.sql` | Panggilan uji coba kedua dalam kurun waktu kurang dari 60 detik ditolak dengan pesan pembatasan laju. |

---

## 17. Test Case Tambahan: Tautan Bayar Piutang lewat Mayar (TC-173 s.d. TC-192)

| ID | Fokus Uji | Aktor | Media | Status | Tanggal Uji | Bukti Uji | Ringkasan Verifikasi & Hasil |
|---|---|---|---|---|---|---|---|
| **TC-173** | Pembuatan tagihan sukses via MockMayarClient & HttpMayarClient | M | Vitest | **Lulus** | 2026-10-24 | `src/features/pembayaran/__tests__/mayar.test.ts` | Berhasil membuat, membaca, dan menutup invoice tagihan dengan atribut lengkap dan header token. |
| **TC-174** | Penolakan tagihan pada pesanan berstatus selain `dikirim` | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/13_tautan_bayar_mayar.sql` | Pesanan berstatus draf, dikonfirmasi, atau lunas ditolak tegas dengan kode galat `E0067`. |
| **TC-175** | Idempotensi tagihan aktif (hanya 1 tagihan aktif per pesanan) | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/13_tautan_bayar_mayar.sql` | Pembuatan tagihan kedua saat masih ada tagihan berstatus dibuat ditolak dengan indeks unik `uq_tagihan_mayar_pesanan_aktif` (`E0066`). |
| **TC-176** | Validasi email pelanggan dan normalisasi telepon | M | Action | **Lulus** | 2026-10-24 | `src/features/pembayaran/actions.ts` | Email divalidasi via Zod; nomor telepon dinormalisasi format 628xxx sebelum dikirim ke gateway. |
| **TC-177** | Penutupan tagihan aktif oleh Manajer | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/13_tautan_bayar_mayar.sql` | Eksekusi `rpc_tutup_tagihan_mayar` sukses mengubah status tagihan menjadi `ditutup`. |
| **TC-178** | Penutupan otomatis tagihan Mayar saat pelunasan manual | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/13_tautan_bayar_mayar.sql` | Pemanggilan `rpc_catat_pelunasan` otomatis menutup tagihan Mayar aktif menjadi `ditutup`. |
| **TC-179** | Verifikasi token webhook constant-time (`timingSafeEqual`) | Sistem | Vitest + SQL | **Lulus** | 2026-10-24 | `src/features/pembayaran/__tests__/mayar.test.ts`<br>`supabase/tests/13_tautan_bayar_mayar.sql` | Perbandingan token aman dari serangan timing attack pada panjang karakter sama maupun beda. |
| **TC-180** | Penolakan webhook token tidak cocok (404 Not Found) | Publik | Vitest | **Lulus** | 2026-10-24 | `src/features/pembayaran/__tests__/mayar.test.ts` | Request dengan token salah ditolak dengan HTTP 404 tanpa mengekspos eksistensi endpoint. |
| **TC-181** | Penolakan metode HTTP selain POST pada route webhook (405) | Publik | Vitest | **Lulus** | 2026-10-24 | `src/features/pembayaran/__tests__/mayar.test.ts` | Request GET atau PUT menghasilkan respon `405 Method Not Allowed` dengan header `Allow: POST`. |
| **TC-182** | Penolakan payload webhook melebihi 100 KB (413 Payload Too Large) | Publik | Vitest | **Lulus** | 2026-10-24 | `src/features/pembayaran/__tests__/mayar.test.ts` | Payload $> 100\text{ KB}$ ditolak langsung sebelum parsing dengan HTTP 413. |
| **TC-183** | Penolakan format JSON rusak pada webhook (400 Bad Request) | Publik | Vitest | **Lulus** | 2026-10-24 | `src/features/pembayaran/__tests__/mayar.test.ts` | Payload JSON malformed ditolak dengan status HTTP 400. |
| **TC-184** | Verifikasi 2 arah: Webhook payment.received memicu GET /invoice | Sistem | Vitest + SQL | **Lulus** | 2026-10-24 | `src/features/pembayaran/__tests__/mayar.test.ts`<br>`supabase/tests/13_tautan_bayar_mayar.sql` | Sistem memvalidasi ulang status invoice ke gateway Mayar sebelum memproses pelunasan pesanan. |
| **TC-185** | Idempotensi webhook event (event_id sama tidak diproses ulang) | Sistem | SQL | **Lulus** | 2026-10-24 | `supabase/tests/13_tautan_bayar_mayar.sql` | Pengiriman ulang webhook dengan `event_id` yang sama dicatat `diabaikan` dan dihindari double-settlement. |
| **TC-186** | Penanganan ketidaksesuaian nominal / status anomali (`perlu_tinjau`) | Sistem | SQL | **Lulus** | 2026-10-24 | `supabase/tests/13_tautan_bayar_mayar.sql` | Nominal yang tidak cocok menandai tagihan `perlu_tinjau` tanpa mengubah status pesanan ke lunas. |
| **TC-187** | Pelunasan pesanan otomatis saat status terverifikasi `paid` | Sistem | SQL | **Lulus** | 2026-10-24 | `supabase/tests/13_tautan_bayar_mayar.sql` | Eksekusi `rpc_sistem_lunaskan_dari_mayar` sukses melunasi pesanan, memperbarui status tagihan, dan mencatat audit log. |
| **TC-188** | Halaman `/pembayaran/selesai` statis, noindex, dan bebas sesi DB | Publik | Build / MW | **Lulus** | 2026-10-24 | `src/app/pembayaran/selesai/page.tsx` | Halaman pendaratan statis bebas render server dan memuat meta robots noindex. |
| **TC-189** | Middleware meloloskan `/pembayaran/selesai` tanpa redirect login | Publik | Middleware | **Lulus** | 2026-10-24 | `src/middleware.ts` | Pengguna publik tanpa sesi auth dapat membuka halaman sukses pembayaran. |
| **TC-190** | Zero-leakage data finansial rahasia (harga_pokok, HPP, margin) | All | SQL + Build | **Lulus** | 2026-10-24 | `powershell Select-String .next\static` | Verifikasi bundle klien dan respon RPC/tabel terbukti 100% bebas dari kolom rahasia. |
| **TC-191** | Otorisasi UI: Hanya peran Manajer yang dapat mengakses modul pembayaran | P, G, M | Route Guard | **Lulus** | 2026-10-24 | `src/lib/akses.ts` | Penjualan dan Gudang diblokir dari menu & rute `/pembayaran` (HTTP 403 / redirect). |
| **TC-192** | Hak akses database: `rpc_sistem_*` hanya untuk `service_role` | Anon / Auth | SQL | **Lulus** | 2026-10-24 | `supabase/tests/13_tautan_bayar_mayar.sql` | PostgREST & role authenticated ditolak mengeksekusi `rpc_sistem_*` (`permission denied`). |

---

## 18. Test Case Tambahan: Pemantauan dan Rekomendasi Kredit (TC-193 s.d. TC-213)

| ID | Fokus Uji | Aktor | Media | Status | Tanggal Uji | Bukti Uji | Ringkasan Verifikasi & Hasil |
|---|---|---|---|---|---|---|---|
| **TC-193** | Ambang Batas Data Cukup: Pelanggan dengan < 3 pesanan selesai diklasifikasikan `data_kurang` | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Pelanggan dengan 2 transaksi lunas menghasilkan skor NULL dan kelas `data_kurang`. |
| **TC-194** | Ambang Batas Data Cukup: Pelanggan dengan umur transaksi < 60 hari diklasifikasikan `data_kurang` | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Pelanggan dengan rentang transaksi 30 hari menghasilkan kelas `data_kurang`. |
| **TC-195** | Ketepatan Bayar Batas WIB: Pelunasan pada tanggal jatuh tempo 23:59:59 WIB dihitung tepat waktu | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Perhitungan selisih hari pelunasan berbasis zona Asia/Jakarta menghasilkan 0 hari keterlambatan. |
| **TC-196** | Skenario 2 Hitung Tangan: 4 pilar dihitung presisi dan skor gabungan 100 | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Nilai pilar pembayaran (40), utilisasi (25), tren (15), histori (20) menghasilkan total skor 100.00. |
| **TC-197** | Batas Skor Kelas: Pemetaan rentang skor ke kelas risiko (A: 80-100, B: 65-79, C: 50-64, D: 35-49, E: <35) | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Validasi pemetaan skor sesuai fungsi `fn_analisis_kredit_pelanggan()`. |
| **TC-198** | Skenario 3 Override Kelas: Faktur overdue > 30 hari otomatis menurunkan kelas ke E dan rekomendasi Rp0 | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Keterlambatan faktur > 30 hari memicu penalti berat ke kelas E dan rekomendasi limit Rp0. |
| **TC-199** | Formula Rekomendasi Limit: Menghasilkan batas atas, median, dan bawah sesuai rumus | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Rekomendasi nominal limit konsisten dihitung berdasarkan omzet bulanan rata-rata dan kelas risiko. |
| **TC-200** | Pembulatan ke Bawah Kelipatan Rp100.000 pada seluruh nominal rekomendasi | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Nominal rekomendasi dibulatkan ke bawah ke kelipatan Rp100.000 terdekat (`floor(x / 100000) * 100000`). |
| **TC-201** | Cap Rekomendasi Limit 3x Faktur Terbesar dalam 12 Bulan Terakhir | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Rekomendasi batas atas tidak melebihi 3x nilai faktur terbesar pelanggan. |
| **TC-202** | Cap Kenaikan Rekomendasi Limit 1.5x Limit Saat Ini | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Rekomendasi batas atas dibatasi maksimum 1.5x batas kredit berjalan. |
| **TC-203** | Pelanggan dengan Limit Saat Ini Rp0 Tidak Dibatasi 1.5x | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Plafon Rp0 tetap mendapatkan rekomendasi batas atas wajar dari 3x faktur terbesar. |
| **TC-204** | Rekomendasi Limit Kelas E Selalu Bernilai Rp0 | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Nilai rekomendasi batas atas, median, dan bawah untuk kelas E terverifikasi Rp0. |
| **TC-205** | Eksekusi Fungsi `fn_simulasi_limit_kredit()`: Perhitungan dampak sisa kredit & utilisasi | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Simulasi mengembalikan batas_kredit_baru, sisa_plafon_baru, dan utilisasi_baru secara akurat. |
| **TC-206** | Aksi Terapkan Rekomendasi Memanggil `rpc_set_batas_kredit` & Tercatat di Audit Log | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Perubahan limit kredit dari rekomendasi tersimpan dengan aksi `ubah_batas_kredit` di `audit_log`. |
| **TC-207** | Hak Akses Database: Fungsi Khusus Manajer Menolak Penjualan & Gudang (`E0001`) | P, G, M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Penjualan dan Gudang ditolak saat memanggil fungsi analisis dan daftar pemantauan kredit. |
| **TC-208** | Advisory Warning Pesanan Editor: Pelanggan Status `terlambat_tinjau` | P, M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Menghasilkan kode `PERLU_TINJAU_LIMIT` dengan tingkat `peringatan`. |
| **TC-209** | Advisory Warning Pesanan Editor: Pelanggan Kelas D atau E | P, M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Menghasilkan kode `RISIKO_KREDIT_TINGGI` dengan pesan non-blocking. |
| **TC-210** | Advisory Warning Pesanan Editor: Non-blocking terhadap Penyimpanan Draf & Konfirmasi | P, M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Pesanan tetap dapat dikonfirmasi selama tidak melanggar batas kredit atau menunggak faktur (BR-05). |
| **TC-211** | Perhitungan Status Tinjau Limit Kredit (>= 90 Hari Menghasilkan `perlu_tinjau`) | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Pelanggan dengan riwayat tinjau >= 90 hari atau belum pernah ditinjau terdeteksi `perlu_tinjau`. |
| **TC-212** | Pelanggan Baru 0 Pesanan Menghasilkan `data_kurang` Tanpa Error Division by Zero | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Fungsi mengembalikan kelas `data_kurang` dengan aman tanpa terjadi runtime error. |
| **TC-213** | Eksekusi `fn_daftar_pemantauan_kredit()` Menghasilkan Data Komprehensif Seluruh Pelanggan | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/14_pemantauan_kredit.sql` | Seluruh metrik kredit (skor, kelas, utilisasi, overdue, rekomendasi, status tinjau) tampil utuh. |

---

## 19. Test Case Tambahan: Pembatalan Pembelian PO Sesuai PRD Bab 6.2 & BR-09 (TC-214 s.d. TC-228)

| ID | Fokus Uji | Aktor | Media | Status | Tanggal Uji | Bukti Uji | Ringkasan Verifikasi & Hasil |
|---|---|---|---|---|---|---|---|
| **TC-214** | Pengaju membatalkan PO berstatus `diajukan` | G | SQL + Unit | **Lulus** | 2026-10-24 | `supabase/tests/15_pembatalan_pembelian.sql`<br>`src/features/pembelian/__tests__/schemas.test.ts` | Status berubah menjadi `dibatalkan`, kolom `dibatalkan_oleh`, `dibatalkan_pada`, dan `alasan_batal` terisi lengkap. |
| **TC-215** | Penolakan pembatalan PO `diajukan` oleh non-pengaju (Gudang 2) | G | SQL | **Lulus** | 2026-10-24 | `supabase/tests/15_pembatalan_pembelian.sql` | Ditolak dengan kode error `E0074: Hanya pengaju yang berwenang membatalkan pengajuan pembelian`. |
| **TC-216** | Penolakan pembatalan PO `diajukan` oleh Manajer bukan pengaju (PRD Harfiah) | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/15_pembatalan_pembelian.sql` | Ditolak dengan `E0074`; Manajer diarahkan menggunakan alur penolakan (`rpc_tolak_pembelian`). |
| **TC-217** | Manajer membatalkan PO berstatus `disetujui` (sebelum barang diterima) | M | SQL + Unit | **Lulus** | 2026-10-24 | `supabase/tests/15_pembatalan_pembelian.sql`<br>`src/features/pembelian/__tests__/schemas.test.ts` | Status berubah menjadi `dibatalkan` dan pelaku manajer tercatat di baris pembelian. |
| **TC-218** | Penolakan pembatalan PO `disetujui` oleh Staf Gudang | G | SQL | **Lulus** | 2026-10-24 | `supabase/tests/15_pembatalan_pembelian.sql` | Ditolak tegas dengan kode error `E0075: Hanya Manajer yang berwenang membatalkan pembelian yang disetujui`. |
| **TC-219** | Penolakan pembatalan PO berstatus `diterima` | M, G | SQL | **Lulus** | 2026-10-24 | `supabase/tests/15_pembatalan_pembelian.sql` | Ditolak dengan kode error `E0076: Pembelian dengan status ini tidak dapat dibatalkan`. |
| **TC-220** | Penolakan pembatalan PO berstatus `ditolak` | M, G | SQL | **Lulus** | 2026-10-24 | `supabase/tests/15_pembatalan_pembelian.sql` | Ditolak dengan kode error `E0076: Pembelian dengan status ini tidak dapat dibatalkan`. |
| **TC-221** | Penolakan pembatalan ganda pada PO yang sudah `dibatalkan` | M, G | SQL | **Lulus** | 2026-10-24 | `supabase/tests/15_pembatalan_pembelian.sql` | Ditolak dengan kode error `E0076: Pembelian dengan status ini tidak dapat dibatalkan`. |
| **TC-222** | Penolakan penerimaan barang fisik pada PO yang telah dibatalkan | G, M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/15_pembatalan_pembelian.sql` | Eksekusi `rpc_terima_pembelian` ditolak dengan kode error `E0019: Pembelian tidak dalam status disetujui`. |
| **TC-223** | Invariansi stok dan harga pokok master barang akibat pembatalan | Sistem | SQL | **Lulus** | 2026-10-24 | `supabase/tests/15_pembatalan_pembelian.sql` | Terbukti secara empiris pembatalan PO sama sekali tidak memicu mutasi stok maupun perubahan `harga_pokok`. |
| **TC-224** | Pencatatan jejak audit pembatalan (`audit_log`) dengan nilai sebelum & sesudah | M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/15_pembatalan_pembelian.sql` | Log mencatat `aksi = 'batalkan_pembelian'`, `nilai_lama` memuat status awal, dan `nilai_baru` memuat status `dibatalkan` dan alasan. |
| **TC-225** | Zero-Leakage: View `v_pembelian` untuk Gudang bebas dari harga_beli_satuan | G | SQL | **Lulus** | 2026-10-24 | `supabase/tests/15_pembatalan_pembelian.sql` | Kolom `harga_beli_satuan` terbukti 100% tidak ada pada skema view `v_pembelian`. |
| **TC-226** | Isolasi Antrean Dasbor & Tugas Harian (`rpc_get_tugas_harian`) | G, M | SQL | **Lulus** | 2026-10-24 | `supabase/tests/15_pembatalan_pembelian.sql` | PO berstatus dibatalkan tereksklusi dari metrik `po_menunggu_penerimaan` dan `po_menunggu_persetujuan`. |
| **TC-227** | Penolakan eksekusi RPC pembatalan oleh Staf Penjualan | P | SQL | **Lulus** | 2026-10-24 | `supabase/tests/15_pembatalan_pembelian.sql` | Pemanggilan fungsi langsung oleh peran Penjualan ditolak dengan `E0001: Akses ditolak`. |
| **TC-228** | Uji Konkurensi Multi-Proses: Penerimaan vs Pembatalan Bersamaan | G, M | PowerShell | **Lulus** | 2026-10-24 | `supabase/tests/15_konkurensi_pembatalan.ps1` | 10 dari 10 iterasi paralel berhasil dengan tepat satu pemenang konsisten tanpa deadlock basis data. |

---

## 20. Test Case Tambahan: Koreksi Pelunasan Khusus Manajer Sesuai PRD BR-07 & BR-12 (TC-229 s.d. TC-233)

| ID | Fokus Uji | Aktor | Media | Status | Tanggal Uji | Bukti Uji | Ringkasan Verifikasi & Hasil |
|---|---|---|---|---|---|---|---|
| **TC-229** | Penolakan eksekusi pelunasan langsung oleh Staf Penjualan (Rina) | P | SQL | **Lulus** | 2026-10-26 | `supabase/tests/16_koreksi_pelunasan.sql` | Pemanggilan `rpc_catat_pelunasan` langsung oleh Staf Penjualan ditolak tegas dengan kode error `E0078: Hanya Manajer yang berwenang mencatat pelunasan`. |
| **TC-230** | Manajer (Hendra) mencatat pelunasan pesanan berstatus `dikirim` | M | SQL | **Lulus** | 2026-10-26 | `supabase/tests/16_koreksi_pelunasan.sql` | Status berhasil berubah ke `lunas`, kolom `dilunasi_pada` terisi timestamp valid, dan tercatat di `audit_log` dengan aksi `'pelunasan'` (nilai_lama: `{"status":"dikirim"}`, nilai_baru: `{"status":"lunas","dilunasi_pada":...}`). |
| **TC-231** | Penolakan pelunasan pesanan berstatus `draf` (`draf -> lunas`) | M | SQL | **Lulus** | 2026-10-26 | `supabase/tests/16_koreksi_pelunasan.sql` | Ditolak dengan kode error `E0015: Perpindahan status atau tindakan tidak diizinkan`. Status `draf` tidak boleh langsung dilunasi tanpa konfirmasi dan pengiriman. |
| **TC-232** | Penolakan pelunasan ulang pesanan yang sudah berstatus `lunas` | M | SQL | **Lulus** | 2026-10-26 | `supabase/tests/16_koreksi_pelunasan.sql` | Ditolak dengan `E0015`. Pesanan yang sudah `lunas` bersifat final dan tidak dapat dimutasi statusnya kembali. |
| **TC-233** | Verifikasi kepatuhan tombol UI & penegasan sistem bebas dari fitur estimasi denda | P, M | Vitest + SQL | **Lulus** | 2026-10-26 | `src/features/pesanan/__tests__/pelunasan-ui.test.ts`<br>`supabase/tests/16_koreksi_pelunasan.sql` | Staf Penjualan tidak melihat tombol "Catat Lunas" di `/penagihan`, detail pesanan, dan detail pelanggan, namun tombol pengingat WhatsApp tetap tersedia. Sistem bebas 100% dari kolom/fitur estimasi denda/bunga. |






